import dotenv from 'dotenv';
dotenv.config();

import express, { type Express, type Response } from "express";
import { type Request as ExpressRequest } from "express-serve-static-core";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import multer from "multer";
import {
  insertAgentSchema,
  insertWebsiteCrawlSchema,
  type Agent,
} from "@shared/schema";
import { setupAuth } from "./auth";
import { parse as parseCookie } from "cookie";

// Add type for agent request handler
interface RequestWithAuth extends ExpressRequest {
  user: Express.User;
}
import { OpenAI } from "openai";
import { JSDOM } from "jsdom";

// Add types for file upload request
type MulterFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

interface RequestWithFile extends ExpressRequest {
  file?: MulterFile;
}

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Lazy load pdf-parse to avoid initialization issues
let pdfParse: typeof import('pdf-parse').default;
const initPdfParse = async () => {
  if (!pdfParse) {
    pdfParse = (await import('pdf-parse')).default;
  }
  return pdfParse;
};

// Declare global types for injection
declare global {
  interface Window {
    _React: unknown;
    reactIsLoaded: boolean;
    crawlMetadata: WebsiteCrawlMetadata;
  }
}

type WebsiteElement = HTMLElement & {
  querySelectorAll<T extends Element = Element>(
    selectors: string,
  ): NodeListOf<T>;
  querySelector<T extends Element = Element>(selectors: string): T | null;
};

interface ExtractedPageContent {
  title: string;
  content: string;
  level: number;
  url: string;
  features?: string[];
  sections: Array<{
    title: string;
    content: string;
    services?: ServiceData[];
    features?: string[];
  }>;
  headings: Array<{
    level: number;
    text: string;
    content: string;
  }>;
}

type Page = {
  path: string;
  title: string;
  type: "page" | "anchor" | "email" | "phone";
};

interface ServiceData {
  name: string;
  description: string;
  features: string[];
}

interface PageSection {
  title: string;
  content: string;
  services?: ServiceData[];
  level?: number;
  features?: string[];
}

interface PageContent extends PageSection {
  level: number;
  features?: string[];
}

interface PageData {
  url: string;
  title: string;
  headings: Array<{
    level: number;
    text: string;
    content: string;
  }>;
  sections: PageSection[];
}

// Add WebSocket message type definitions
type WSMessage = {
  type: "transcription" | "response" | "audio" | "error";
  text?: string;
  audio?: string;
  error?: string;
  isFinal?: boolean;
};

// Add conversation message type
type ConversationMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// Add metadata extraction helper functions
function extractWebsiteMetadata(document: Document): WebsiteCrawlMetadata {
  const metadata: WebsiteCrawlMetadata = {
    title: "",
    description: "",
    pages: [],
    services: [],
    pageContents: [],
    crawledAt: new Date().toISOString(),
    pageCount: 0,
    lastAnalyzed: new Date().toISOString(),
  };

  // Extract title
  metadata.title =
    document.querySelector("title")?.textContent?.trim() ||
    document.querySelector("h1")?.textContent?.trim() ||
    document
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content") ||
    "Untitled Page";

  // Extract description and introduction
  const metaDesc =
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content") ||
    document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute("content");

  // Find main content area
  const mainContent =
    document.querySelector(
      'main, [role="main"], article, .content, #content',
    ) || document;

  // Extract introduction/purpose from prominent sections
  const introSection = Array.from(
    mainContent.querySelectorAll(
      'section, div[class*="intro"], div[class*="hero"], div[class*="about"]',
    ),
  ).find((section) => {
    const text = section.textContent?.trim();
    return (
      text &&
      text.length > 100 &&
      !text.includes("cookie") &&
      !text.includes("privacy")
    );
  });

  const introParagraphs =
    introSection?.querySelectorAll("p") || mainContent.querySelectorAll("p");
  let introduction = Array.from(introParagraphs)
    .slice(0, 3) // Take first 3 paragraphs
    .map((p) => p.textContent?.trim())
    .filter(
      (text): text is string => typeof text === "string" && text.length > 50,
    )
    .join("\n\n");

  metadata.description = metaDesc || introduction || "No description available";

  // Extract page content with proper sections and features
  let headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");

  metadata.pageContents = Array.from(headings)
    .map((heading): PageContent => {
      const level = parseInt(heading.tagName[1]);
      const title = heading.textContent?.trim() || "";
      let content = "";
      let features: string[] = [];

      // Get content until next heading of same or higher level
      let nextEl = heading.nextElementSibling;
      while (nextEl) {
        if (
          nextEl.tagName.match(/^H[1-6]$/) &&
          parseInt(nextEl.tagName[1]) <= level
        ) {
          break;
        }

        // Extract lists as features
        if (nextEl.matches("ul, ol")) {
          const extractedFeatures = Array.from(nextEl.querySelectorAll("li"))
            .map((li) => li.textContent?.trim())
            .filter(
              (text): text is string =>
                typeof text === "string" && text.length > 10,
            );
          if (extractedFeatures.length > 0) {
            features = features.concat(extractedFeatures);
          }
        } else {
          const trimmedText = nextEl.textContent?.trim();
          if (typeof trimmedText === "string" && trimmedText.length > 0) {
            content += trimmedText + "\n";
          }
        }

        nextEl = nextEl.nextElementSibling;
      }

      return {
        level,
        title,
        content: content.trim(),
        features: features.length > 0 ? features : undefined,
      };
    })
    .filter(
      (
        section,
      ): section is {
        level: number;
        title: string;
        content: string;
        features: string[] | undefined;
      } =>
        section.title.length > 0 &&
        (section.content.length > 0 || (section.features?.length ?? 0) > 0),
    );

  // Extract services and features with enhanced structure
  // const serviceSelectors = [
  //   'section[class*="service"], section[class*="feature"]',
  //   'div[class*="service"], div[class*="feature"]',
  //   ".card, .feature-card, .service-card",
  //   '[class*="service-item"], [class*="feature-item"]',
  //   '[data-testid*="service"], [data-testid*="feature"]',
  //   ".solutions, .products, .offerings",
  // ];

  const serviceElements = document.querySelectorAll(serviceSelectors.join(","));
  const services = new Map<
    string,
    { description: string; features: string[] }
  >();

  serviceElements.forEach((element) => {
    const title = element
      .querySelector("h2, h3, h4, h5, h6, strong")
      ?.textContent?.trim();
    if (!title || title.length < 3) return;

    // Get detailed description
    const descElements = element.querySelectorAll("p");
    let description = Array.from(descElements)
      .map((el) => el.textContent?.trim())
      .filter(
        (text): text is string => typeof text === "string" && text.length > 20,
      )
      .join("\n");

    // Get features or benefits
    const features = Array.from(element.querySelectorAll("ul li, ol li"))
      .map((li) => li.textContent?.trim())
      .filter(
        (text): text is string => typeof text === "string" && text.length > 10,
      );

    if (!services.has(title)) {
      services.set(title, {
        description: description || "No description available",
        features: features.length > 0 ? features : [],
      });
    }
  });

  metadata.services = Array.from(services.entries()).map(
    ([title, data]): Service => ({
      title,
      description: data.description,
      features: data.features,
    }),
  );

  // Extract navigation/pages with better structure
  const navLinks = Array.from(
    document.querySelectorAll('nav a, [role="navigation"] a, header a'),
  )
    .map((link) => {
      const href = link.getAttribute("href");
      if (!href) return null;

      try {
        // Handle relative URLs
        const fullUrl = new URL(href, "https://example.com");
        const type = href.includes("#")
          ? ("anchor" as const)
          : href.includes("mailto:")
            ? ("email" as const)
            : href.includes("tel:")
              ? ("phone" as const)
              : ("page" as const);

        return {
          path: fullUrl.pathname + fullUrl.search,
          title: link.textContent?.trim() || "",
          type,
        };
      } catch {
        return null;
      }
    })
    .filter(
      (
        link,
      ): link is {
        path: string;
        title: string;
        type: "page" | "anchor" | "email" | "phone";
      } =>
        link !== null &&
        link.type === "page" &&
        link.title.length > 0 &&
        !link.path.includes("login") &&
        !link.path.includes("signup"),
    );

  metadata.pages = [
    ...Array.from(new Map(navLinks.map((link) => [link.path, link])).values()),
  ];

  return metadata;
}

function formatDocument(
  metadata: WebsiteCrawlMetadata,
  content: string,
  pageContents: Array<PageData & { sections: PageSection[] }>,
): string {
  let document = `# ${metadata.title}\n\n`;

  // Add introduction
  document += `## Introduction\n${metadata.description}\n\n`;

  // Add site structure with page contents
  document += `## Site Structure\n\n`;
  pageContents.forEach((page) => {
    document += `### ${page.title}\nURL: ${page.url}\n\n`;

    if (page.sections.length > 0) {
      document += `#### Page Sections\n`;
      page.sections.forEach((section: PageSection) => {
        if (section.title) {
          document += `##### ${section.title}\n${section.content}\n\n`;

          const svcArr = section.services?.filter(isService) || [];
          if (svcArr.length > 0) {
            document += `Services in this section:\n`;
            svcArr.forEach((service) => {
              document += `- ${service.name}\n  ${service.description}\n`;
              if (service.features.length > 0) {
                document += `  Features:\n${service.features.map((f) => `    * ${f}`).join("\n")}\n`;
              }
            });
            document += "\n";
          }
        }
      });
    }

    // Add heading structure
    if (page.headings.length > 0) {
      document += `#### Page Content Structure\n`;
      page.headings.forEach((heading) => {
        document += `${"#".repeat(heading.level + 4)} ${heading.text}\n${heading.content}\n\n`;
      });
    }
  });

  // Add services summary
  if (metadata.services?.length > 0) {
    document += `## Services Quick Reference\n\n`;
    metadata.services.forEach((service) => {
      // Find pages containing this service
      const servicePages = pageContents.filter((page) =>
        page.sections.some((section) =>
          section.services?.some((s) =>
            s.name.toLowerCase().includes(service.title.toLowerCase()),
          ),
        ),
      );

      document += `### ${service.title}\n`;
      document += `${service.description}\n\n`;

      if (servicePages.length > 0) {
        document += `Available on pages:\n${servicePages.map((p) => `- ${p.title}`).join("\n")}\n\n`;
      }

      if (service.features?.length > 0) {
        document += `Features:\n${service.features.map((f) => `- ${f}`).join("\n")}\n\n`;
      }
    });
  }

  // Add technical details
  document += `## Technical Details\n`;
  document += `- Last crawled: ${metadata.crawledAt}\n`;
  document += `- Pages crawled: ${metadata.pageCount}\n`;
  document += `- Last analyzed: ${metadata.lastAnalyzed}\n\n`;

  // Add raw content
  document += `## Raw Content\n${content}\n`;

  return document;
}

// Create Express app instance
const app = express();

// Get authentication middleware 
const { checkAuth } = setupAuth(app);

// Add protected agent routes
app.get("/api/agents", checkAuth, async (req: RequestWithAuth, res: Response) => {
  try {
    const agents = await storage.getAgentsByUserId(req.user.id);
    res.json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

app.post("/api/agents", checkAuth, async (req: RequestWithAuth, res: Response) => {
  try {
    const agentData = insertAgentSchema.parse({
      ...req.body,
      userId: req.user.id
    });
    const agent = await storage.createAgent(agentData);
    res.status(201).json(agent);
  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(400).json({ 
      error: error instanceof Error ? error.message : "Failed to create agent" 
    });
  }
});

// Create conversation context for more focused responses
async function createConversationContext(
  documents: KnowledgeDocument[],
  agent: Agent,
) {
  // Extract document content for reference 
  const documentContents = documents.map(doc => ({
    name: doc.name,
    content: doc.content || '',
    metadata: doc.metadata
  }));

  // Create strict system instructions for document-only responses
  const systemInstructions = `You are a document-focused AI assistant with STRICT limitations. Follow these rules without exception:

1. You can ONLY provide information that is explicitly present in the assigned documents.
2. Your knowledge is LIMITED to ONLY these documents:
${documentContents.map(doc => `- ${doc.name}`).join('\n')}

3. For EVERY response you give:
   - First verify if the information exists in the documents
   - If found: Start with "Based on the document(s), ..." and provide only that information
   - If not found: Respond EXACTLY with this message: "I cannot answer this question as it's not covered in the assigned documents. I can only provide information that is explicitly present in [document names]. Please ask about the content from these documents."

4. NEVER use any external knowledge or general information, even if relevant.
5. NEVER make assumptions or inferences beyond what's directly stated in the documents.
6. If asked about topics like Google Pixel or any other subjects not in the documents, respond with the cannot-answer message.

Important: You have NO access to information outside these documents. Treat any other knowledge as non-existent.`;

  // Create focused document context
  const documentContext = documentContents.map(doc => `
Document: ${doc.name}
Content Summary: ${doc.content ? doc.content.substring(0, 200) + '...' : 'No content'}
---`).join('\n');

  return {
    systemInstructions,
    documentContext,
    documentNames: documentContents.map(doc => doc.name)
  };
}

// Add PDF parsing endpoint 
app.post("/api/parse-pdf", upload.single('file'), async (req: RequestWithFile, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: "File must be a PDF" });
    }

    // Initialize pdf-parse lazily
    const parser = await initPdfParse();
    
    // Parse PDF and extract text
    const data = await parser(req.file.buffer);
    
    // Clean the extracted text
    let cleanContent = data.text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove PDF artifacts and control characters
      .replace(/[^\x20-\x7E\n]/g, '')
      // Remove hidden text and annotations
      .replace(/\[\[.*?\]\]/g, '')
      // Remove PDF internal references
      .replace(/\d+\s+\d+\s+obj.*?endobj/g, '')
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      // Remove empty lines
      .replace(/\n\s*\n/g, '\n')
      // Remove any remaining PDF markup
      .replace(/<</g, '')
      .replace(/>>/g, '')
      .replace(/endstream/g, '')
      .replace(/stream/g, '')
      .trim();

    // Basic validation of extracted content
    if (!cleanContent || cleanContent.length < 10) {
      return res.status(400).json({ 
        error: "Could not extract readable text from PDF" 
      });
    }

    res.json({ content: cleanContent });

  } catch (error) {
    console.error('PDF parsing error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to parse PDF" 
    });
  }
});

// Add chat endpoint with document-based response validation
app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { agentId, message } = req.body;
    
    // Get agent and its documents
    const agent = await storage.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const documents = await storage.getKnowledgeDocuments(agentId);
    if (!documents || documents.length === 0) {
      return res.status(400).json({ 
        error: "This agent has no assigned documents. Please assign documents first." 
      });
    }

    // Create strict conversation context
    const context = await createConversationContext(documents, agent);
    
    // Create the chat completion with strict context
    const openai = new OpenAI({ apiKey:
      //  process.env.OPENAI_API_KEY 
      });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: context.systemInstructions
        },
        {
          role: "system",
          content: `Available documents:\n${context.documentContext}`
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.1, // Use low temperature to keep responses focused and consistent
    });

    const response = completion.choices[0].message.content;

    // Validate response contains appropriate prefixes
    if (!response?.includes("Based on the document") && 
        !response?.includes("I cannot answer this question")) {
      // If response doesn't follow format, return cannot-answer message
      return res.json({
        response: `I cannot answer this question as it's not covered in the assigned documents. I can only provide information that is explicitly present in ${context.documentNames.join(", ")}. Please ask about the content from these documents.`
      });
    }

    return res.json({ response });

  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to process chat message" 
    });
  }
});

// Add type declarations for DatabaseStorage interface
declare module "./storage" {
  interface DatabaseStorage {
    createWebsiteCrawl(data: Partial<WebsiteCrawl>): Promise<WebsiteCrawl>;
    updateWebsiteCrawl(id: number, data: Partial<WebsiteCrawl>): Promise<void>;
    getWebsiteCrawl(id: number): Promise<WebsiteCrawl | undefined>;
    getWebsiteCrawls(agentId?: number): Promise<WebsiteCrawl[]>;
    getVoiceChatSessions(): Promise<VoiceChatSession[]>;
  }
}

// Add helper type guard functions
function isService(obj: any): obj is Service {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.title === "string" &&
    typeof obj.description === "string" &&
    Array.isArray(obj.features)
  );
}

function isKnowledgeDocumentMetadata(
  obj: any,
): obj is KnowledgeDocumentMetadata {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.title === "string" &&
    typeof obj.description === "string" &&
    Array.isArray(obj.pages) &&
    Array.isArray(obj.services) &&
    Array.isArray(obj.pageContents) &&
    typeof obj.crawledAt === "string" &&
    typeof obj.pageCount === "number" &&
    typeof obj.lastAnalyzed === "string"
  );
}

// Add metadata interfaces
interface Service {
  title: string;
  description: string;
  features: string[];
}

interface WebsiteCrawlMetadata {
  title: string;
  description: string;
  pages: Page[];
  services: Service[];
  pageContents: PageSection[];
  crawledAt: string;
  pageCount: number;
  crawlStats?: Record<string, any>;
  lastAnalyzed: string;
}

type KnowledgeDocumentMetadata = WebsiteCrawlMetadata & {
  title: string;
  description: string;
  services: Service[];
  pages: Page[];
  lastAnalyzed: string;
  [key: string]: unknown | Service[] | Page[] | string;
};

interface WebsiteCrawlOptions {
  crawlConfig?: {
    depth?: number;
    maxPages?: number;
    filters?: string[];
  };
  scheduleRecurrence?: string;
  agentId?: number;
  url?: string;
}

// Add storage types
interface CreateKnowledgeDocumentData {
  name: string;
  type: string;
  source: string;
  content: string | null;
  metadata: KnowledgeDocumentMetadata;
  agentId?: number;
}

type SessionStats = {
  date: string;
  sessions: number;
};

interface KnowledgeDocumentBase {
  source: string;
  name: string;
  type: string;
  metadata?: unknown;
  content?: string | null;
  embeddings?: unknown;
  agentId?: number | null;
}

type CreateKnowledgeDocument = KnowledgeDocumentBase & {
  metadata: KnowledgeDocumentMetadata;
  content: string;
  agentId?: number;
};

interface KnowledgeDocument extends CreateKnowledgeDocument {
  id: number;
  createdAt: string;
  updatedAt: string;
  embeddings?: unknown;
}

interface VoiceChatSession {
  user_id: number;
  started_at: string;
  duration?: number;
  agent_response: string | null;
}

interface WebsiteCrawl {
  id: number;
  status: "pending" | "completed" | "failed";
  url: string;
  documentId?: number;
  agentId?: number;
  error?: string;
  createdAt: string;
  scheduledAt?: string;
  completedAt?: string;
}

// Add FirecrawlData interface
interface FirecrawlData {
  content: string;
  pageCount?: number;
  stats?: Record<string, any>;
  evaluationResult?: {
    crawlMetadata?: WebsiteCrawlMetadata;
    pageContents?: PageContent[];
  };
  description?: string;
  pages?: Array<{ path: string; title: string }>;
  services?: Array<{ title: string; description?: string }>;
  crawlConfig?: {
    depth?: number;
    maxPages?: number;
    filters?: string[];
  };
}

// Add page content extraction helpers
async function extractPageContent(document: Document): Promise<PageData> {
  // Extract page URL and title
  const url = document.location.href;
  const title = document.querySelector("title")?.textContent?.trim() || "";

  // Extract all headings with their content
  const headings = Array.from(
    document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
  ).map((heading) => {
    const level = parseInt(heading.tagName[1]);
    const text = heading.textContent?.trim() || "";
    let content = "";

    // Get content until next heading
    let nextEl = heading.nextElementSibling;
    while (nextEl && !nextEl.tagName.match(/^H[1-6]$/)) {
      content += nextEl.textContent?.trim() + "\n";
      nextEl = nextEl.nextElementSibling;
    }

    return {
      level,
      text,
      content: content.trim(),
    };
  });

  // Extract sections with services
  const sections = Array.from(
    document.querySelectorAll(
      'section, [class*="section"], [class*="content"]',
    ),
  ).map((section) => {
    const title =
      section.querySelector("h1, h2, h3, h4, h5, h6")?.textContent?.trim() ||
      "";
    let content = "";
    const services: Array<{
      name: string;
      description: string;
      features: string[];
    }> = [];

    // Extract service blocks
    const serviceBlocks = section.querySelectorAll(
      '[class*="service"], [class*="feature"], .card',
    );
    serviceBlocks.forEach((block) => {
      const name =
        block
          .querySelector("h2, h3, h4, h5, h6, strong")
          ?.textContent?.trim() || "";
      const description = block.querySelector("p")?.textContent?.trim() || "";
      const features = Array.from(block.querySelectorAll("ul li, ol li"))
        .map((li) => li.textContent?.trim())
        .filter(
          (text): text is string => typeof text === "string" && text.length > 0,
        );

      if (name) {
        services.push({ name, description, features });
      }
    });

    // Get main content
    const contentElements = section.querySelectorAll("p, article");
    contentElements.forEach((el) => {
      content += el.textContent?.trim() + "\n";
    });

    return {
      title,
      content: content.trim(),
      services: services.length > 0 ? services : undefined,
    };
  });

  return {
    url,
    title,
    headings,
    sections,
  };
}

function createCrawlerConfig(
  crawlData: WebsiteCrawlOptions & { url: string },
): Record<string, any> {
  return {
    depth: crawlData.crawlConfig?.depth || 2,
    maxPages: crawlData.crawlConfig?.maxPages || 10,
    selector: 'article, section, p, h1, h2, h3, h4, h5, h6, [class*="content"]',
    javascript: true,
    navigationTimeout: 30000,
    renderTimeout: 20000,

    evaluateOnNewDocument: `
      // Monitor React initialization
      window.reactIsLoaded = false;
      Object.defineProperty(window, 'React', {
        get: () => window._React,
        set: (value) => {
          window._React = value;
          window.reactIsLoaded = true;
        },
        configurable: true
      });

      // Track processed pages and content
      window.processedPages = new Set();
      window.pageContents = [];

      // Extract content from the current page
      async function processPage() {
        const url = window.location.href;
        if (window.processedPages.has(url)) return;
        
        window.processedPages.add(url);
        
        try {
          // Get page title and basic details
          const title = document.title || document.querySelector('h1')?.textContent?.trim() || '';
          
          // Extract all sections
          const sections = [];
          const contentAreas = document.querySelectorAll('section, article, [class*="content"], main, .main');
          
          contentAreas.forEach(area => {
            // Get section title
            const sectionTitle = area.querySelector('h1, h2, h3')?.textContent?.trim() || '';
            let sectionContent = '';
            const sectionServices = [];
            
            // Extract service blocks
            const serviceBlocks = area.querySelectorAll('[class*="service"], [class*="feature"], .card');
            serviceBlocks.forEach(block => {
              const name = block.querySelector('h2, h3, h4, strong')?.textContent?.trim() || '';
              const description = block.querySelector('p')?.textContent?.trim() || '';
              const features = Array.from(block.querySelectorAll('ul li, ol li'))
                .map(li => li.textContent?.trim())
                .filter(text => text && text.length > 0);
              
              if (name) {
                sectionServices.push({ name, description, features });
              }
            });
            
            // Get section content
            const contentElements = area.querySelectorAll('p');
            contentElements.forEach(el => {
              const text = el.textContent?.trim();
              if (text && text.length > 0) {
                sectionContent += text + '\n\n';
              }
            });
            
            if (sectionTitle || sectionContent || sectionServices.length > 0) {
              sections.push({
                title: sectionTitle,
                content: sectionContent.trim(),
                services: sectionServices.length > 0 ? sectionServices : undefined
              });
            }
          });
          
          // Extract heading structure
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(heading => {
            const level = parseInt(heading.tagName[1]);
            const text = heading.textContent?.trim() || '';
            let content = '';
            
            let nextEl = heading.nextElementSibling;
            while (nextEl && !nextEl.tagName.match(/^H[1-6]$/)) {
              const text = nextEl.textContent?.trim();
              if (text) content += text + '\n';
              nextEl = nextEl.nextElementSibling;
            }
            
            return { level, text, content: content.trim() };
          });
          
          // Add to page contents
          window.pageContents.push({
            url,
            title,
            sections,
            headings
          });
          
          // Find links to other pages
          const links = Array.from(document.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href'))
            .filter(href => 
              href && 
              !href.startsWith('#') && 
              !href.startsWith('tel:') && 
              !href.startsWith('mailto:') &&
              !href.includes('login') &&
              !href.includes('signup')
            )
            .map(href => new URL(href, window.location.href).href);
            
          window.pagesToCrawl = [...new Set([...window.pagesToCrawl || [], ...links])];
        } catch (error) {
          console.error('Error processing page:', error);
        }
      }

      // Initialize page tracking
      window.pagesToCrawl = [];
      processPage();
    `,

    waitForFunction: `
      async () => {
        await new Promise(resolve => setTimeout(resolve, 3500));
        
        try {
          if (!window.React && !document.querySelector('[data-reactroot]')) {
            console.log('Waiting for React...');
            return false;
          }

          const root = document.getElementById('root') || document.getElementById('app');
          if (!root) {
            console.log('Waiting for root...');
            return false;
          }

          const hasContent = root.querySelector('nav, main, section, article, [class*="content"]');
          if (!hasContent) {
            console.log('Waiting for content...');
            return false;
          }

          // Process page content
          await processPage();
          return true;
        } catch (error) {
          console.error('Error in waitForFunction:', error);
          return false;
        }
      }
    `,
    timeout: 90000,
    waitForSelector: "#root, #app, [data-reactroot]",
    waitUntil: ["networkidle0", "domcontentloaded"],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    headers: {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
    viewport: {
      width: 1920,
      height: 1080,
    },
  };
}

// Add helper function to convert Date to string
function dateToString(date: Date): string {
  return date.toISOString();
}

// Create knowledge document from crawl data
async function createKnowledgeDocumentFromCrawl(
  firecrawlData: FirecrawlData,
  crawlData: WebsiteCrawlOptions & { url: string },
): Promise<KnowledgeDocument> {
  // Get metadata from crawl result
  const metadata: WebsiteCrawlMetadata = {
    title: firecrawlData.evaluationResult?.crawlMetadata?.title || "",
    description: firecrawlData.description || "",
    pages:
      firecrawlData.pages?.map((p) => ({ ...p, type: "page" as const })) || [],
    services:
      firecrawlData.services?.map((s) => ({
        title: s.title || "",
        description: s.description || "",
        features: [],
      })) || [],
    pageContents: [],
    crawledAt: new Date().toISOString(),
    pageCount: firecrawlData.pageCount || 1,
    crawlStats: firecrawlData.stats || {},
    lastAnalyzed: new Date().toISOString(),
  };

  // Get extracted page contents from each crawled page
  const pageContents = (firecrawlData.evaluationResult?.pageContents || [])
    .filter(
      (content): content is ExtractedPageContent =>
        !!content && typeof content === "object",
    )
    .map((content) => ({
      url: content.url || "",
      title: content.title || "",
      headings: content.headings || [
        {
          level: content.level || 1,
          text: content.title || "",
          content: content.content || "",
        },
      ],
      sections: content.sections || [
        {
          title: content.title || "",
          content: content.content || "",
          services: undefined,
          features: content.features || [],
        },
      ],
    }));

  // Create formatted content with detailed page information
  const content = formatDocument(
    metadata,
    firecrawlData.content || "",
    pageContents,
  );

  // Convert service data to correct format
  const convertedServices = pageContents
    .flatMap((page) =>
      page.sections
        .filter((section) => section.services?.length)
        .flatMap((section) => section.services || []),
    )
    .map((svc) => ({
      title: svc.name,
      description: svc.description,
      features: svc.features,
    })) as Service[];

  // Convert page content to correct format
  const convertedPageContents = pageContents.map((page) => ({
    title: page.title,
    content: page.sections.map((s) => s.content).join("\n\n"),
    level: page.headings[0]?.level || 1,
    features: page.sections.flatMap((s) => s.features || []),
  })) as PageContent[];

  // Create enriched metadata with proper types
  const enrichedMetadata: WebsiteCrawlMetadata = {
    title: metadata.title,
    description: metadata.description,
    pages: metadata.pages,
    services: [...metadata.services, ...convertedServices].filter(
      (s): s is Service =>
        typeof s === "object" &&
        s !== null &&
        typeof s.title === "string" &&
        s.title.length > 0,
    ),
    pageContents: [...metadata.pageContents, ...convertedPageContents].filter(
      (p): p is PageContent =>
        typeof p === "object" &&
        p !== null &&
        typeof p.title === "string" &&
        typeof p.content === "string",
    ),
    crawledAt: new Date().toISOString(),
    pageCount: metadata.pageCount,
    crawlStats: metadata.crawlStats || {},
    lastAnalyzed: new Date().toISOString(),
  };

  // Create storage input with properly typed metadata
  type StorageInput = {
    name: string;
    type: "website";
    source: string;
    content: string;
    metadata: KnowledgeDocumentMetadata;
    agentId?: number;
  };

  const storageInput: StorageInput = {
    name: `Website: ${metadata.title || new URL(crawlData.url).hostname}`,
    type: "website",
    source: crawlData.url,
    content,
    metadata: enrichedMetadata,
    agentId:
      typeof crawlData.agentId === "number" ? crawlData.agentId : undefined,
  };

  // Create document via storage with typed input
  const knowledgeDoc = await storage.createKnowledgeDocument(storageInput);

  // Convert storage result to KnowledgeDocument format
  return {
    ...knowledgeDoc,
    id: typeof knowledgeDoc.id === "number" ? knowledgeDoc.id : -1,
    createdAt:
      knowledgeDoc.createdAt instanceof Date
        ? knowledgeDoc.createdAt.toISOString()
        : String(knowledgeDoc.createdAt),
    updatedAt:
      knowledgeDoc.updatedAt instanceof Date
        ? knowledgeDoc.updatedAt.toISOString()
        : String(knowledgeDoc.updatedAt),
    agentId: knowledgeDoc.agentId ?? undefined,
    metadata: knowledgeDoc.metadata as KnowledgeDocumentMetadata,
    content: String(knowledgeDoc.content),
  } satisfies KnowledgeDocument;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Create HTTP server first
  const httpServer = createServer(app);

  // WebSocket server configuration
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws/transcription",
    verifyClient: async (info, callback) => {
      try {
        const cookies = parseCookie(info.req.headers.cookie || "");
        const sessionId = cookies["connect.sid"];

        if (!sessionId) {
          console.log("WebSocket connection rejected: No session cookie");
          callback(false, 401, "Unauthorized - No session cookie");
          return;
        }

        // Log non-sensitive connection details
        console.log("WebSocket connection attempt:", {
          path: info.req.url,
          headers: {
            cookie: "present",
            origin: info.origin,
            host: info.req.headers.host,
          },
        });

        callback(true);
      } catch (error) {
        console.error(
          "WebSocket verification error:",
          error instanceof Error ? error.message : "Unknown error",
        );
        callback(false, 500, "Internal server error");
      }
    },
  });

  // Track WebSocket connections
  let connectionCount = 0;

  // Add conversation handler with strict website-only responses
  async function generateWebsiteResponse(
    transcript: string,
    agentDocuments: Array<
      KnowledgeDocument & { metadata: KnowledgeDocumentMetadata }
    >,
  ) {
    type ValidatedDocument = KnowledgeDocument & {
      metadata: KnowledgeDocumentMetadata & {
        services: Service[];
        description: string;
      };
    };
    // Extract key terms from user query
    const queryTerms = new Set(transcript.toLowerCase().split(/\W+/));

    // Check if query is about services
    const isServiceQuery =
      queryTerms.has("service") || queryTerms.has("services");

    // Build response context from website content
    const websiteContent = agentDocuments.map((doc) => {
      const metadata = doc.metadata as KnowledgeDocumentMetadata;
      return {
        title: metadata?.title || "",
        services: metadata?.services || [],
        pages: metadata?.pages || [],
        content: doc.content || "",
      };
    });

    // Create system prompt with strict website-only instruction
    const systemPrompt = `You are a website assistant with access ONLY to information about ${websiteContent[0]?.title || "this website"}. 
Follow these rules strictly:
1. ONLY provide information that exists in the website content
2. If asked about services, ALWAYS start with "Service available on: [page names]"
3. For any question not about website content, respond ONLY with "I can only provide information about the website content and services."
4. Keep responses under 2 sentences
5. Never make assumptions or add information not in the website content`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "system",
          content: `Available website content:\n${JSON.stringify(websiteContent, null, 2)}`,
        },
        { role: "user", content: transcript },
      ],
      temperature: 0.5,
      max_tokens: 100,
      stop: ["I don't know", "I'm not sure", "I cannot"],
    });

    return (
      completion.choices[0].message.content ||
      "I can only provide information about the website content and services."
    );
  }

  // Define contexts map for conversation tracking
  const contexts = new Map<string, Array<ConversationMessage>>();

  wss.on("connection", async (ws, req) => {
    const currentConnection = ++connectionCount;
    console.log(`New WebSocket connection established #${currentConnection}`);

    try {
      // Extract session cookie and authenticate
      const cookies = parseCookie(req.headers.cookie || "");
      const sessionId = cookies["connect.sid"];

      // Extract session ID from URL path for voice chat
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const urlParts = url.pathname.split("/");
      const agentId = urlParts[urlParts.length - 2];
      const currentSessionId = urlParts[urlParts.length - 1];

      if (!currentSessionId) {
        console.error("No voice chat session ID provided");
        ws.close(1008, "Session ID required");
        return;
      }

      // Get agent and verify it exists
      const agent = await storage.getAgent(Number(agentId));
      if (!agent) {
        console.error(`Agent ${agentId} not found`);
        ws.close(1008, "Agent not found");
        return;
      }

      // Get documents and create conversation context
      const rawDocuments = await storage.getKnowledgeDocuments();
      const documents = rawDocuments.map((doc) => ({
        ...doc,
        createdAt:
          doc.createdAt instanceof Date
            ? doc.createdAt.toISOString()
            : doc.createdAt,
        updatedAt:
          doc.updatedAt instanceof Date
            ? doc.updatedAt.toISOString()
            : doc.updatedAt,
        agentId: doc.agentId ?? undefined,
        metadata: doc.metadata as KnowledgeDocumentMetadata | undefined,
        content: doc.content || "",
      })) as KnowledgeDocument[];

      const agentDocuments = documents.filter(
        (doc) => doc.agentId === agent.id,
      );
      const { systemInstructions, servicesContext } =
        await createConversationContext(agentDocuments, agent);

      // Initialize conversation with focused context
      const messages: ConversationMessage[] = [
        {
          role: "system",
          content: `${systemInstructions}\n\nService Information:\n${servicesContext}`,
        },
      ];

      // Store context for this session
      contexts.set(currentSessionId, messages);

      // Get current conversation messages
      const currentMessages = contexts.get(currentSessionId) || [];

      // Add user message and generate response
      const generateResponse = async (transcript: string) => {
        // Add user message
        currentMessages.push({ role: "user", content: transcript });

        // Send to OpenAI with strict content focus
        const completion = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            {
              role: "system",
              content: `${systemInstructions}\n\nService Information:\n${servicesContext}\n\nOnly respond with website information. For unrelated questions, say "I can only provide information about the website content and services."`,
            },
            ...currentMessages,
          ].map((msg) => ({
            role:
              msg.role === "system"
                ? ("system" as const)
                : msg.role === "user"
                  ? ("user" as const)
                  : ("assistant" as const),
            content: msg.content,
          })),
          temperature: 0.7,
          max_tokens: 150, // Keep responses concise
          stop: ["I don't know", "I am not sure", "I cannot"], // Prevent uncertain responses
        });

        const aiResponse = completion.choices[0].message.content;
        if (!aiResponse) {
          throw new Error("No AI response generated");
        }
        return aiResponse;
      };

      // Create greeting message
      let greetingMessage = "";
      if (agentDocuments.length > 0) {
        const websiteDoc = agentDocuments[0];
        const websiteName = websiteDoc.name.replace(/^Website: /, "");
        const metadata = websiteDoc.metadata as KnowledgeDocumentMetadata;
        const description = metadata?.description?.split(".")[0] || "";

        const allServices: Service[] = agentDocuments.flatMap((doc) => {
          const docMetadata = doc.metadata as KnowledgeDocumentMetadata;
          return (docMetadata?.services || []).filter(
            (service): service is Service =>
              service !== null &&
              typeof service === "object" &&
              "title" in service &&
              typeof service.title === "string" &&
              service.title.length > 0,
          );
        });

        let servicesList = "";
        if (allServices.length > 0) {
          const MAX_SERVICES = 3;
          servicesList = allServices
            .slice(0, MAX_SERVICES)
            .map((service) => service.title)
            .join(", ");

          if (allServices.length > MAX_SERVICES) {
            servicesList += ` and ${allServices.length - MAX_SERVICES} more services`;
          }
        }

        greetingMessage =
          `👋 Hi! I'm your ${websiteName} assistant${description ? ` - ${description}` : ""}. ` +
          (servicesList ? `I can help you with ${servicesList}. ` : "") +
          "How may I assist you today?";
      } else {
        greetingMessage = `Hello! I'm ${agent.name}, your AI assistant. How can I help you today?`;
      }

      // Send initial greeting
      ws.send(
        JSON.stringify({
          type: "transcription",
          text: greetingMessage,
          isFinal: true,
        } as WSMessage),
      );

      // Convert greeting to speech if voice is enabled
      if (agent.voiceId) {
        try {
          const synthesisResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${agent.voiceId}`,
            {
              method: "POST",
              headers: {
                Accept: "audio/mpeg",
                "xi-api-key": process.env.ELEVENLABS_API_KEY!,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: greetingMessage,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                  stability: 0.75,
                  similarity_boost: 0.75,
                },
              }),
            },
          );

          if (!synthesisResponse.ok) {
            const errorText = await synthesisResponse.text();
            console.error("ElevenLabs synthesis error:", {
              status: synthesisResponse.status,
              text: errorText,
            });
            throw new Error(
              `Failed to synthesize speech: ${synthesisResponse.statusText}`,
            );
          }

          const audioBuffer = await synthesisResponse.arrayBuffer();
          const audioBase64 = Buffer.from(audioBuffer).toString("base64");

          // Send audio greeting
          ws.send(
            JSON.stringify({
              type: "audio",
              audio: audioBase64,
            } as WSMessage),
          );
        } catch (error) {
          console.error("Error synthesizing greeting:", error);
        }
      }

      // Handle incoming messages
      ws.on("message", async (message: Buffer) => {
        try {
          if (!process.env.DEEPGRAM_API_KEY) {
            throw new Error("Deepgram API key not configured");
          }

          // Extract query parameters for Deepgram
          const encoding = "webm";
          const mimetype = "audio/webm;codecs=opus";

          // Send audio chunk to Deepgram for real-time transcription
          // const deepgramUrl = `https://api.deepgram.com/v1/listen?encoding=${encoding}&language=en-US&punctuate=true&interim_results=true`;
          const response = await fetch(deepgramUrl, {
            method: "POST",
            headers: {
              Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
              "Content-Type": mimetype,
            },
            body: message,
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Deepgram API error:", {
              status: response.status,
              text: errorText,
            });
            throw new Error(`Deepgram API error: ${response.statusText}`);
          }

          const transcriptionData = await response.json();
          const transcript =
            transcriptionData.results?.channels[0]?.alternatives[0]?.transcript;

          if (transcript && transcript.trim()) {
            // Send transcription back to client
            ws.send(
              JSON.stringify({
                type: "transcription",
                text: transcript,
                isFinal: transcriptionData.is_final || false,
              } as WSMessage),
            );

            // If transcription is final, generate AI response
            if (transcriptionData.is_final) {
              if (!process.env.OPENAI_API_SECRET) {
                throw new Error("OpenAI API key not configured");
              }

              // Initialize OpenAI client
              const openai = new OpenAI({
                apiKey: process.env.OPENAI_API_SECRET,
              });

              // Get current conversation messages
              const currentMessages = contexts.get(currentSessionId) || [];

              // Add user message
              currentMessages.push({
                role: "user" as const,
                content: transcript,
              });

              // Send to OpenAI with strict content focus
              const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                  {
                    role: "system",
                    content: `${systemInstructions}\n\nService Information:\n${servicesContext}\n\nOnly respond with website information. For unrelated questions, say "I can only provide information about the website content and services."`,
                  },
                  ...currentMessages,
                ].map((msg) => ({
                  role:
                    msg.role === "system"
                      ? ("system" as const)
                      : msg.role === "user"
                        ? ("user" as const)
                        : ("assistant" as const),
                  content: msg.content,
                })),
                temperature: 0.7,
                max_tokens: 150, // Keep responses concise
                stop: ["I don't know", "I am not sure", "I cannot"], // Prevent uncertain responses
              });

              const aiResponse = completion.choices[0].message.content;
              if (!aiResponse) {
                throw new Error("No AI response generated");
              }

              // Add AI response to context
              currentMessages.push({
                role: "assistant" as const,
                content: aiResponse,
              });
              contexts.set(currentSessionId, currentMessages);

              // Send text response to client
              ws.send(
                JSON.stringify({
                  type: "response",
                  text: aiResponse,
                } as WSMessage),
              );

              // Convert AI response to speech if voice enabled
              if (agent.voiceId) {
                try {
                  const synthesisResponse = await fetch(
                    `https://api.elevenlabs.io/v1/text-to-speech/${agent.voiceId}`,
                    {
                      method: "POST",
                      headers: {
                        Accept: "audio/mpeg",
                        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        text: aiResponse,
                        model_id: "eleven_monolingual_v1",
                        voice_settings: {
                          stability: 0.75,
                          similarity_boost: 0.75,
                        },
                      }),
                    },
                  );

                  if (!synthesisResponse.ok) {
                    const errorText = await synthesisResponse.text();
                    console.error("ElevenLabs synthesis error:", {
                      status: synthesisResponse.status,
                      text: errorText,
                    });
                    throw new Error("Failed to synthesize speech");
                  }

                  const audioBuffer = await synthesisResponse.arrayBuffer();
                  const audioBase64 =
                    Buffer.from(audioBuffer).toString("base64");

                  ws.send(
                    JSON.stringify({
                      type: "audio",
                      audio: audioBase64,
                    } as WSMessage),
                  );
                } catch (error) {
                  console.error("Error synthesizing speech:", error);
                }
              }
            }
          }
        } catch (error) {
          console.error(
            `Error processing message (connection #${currentConnection}):`,
            error,
          );
          ws.send(
            JSON.stringify({
              type: "error",
              error:
                error instanceof Error ? error.message : "Processing failed",
            } as WSMessage),
          );
        }
      });

      // Handle connection close
      ws.on("close", () => {
        console.log(`WebSocket connection #${currentConnection} closed`);
        contexts.delete(currentSessionId);
      });
    } catch (error) {
      console.error(`WebSocket error (connection #${currentConnection}):`, {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      ws.close(1011, "Internal server error");
    }
  });

  // Create a shared OpenAI instance
  if (!process.env.OPENAI_API_SECRET) {
    throw new Error("OpenAI API key not configured");
  }
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_SECRET,
  });

  // Add API endpoints
  app.post("/api/process", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userText = req.body.text;
      const language = req.body.language || "en-US";

      const chatResponse = await openai.chat.completions.create({
        messages: [{ role: "user", content: userText }],
        model: "gpt-4-turbo-preview",
      });

      const response = chatResponse.choices[0].message.content;
      if (!response) {
        throw new Error("No response generated");
      }

      res.json({
        reply: response,
        language,
      });
    } catch (error) {
      console.error("Process error:", error);
      res.status(500).json({
        error: "Failed to process response",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/voice-chat", async (req: Request, res: Response) => {
    try {
      console.log("Voice chat request from user:", req.user?.id);

      if (!req.isAuthenticated()) {
        console.log("Unauthenticated voice chat request rejected");
        return res.status(401).json({ error: "Not authenticated" });
      }

      const agent = await storage.getAgent(Number(req.body.agentId));
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Get knowledge documents for this agent
      const documents = await storage.getKnowledgeDocuments();
      const agentDocuments = documents.filter(
        (doc) => doc.agentId === agent.id,
      );

      // Prepare the context from documents
      let documentContext = "";
      let servicesContext = "";
      let greetingContext = "";
      let greetingMessage = "";

      if (agentDocuments.length > 0) {
        // Extract all services from documents
        const allServices = agentDocuments
          .flatMap((doc) => doc.metadata?.services || [])
          .filter((service) => service?.title);

        // Get website names and descriptions
        const websiteInfo = agentDocuments.map((doc) => ({
          name: doc.name.replace(/^Website: /, ""),
          description: doc.metadata?.description || "",
        }));

        // Create greeting context
        const websiteName = websiteInfo.map((info) => info.name).join(" and ");
        const description = websiteInfo[0]?.description;

        greetingMessage =
          `👋 Hi! I'm your ${websiteName} assistant${description ? ` - ${description.split(".")[0]}` : ""}. ` +
          (allServices.length > 0
            ? `I can help you with ${allServices
                .slice(0, 3)
                .map((service) => service.title)
                .join(", ")}.`
            : "") +
          " How may I assist you today?";

        greetingContext =
          `👋 Welcome to ${websiteName}!\n\n` +
          (description ? `${description}\n\n` : "") +
          "I'm your dedicated AI assistant here to help you.";

        // Create services context if available
        if (allServices.length > 0) {
          servicesContext =
            "\n\nI can assist you with the following services:\n" +
            allServices
              .map(
                (service) =>
                  `• ${service.title}${service.description ? ` - ${service.description}` : ""}`,
              )
              .join("\n");

          servicesContext +=
            "\n\nHow can I help you with any of these services today?";
        }

        // Create knowledge context for the AI
        documentContext =
          "\n\nKnowledge Base Context:\n" +
          agentDocuments.map((doc) => doc.content).join("\n\n");
      } else {
        // Default greeting when no documents are assigned
        greetingMessage = `Hello! I'm ${agent.name}, your AI assistant. How can I help you today?`;
        greetingContext = `You are ${agent.name}, a helpful AI assistant.`;
      }

      // Use shared OpenAI instance for chat generation

      const basePrompt =
        "You are a knowledgeable AI assistant. Provide warm, helpful, and accurate responses.";
      const systemPrompt =
        `${basePrompt}\n\n${greetingContext}${servicesContext}${documentContext}\n\n` +
        "Instructions:\n" +
        "1. For the first message, always start with the greeting and introduce the available services.\n" +
        "2. Base your responses on the knowledge base information provided.\n" +
        "3. If asked about a service, provide detailed information from the knowledge base.\n" +
        "4. Keep responses friendly and professional.\n" +
        "5. If you don't have specific information in the knowledge base, be honest about it.";

      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: req.body.message },
        ],
      });

      const chatResponse = completion.choices[0].message.content;

      if (!chatResponse) {
        throw new Error("No response generated");
      }

      // Voice synthesis using ElevenLabs
      if (!agent.voiceId) {
        throw new Error("No voice selected for agent");
      }

      if (!process.env.ELEVENLABS_API_KEY) {
        throw new Error("ElevenLabs API key not configured");
      }

      console.log(
        "Converting chat response to speech with ElevenLabs using voice ID:",
        agent.voiceId,
      );

      const synthesisResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${agent.voiceId}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: chatResponse,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.75,
            },
          }),
        },
      );

      if (!synthesisResponse.ok) {
        const errorText = await synthesisResponse.text();
        console.error("ElevenLabs synthesis error:", {
          status: synthesisResponse.status,
          text: errorText,
        });
        throw new Error("Failed to synthesize speech");
      }

      const audioBuffer = await synthesisResponse.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      // Send both the chat text and audio response
      res.json({
        text: chatResponse,
        audio: audioBase64,
      });
    } catch (error) {
      console.error("Error in chat and voice:", error);
      res.status(400).json({
        error: "Failed to process chat and voice",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Chat endpoint for text-based interaction
  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const agent = await storage.getAgent(Number(req.body.agentId));
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Get knowledge documents and prepare greeting
      const documents = await storage.getKnowledgeDocuments();
      const agentDocuments = documents.filter(
        (doc) => doc.agentId === agent.id,
      );

      // Prepare the context and greeting
      let documentContext = "";
      let servicesContext = "";
      let greetingContext = "";
      let greetingMessage = "";

      if (agentDocuments.length > 0) {
        // Extract all services from documents
        const allServices = agentDocuments
          .flatMap((doc) => doc.metadata?.services || [])
          .filter((service) => service?.title);

        // Get website names and descriptions
        const websiteInfo = agentDocuments.map((doc) => ({
          name: doc.name.replace(/^Website: /, ""),
          description: doc.metadata?.description || "",
        }));

        // Create greeting context
        const websiteName = websiteInfo.map((info) => info.name).join(" and ");
        const description = websiteInfo[0]?.description;

        greetingContext =
          `You are a knowledgeable AI assistant for ${websiteName}.\n` +
          (description ? `${description}\n` : "");

        greetingMessage =
          `👋 Hi! I'm your ${websiteName} assistant${description ? ` - ${description.split(".")[0]}` : ""}. ` +
          (allServices.length > 0
            ? `I can help you with ${allServices
                .slice(0, 3)
                .map((service) => service.title)
                .join(", ")}.`
            : "") +
          " How may I assist you today?";

        if (allServices.length > 0) {
          servicesContext =
            "\nYou can assist with these services:\n" +
            allServices
              .map(
                (service) =>
                  `• ${service.title}${service.description ? ` - ${service.description}` : ""}`,
              )
              .join("\n");

          greetingMessage +=
            "\n\nI can assist you with the following services:\n" +
            allServices
              .map(
                (service) =>
                  `• ${service.title}${service.description ? ` - ${service.description}` : ""}`,
              )
              .join("\n") +
            "\n\nHow can I help you with any of these services today?";
        }

        // Create knowledge context for the AI
        documentContext =
          "\nKnowledge Base Context:\n" +
          agentDocuments.map((doc) => doc.content).join("\n\n");
      } else {
        // Default greeting when no documents are assigned
        greetingMessage = `Hello! I'm ${agent.name}, your AI assistant. How can I help you today?`;
        greetingContext = `You are ${agent.name}, a helpful AI assistant.`;
      }

      // Use shared OpenAI instance

      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content:
              `${greetingContext}${servicesContext}${documentContext}\n\n` +
              "Instructions:\n" +
              "1. Base your responses on the knowledge base information provided.\n" +
              "2. If asked about a service, provide detailed information from the knowledge base.\n" +
              "3. Keep responses friendly and professional.\n" +
              "4. If you don't have specific information in the knowledge base, be honest about it.",
          },
          { role: "user", content: req.body.message },
        ] as any,
      });

      const response = completion.choices[0].message.content;

      if (!response) {
        throw new Error("No response generated");
      }

      res.json({ response });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({
        error: "Failed to generate response",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Agent routes
  app.get("/api/agents", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const agents = await storage.getAgentsByUserId(req.user.id);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.post("/api/agents", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      console.log("Received agent creation request:", req.body);
      const validatedData = insertAgentSchema.parse(req.body);

      // Ensure the agent is created for the authenticated user
      const agent = await storage.createAgent({
        ...validatedData,
        userId: req.user.id,
        type: validatedData.type || "ai",
        isActive: validatedData.isActive ?? true,
        voiceId: validatedData.voiceId || null,
      });

      console.log("Created agent:", agent);
      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid agent data",
      });
    }
  });

  app.get("/api/agents/:id", async (req: Request, res: Response) => {
    const agent = await storage.getAgent(Number(req.params.id));
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json(agent);
  });

  app.patch("/api/agents/:id", async (req: Request, res: Response) => {
    try {
      const agent = await storage.getAgent(Number(req.params.id));
      if (!agent) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }

      const updatedAgent = await storage.updateAgent(Number(req.params.id), {
        ...agent,
        ...req.body,
      });

      res.json(updatedAgent);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  // Website crawling routes
  app.post("/api/crawl", async (req: Request, res: Response) => {
    try {
      console.log("Received crawl request for URL:", req.body.url);
      const crawlData = insertWebsiteCrawlSchema.parse(req.body);

      // Verify user exists before creating crawl
      if (!crawlData.userId) {
        console.error("No user ID provided in request");
        return res.status(400).json({ error: "User ID is required" });
      }

      const userExists = await storage.getUser(Number(crawlData.userId));
      if (!userExists) {
        console.error(`User with ID ${crawlData.userId} not found`);
        return res.status(400).json({
          error: "Invalid user ID",
          details: "User not found in database",
        });
      }

      // First create a crawl record with pending status
      const crawl = await storage.createWebsiteCrawl({
        url: crawlData.url,
        status: "pending",
        userId: userExists.id,
        agentId: crawlData.agentId || null,
        scheduledAt: crawlData.scheduledAt,
        scheduleRecurrence: crawlData.scheduleRecurrence,
      });

      try {
        // Validate URL format
        let baseUrl;
        try {
          baseUrl = new URL(crawlData.url);
          // Ensure protocol is specified
          if (!baseUrl.protocol) {
            baseUrl = new URL(`https://${crawlData.url}`);
          }
        } catch (error) {
          throw new Error(`Invalid URL format: ${error.message}`);
        }

        // Call Firecrawl API with enhanced configuration for React apps
        const firecrawlUrl = "https://api.firecrawl.io/v1/crawl";
        console.log("Calling Firecrawl API for URL:", baseUrl.toString());

        const firecrawlResponse = await fetch(firecrawlUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
            Accept: "application/json",
          },
          body: JSON.stringify({
            url: baseUrl.toString(),
            depth: crawlData.crawlConfig?.depth || 2,
            maxPages: crawlData.crawlConfig?.maxPages || 10,
            // Enhanced selectors for React apps
            selector:
              "main, article, [role='main'], .main-content, .content, div[class*='content'], div[class*='main'], section, div[data-reactroot], div[id='root'], div[id='app'], p, h1, h2, h3, h4, h5, h6",
            filters: crawlData.crawlConfig?.filters || [],
            timeout: 90000, // 90 second timeout for SPAs
            waitForSelector: "#root, #app, [data-reactroot]", // Wait for React root
            waitUntil: ["networkidle0", "domcontentloaded"], // Wait for both network and DOM
            userAgent:
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            headers: {
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5",
              "Sec-Fetch-Dest": "document",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-Site": "none",
              "Sec-Fetch-User": "?1",
              "Upgrade-Insecure-Requests": "1",
            },
            viewport: {
              width: 1920,
              height: 1080,
            },
            javascript: true, // Enable JavaScript execution
            navigationTimeout: 30000, // 30 seconds navigation timeout
            renderTimeout: 20000, // 20 seconds render timeout
            // Extract metadata after React hydration
            evaluateOnNewDocument: `
              // Monitor React initialization
              window.reactIsLoaded = false;
              Object.defineProperty(window, 'React', {
                get: () => window._React,
                set: (value) => {
                  window._React = value;
                  window.reactIsLoaded = true;
                },
                configurable: true
              });

              // Extract metadata function
              window.extractMetadata = () => {
                const metadata = {
                  description: '',
                  pages: [],
                  services: []
                };

                // Get title and clean it
                const title = document.title || 
                            document.querySelector('h1')?.textContent?.trim() ||
                            document.querySelector('meta[property="og:title"]')?.content;
                metadata.title = title?.replace(/\s+/g, ' ').trim();

                // Get description from meta tags or first meaningful paragraph
                let description = document.querySelector('meta[name="description"]')?.content ||
                                document.querySelector('meta[property="og:description"]')?.content;
                
                if (!description) {
                  // Find first significant paragraph
                  const paragraphs = Array.from(document.querySelectorAll('p'));
                  const mainContent = document.querySelector('main, [role="main"], #root, #app');
                  const firstParagraph = (mainContent ? Array.from(mainContent.querySelectorAll('p')) : paragraphs)
                    .find(p => {
                      const text = p.textContent?.trim();
                      return text && text.length > 50 && !text.includes('©') && !text.includes('copyright');
                    });
                  description = firstParagraph?.textContent?.trim();
                }
                
                metadata.description = description?.replace(/\\s+/g, ' ').trim() || '';

                // Extract services/features
                const serviceSelectors = [
                  // Service-specific selectors
                  '[class*="service"]', '[class*="feature"]',
                  '[id*="service"]', '[id*="feature"]',
                  // Common component selectors
                  '.card', '.feature-card', '.service-card',
                  '[class*="service-item"]', '[class*="feature-item"]',
                  // React component naming patterns
                  '[class*="Service"]', '[class*="Feature"]',
                  '[data-testid*="service"]', '[data-testid*="feature"]'
                ];

                const serviceElements = document.querySelectorAll(serviceSelectors.join(','));
                const services = new Map();

                serviceElements.forEach(element => {
                  // Look for headings or strong text
                  const title = element.querySelector('h1, h2, h3, h4, h5, h6, strong')?.textContent?.trim();
                  if (!title || title.length < 3) return;
                  
                  // Get description from paragraphs or list items
                  const descElements = element.querySelectorAll('p, li');
                  let description = '';
                  descElements.forEach(el => {
                    const text = el.textContent?.trim();
                    if (text && text.length > 20) {
                      description += text + ' ';
                    }
                  });
                  
                  description = description.trim();
                  if (!services.has(title)) {
                    services.set(title, description);
                  }
                });

                metadata.services = Array.from(services).map(([title, description]) => ({
                  title,
                  description
                }));

                // Extract navigation links and clean them
                const navElements = document.querySelectorAll('nav, [role="navigation"], .nav, .navbar, header');
                const seenLinks = new Set();
                
                navElements.forEach(nav => {
                  const links = nav.querySelectorAll('a');
                  links.forEach(link => {
                    const href = link.getAttribute('href');
                    const text = link.textContent?.trim();
                    
                    // Skip invalid or duplicate links
                    if (!href || !text || 
                        href.startsWith('#') || 
                        href.startsWith('mailto:') || 
                        href.startsWith('tel:') ||
                        href.includes('login') ||
                        href.includes('signup') ||
                        seenLinks.has(href)) {
                      return;
                    }

                    seenLinks.add(href);
                    metadata.pages.push({
                      path: href,
                      title: text
                    });
                  });
                });

                return metadata;
              };

              // Monitor route changes for SPAs
              let lastPathname = window.location.pathname;
              const observer = new MutationObserver(() => {
                if (window.location.pathname !== lastPathname) {
                  lastPathname = window.location.pathname;
                  window.dispatchEvent(new CustomEvent('route-changed'));
                }
              });
              observer.observe(document.body, { childList: true, subtree: true });
            `,
            // Wait for React and extract metadata
            waitForFunction: `
              async () => {
                // Initial delay for React hydration
                await new Promise(resolve => setTimeout(resolve, 3500));

                // Check for React initialization
                if (!window.React && !document.querySelector('[data-reactroot]')) {
                  console.log('Waiting for React initialization...');
                  return false;
                }

                // Wait for root to be hydrated 
                const root = document.getElementById('root') || document.getElementById('app');
                if (!root) {
                  console.log('Waiting for root element...');
                  return false;
                }

                // Check for dynamic content loading
                const dynamicContentLoaded = root.querySelector('nav, main, section, article, [class*="content"]');
                if (!dynamicContentLoaded) {
                  console.log('Waiting for dynamic content...');
                  return false;
                }

                try {
                  // Extract metadata
                  ${extractWebsiteMetadata.toString()}
                  const metadata = extractWebsiteMetadata(document);
                  window.crawlMetadata = metadata;

                  // Validate required fields
                  if (!metadata.title || !metadata.description) {
                    console.log('Missing required metadata fields, retrying...');
                    return false;
                  }

                  // Validate services have descriptions
                  if (metadata.services?.length > 0) {
                    const hasDescriptions = metadata.services.every(s => s.description?.length > 20);
                    if (!hasDescriptions) {
                      console.log('Incomplete service descriptions, retrying...');
                      return false;
                    }
                  }

                  // Validate page links are valid
                  if (metadata.pages?.length > 0) {
                    const validPages = metadata.pages.every(p => 
                      p.path && p.title && 
                      !p.path.startsWith('#') &&
                      !p.path.startsWith('javascript:')
                    );
                    if (!validPages) {
                      console.log('Invalid page links found, retrying...');
                      return false;
                    }
                  }

                  return true;
                } catch (error) {
                  console.log('Error extracting metadata:', error);
                  return false;
                }
              }
            `,
            timeout: 90000, // 90 second timeout for SPAs
            waitForSelector: "#root, #app, [data-reactroot]", // Wait for React root
            waitUntil: ["networkidle0", "domcontentloaded"], // Wait for both network and DOM
            userAgent:
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            headers: {
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5",
              "Sec-Fetch-Dest": "document",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-Site": "none",
              "Sec-Fetch-User": "?1",
              "Upgrade-Insecure-Requests": "1",
            },
            viewport: {
              width: 1920,
              height: 1080,
            },
            javascript: true, // Enable JavaScript execution
            navigationTimeout: 30000, // 30 seconds navigation timeout
            renderTimeout: 20000, // 20 seconds render timeout
          }),
        });

        if (!firecrawlResponse.ok) {
          const errorText = await firecrawlResponse.text();
          console.error("Firecrawl API error:", {
            url: baseUrl.toString(),
            status: firecrawlResponse.status,
            text: errorText,
          });
          throw new Error(
            `Firecrawl API error: ${firecrawlResponse.statusText} - ${errorText}`,
          );
        }

        const firecrawlData = await firecrawlResponse.json();
        console.log(
          "Firecrawl API response received for URL:",
          baseUrl.toString(),
        );

        // Validate crawled content
        if (
          !firecrawlData.content ||
          firecrawlData.content.trim().length === 0
        ) {
          throw new Error("No content returned from Firecrawl API");
        }

        try {
          console.log("Attempting to extract metadata from crawled content");

          // Try to get metadata from the page evaluation
          let extractedMetadata = null;
          if (firecrawlData.evaluationResult?.crawlMetadata) {
            extractedMetadata = firecrawlData.evaluationResult.crawlMetadata;
            console.log("Successfully extracted metadata from browser:", {
              title: extractedMetadata.title,
              hasDescription: !!extractedMetadata.description,
              servicesCount: extractedMetadata.services?.length || 0,
              pagesCount: extractedMetadata.pages?.length || 0,
            });
          }

          // If browser extraction failed, try server-side extraction with JSDOM
          if (!extractedMetadata?.description) {
            console.log(
              "Browser metadata extraction failed, attempting server-side extraction",
            );
            const dom = new JSDOM(firecrawlData.content);
            const document = dom.window.document;

            // Extract metadata using DOM
            const titleMeta = document.querySelector(
              'meta[property="og:title"]',
            ) as HTMLMetaElement;
            const descMeta = document.querySelector(
              'meta[name="description"]',
            ) as HTMLMetaElement;
            const ogDescMeta = document.querySelector(
              'meta[property="og:description"]',
            ) as HTMLMetaElement;

            // Use same metadata extraction function as browser
            extractedMetadata = extractWebsiteMetadata(document);

            console.log("Server-side metadata extraction completed:", {
              title: extractedMetadata.title,
              hasDescription: !!extractedMetadata.description,
              servicesCount: extractedMetadata.services?.length || 0,
              pagesCount: extractedMetadata.pages?.length || 0,
            });
          }

          // Clean up and validate metadata
          const metadata = {
            crawledAt: new Date().toISOString(),
            pageCount: firecrawlData.pageCount || 1,
            crawlStats: firecrawlData.stats || {},
            title: extractedMetadata.title || baseUrl.hostname,
            description:
              extractedMetadata.description ||
              "A detailed analysis of this website's content and features.",
            pages: extractedMetadata.pages || [],
            services: extractedMetadata.services || [],
            lastAnalyzed: new Date().toISOString(),
          };

          // Create formatted content with sections
          const content = `# ${metadata.title}

## Introduction
${metadata.description}

${
  metadata.services.length > 0
    ? `## Services and Features\n${metadata.services
        .map(
          (service) =>
            `### ${service.title}\n${service.description || "No description available."}`,
        )
        .join("\n\n")}`
    : ""
}

${
  metadata.pages.length > 0
    ? `## Available Pages\n${metadata.pages
        .map((page) => `- [${page.title}](${page.path})`)
        .join("\n")}`
    : ""
}

## Technical Details
- Last crawled: ${metadata.crawledAt}
- Pages crawled: ${metadata.pageCount}
- Last analyzed: ${metadata.lastAnalyzed}

## Raw Content
${firecrawlData.content || ""}`;

          // Create a knowledge document with structured content
          const knowledgeDoc = await storage.createKnowledgeDocument({
            name: `Website: ${metadata.title}`,
            type: "website",
            source: baseUrl.toString(),
            content,
            metadata,
            agentId: crawlData.agentId || undefined,
          });

          console.log("Knowledge document created successfully:", {
            id: knowledgeDoc.id,
            name: knowledgeDoc.name,
            metadataPresent: !!knowledgeDoc.metadata,
            contentLength: knowledgeDoc.content?.length || 0,
          });

          // Update crawl status to completed
          await storage.updateWebsiteCrawl(crawl.id, {
            status: "completed",
            documentId: knowledgeDoc.id,
            completedAt: new Date().toISOString(),
          });

          res.status(201).json({ crawl, document: knowledgeDoc });
        } catch (error) {
          console.error("Error processing crawled content:", error);

          // Update crawl status to failed
          await storage.updateWebsiteCrawl(crawl.id, {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          });

          // Send a more detailed error response
          res.status(400).json({
            error: "Failed to process website content",
            details:
              error instanceof Error ? error.message : "Unknown error occurred",
            crawlId: crawl.id,
          });
        }
      } catch (error) {
        // Update crawl status to failed
        await storage.updateWebsiteCrawl(crawl.id, {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });

        // Send a more detailed error response
        res.status(400).json({
          error: "Failed to crawl website",
          details:
            error instanceof Error ? error.message : "Unknown error occurred",
          crawlId: crawl.id,
        });
      }
    } catch (error) {
      console.error("Crawl request error:", error);
      res.status(400).json({
        error: "Failed to process crawl request",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get crawls for an agent
  app.get("/api/crawl/:agentId", async (req: Request, res: Response) => {
    try {
      const agentId = Number(req.params.agentId);
      const crawls = await storage.getWebsiteCrawls(agentId);

      // Sort by scheduled date, with pending/scheduled first
      crawls.sort((a, b) => {
        // First sort by status (pending/scheduled first)
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;

        // Then sort by scheduled date
        const dateA = a.scheduledAt || a.createdAt;
        const dateB = b.scheduledAt || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      res.json(crawls);
    } catch (error) {
      console.error("Error fetching crawls:", error);
      res.status(500).json({ error: "Failed to fetch crawls" });
    }
  });

  app.get("/api/crawl/:id", async (req: Request, res: Response) => {
    try {
      const crawl = await storage.getWebsiteCrawl(Number(req.params.id));
      if (!crawl) {
        res.status(404).json({ error: "Crawl not found" });
        return;
      }
      res.json(crawl);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crawl data" });
    }
  });

  // Knowledge document routes
  app.post("/api/knowledge-documents", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const documentData = req.body;
      console.log("Creating knowledge document:", documentData);

      // Create the knowledge document
      const document = await storage.createKnowledgeDocument({
        name: documentData.name,
        type: documentData.type,
        source: documentData.source,
        content: documentData.content,
        metadata: documentData.metadata || null,
        agentId: documentData.agentId || null,
      });

      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating knowledge document:", error);
      res.status(400).json({
        error: "Failed to create knowledge document",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Update knowledge document
  app.patch(
    "/api/knowledge-documents/:id",
    async (req: Request, res: Response) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const documentId = Number(req.params.id);
        const updates = req.body;

        const document = await storage.updateKnowledgeDocument(
          documentId,
          updates,
        );
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }

        res.json(document);
      } catch (error) {
        console.error("Error updating knowledge document:", error);
        res.status(400).json({
          error: "Failed to update knowledge document",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Delete knowledge document
  app.delete(
    "/api/knowledge-documents/:id",
    async (req: Request, res: Response) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const documentId = Number(req.params.id);
        await storage.deleteKnowledgeDocument(documentId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting knowledge document:", error);
        res.status(400).json({
          error: "Failed to delete knowledge document",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Get knowledge documents
  app.get("/api/knowledge-documents", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const documents = await storage.getKnowledgeDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching knowledge documents:", error);
      res.status(500).json({
        error: "Failed to fetch knowledge documents",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Add ElevenLabs API route with proper implementation
  app.get("/api/voices", async (_req: Request, res: Response) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        console.warn("ELEVENLABS_API_KEY environment variable is not set");
        return res.json({
          voices: [],
          warning:
            "Voice selection is currently unavailable. Please configure ElevenLabs API key.",
        });
      }

      console.log("Fetching voices from ElevenLabs API with provided key...");
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          Accept: "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        return res.status(response.status).json({
          error: `Failed to fetch voices: ${response.statusText}`,
          details: errorText,
        });
      }

      const data = await response.json();
      console.log("ElevenLabs response:", data);

      if (!data.voices || !Array.isArray(data.voices)) {
        console.warn("Invalid response format from ElevenLabs API:", data);
        return res.json({
          voices: [],
          warning: "Invalid response from voice service",
        });
      }

      const voices = data.voices.map((voice: any) => ({
        id: voice.voice_id,
        name: voice.name,
        category: voice.category || "Other",
        description: voice.description || "",
        previewUrl: voice.preview_url,
        settings: voice.settings || {
          stability: 0.75,
          similarity_boost: 0.75,
        },
      }));

      console.log("Processed voices:", voices);
      res.json({ voices });
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to fetch voices",
      });
    }
  });

  // Chat Analytics Routes
  app.get("/api/analytics/chat", async (req: Request, res: Response) => {
    try {
      const timeRange = (req.query.timeRange as string) || "week";
      const now = new Date();
      let startDate = new Date();

      switch (timeRange) {
        case "day":
          startDate.setDate(now.getDate() - 1);
          break;
        case "week":
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      // Get all chat sessions within the time range
      const sessions = await storage.getVoiceChatSessions();
      const filteredSessions = sessions.filter(
        (session) =>
          new Date(session.started_at) >= startDate &&
          new Date(session.started_at) <= now,
      );

      // Calculate metrics
      const totalSessions = filteredSessions.length;
      const uniqueUsers = new Set(
        filteredSessions.map((session) => session.user_id),
      ).size;

      // Calculate average duration
      const durationsSum = filteredSessions.reduce(
        (sum, session) => sum + (session.duration || 0),
        0,
      );
      const averageDuration =
        totalSessions > 0 ? durationsSum / totalSessions : 0;

      // Calculate response rate (sessions with agent responses / total sessions)
      const sessionsWithResponses = filteredSessions.filter(
        (session) => session.agent_response !== null,
      ).length;
      const responseRate =
        totalSessions > 0 ? sessionsWithResponses / totalSessions : 0;

      // Group sessions by date
      const sessionsByDate = filteredSessions.reduce((acc: any[], session) => {
        const date = new Date(session.started_at).toISOString().split("T")[0];
        const existingEntry = acc.find((entry) => entry.date === date);

        if (existingEntry) {
          existingEntry.sessions += 1;
        } else {
          acc.push({ date, sessions: 1 });
        }

        return acc;
      }, []);

      // Fill in missing dates with zero sessions
      let currentDate = new Date(startDate);
      while (currentDate <= now) {
        const dateStr = currentDate.toISOString().split("T")[0];
        if (!sessionsByDate.find((entry) => entry.date === dateStr)) {
          sessionsByDate.push({ date: dateStr, sessions: 0 });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Sort by date
      sessionsByDate.sort((a, b) => a.date.localeCompare(b.date));

      res.json({
        totalSessions,
        averageDuration,
        totalUsers: uniqueUsers,
        responseRate,
        sessionsByDate,
      });
    } catch (error) {
      console.error("Error fetching chat analytics:", error);
      res.status(500).json({ error: "Failed to fetch chat analytics" });
    }
  });

  // Add the new text-to-speech endpoint
  app.post("/api/text-to-speech", async (req: Request, res: Response) => {
    try {
      // Authentication check
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { text, voiceId } = req.body;

      if (!text || !voiceId) {
        return res.status(400).json({ error: "Text and voiceId are required" });
      }

      if (!process.env.ELEVENLABS_API_KEY) {
        throw new Error("ElevenLabs API key not configured");
      }

      console.log("Converting text to speech with ElevenLabs:", {
        text,
        voiceId,
        timestamp: new Date().toISOString(),
      });

      const synthesisResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.75,
            },
          }),
        },
      );

      if (!synthesisResponse.ok) {
        const errorText = await synthesisResponse.text();
        console.error("ElevenLabs synthesis error:", {
          status: synthesisResponse.status,
          text: errorText,
        });
        throw new Error("Failed to synthesize speech");
      }

      console.log("Audio synthesis successful");

      const audioBuffer = await synthesisResponse.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      res.json({ audio: audioBase64 });
    } catch (error) {
      console.error("Text-to-speech error:", error);
      res.status(500).json({
        error: "Failed to convert text to speech",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/analyze-url", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      console.log("Analyzing URL:", url);

      // Validate URL format
      try {
        new URL(url);
      } catch (error) {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      // Fetch the webpage content with user agent to avoid being blocked
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch URL: ${response.status} ${response.statusText}`,
        );
      }

      const html = await response.text();
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Remove unwanted elements first
      document
        .querySelectorAll(
          'script, style, noscript, iframe, nav, footer, aside, [style*="display:none"], .social-share',
        )
        .forEach((el) => el.remove());

      // Extract title (try multiple sources)
      const title =
        document.querySelector("title")?.textContent?.trim() ||
        document.querySelector("h1")?.textContent?.trim() ||
        new URL(url).hostname;

      // Extract description (try multiple sources)
      let description =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") ||
        document
          .querySelector('meta[property="og:description"]')
          ?.getAttribute("content");

      if (!description) {
        // Try to get first significant paragraph
        const firstParagraph = Array.from(document.querySelectorAll("p")).find(
          (p) => {
            const text = p.textContent?.trim();
            return text && text.length > 50; // Only consider paragraphs with meaningful content
          },
        );
        description = firstParagraph?.textContent?.trim() || "";
      }

      // Find main content container
      const mainContentSelectors = [
        "main",
        "article",
        '[role="main"]',
        ".main-content",
        "#main-content",
        ".content",
        "#content",
        "body",
      ];

      let contentElement = null;
      for (const selector of mainContentSelectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
      }

      if (!contentElement) {
        contentElement = document.body;
      }

      // Clean up content element
      contentElement
        .querySelectorAll(
          'nav, footer, header, aside, .sidebar, [role="complementary"]',
        )
        .forEach((el) => el.remove());

      // Extract meaningful text content
      const textElements = contentElement.querySelectorAll(
        "p, h1, h2, h3, h4, h5, h6, li",
      );
      const mainContent = Array.from(textElements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 20) // Filter out short snippets
        .join("\n\n");

      // Extract and clean up internal links
      const baseUrl = new URL(url);
      const seen = new Set<string>();
      const pages = Array.from(document.querySelectorAll("a"))
        .map((link) => {
          const href = link.getAttribute("href");
          if (!href) return null;

          try {
            // Skip anchor links and non-http(s) protocols
            if (
              href.startsWith("#") ||
              href.startsWith("mailto:") ||
              href.startsWith("tel:") ||
              href.startsWith("javascript:")
            ) {
              return null;
            }

            // Convert relative to absolute URL
            const fullUrl = new URL(href, baseUrl);

            // Skip common social media and external links
            if (
              fullUrl.hostname !== baseUrl.hostname ||
              fullUrl.hostname.includes("facebook.com") ||
              fullUrl.hostname.includes("twitter.com") ||
              fullUrl.hostname.includes("instagram.com")
            ) {
              return null;
            }

            // Remove hash and query parameters for cleaner URLs
            fullUrl.hash = "";
            fullUrl.search = "";
            return fullUrl.href;
          } catch {
            return null;
          }
        })
        .filter((url): url is string => {
          if (!url || seen.has(url)) return false;
          seen.add(url);
          return true;
        });

      // Extract services and features
      const serviceKeywords = [
        "service",
        "product",
        "solution",
        "feature",
        "package",
        "plan",
        "offer",
      ];
      const services = Array.from(document.querySelectorAll("h2, h3, h4, h5"))
        .map((heading) => {
          const text = heading.textContent?.trim();
          if (
            !text ||
            !serviceKeywords.some(
              (keyword) =>
                text.toLowerCase().includes(keyword) ||
                (
                  heading.previousElementSibling?.textContent?.toLowerCase() ||
                  ""
                ).includes(keyword),
            )
          ) {
            return null;
          }

          let description = "";
          let nextElement = heading.nextElementSibling;
          let descriptionElements = 0;

          // Look for description in the next few elements
          while (nextElement && descriptionElements < 2) {
            if (
              nextElement.tagName === "P" ||
              nextElement.tagName === "UL" ||
              nextElement.tagName === "OL" ||
              nextElement.tagName === "DIV"
            ) {
              description += (nextElement.textContent?.trim() || "") + " ";
              descriptionElements++;
            }
            nextElement = nextElement.nextElementSibling;
          }

          return {
            title: text,
            description: description.trim(),
          };
        })
        .filter(
          (service): service is { title: string; description: string } =>
            service !== null && service.title.length > 0,
        );

      // Ensure we have valid data
      const analysisData = {
        title: title || "Untitled Page",
        description: description || "No description available",
        pages: pages.slice(0, 50), // Limit to 50 pages
        services: services.length > 0 ? services : [],
        content: mainContent || "",
      };

      console.log("Website analysis completed:", {
        url,
        title: analysisData.title,
        descriptionLength: analysisData.description.length,
        pagesFound: analysisData.pages.length,
        servicesFound: analysisData.services.length,
        contentLength: analysisData.content.length,
      });

      res.json(analysisData);
    } catch (error) {
      console.error("Error analyzing URL:", error);
      res.status(500).json({
        error: "Failed to analyze URL",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get crawls for an agent
  app.get("/api/crawl/:agentId", async (req: Request, res: Response) => {
    try {
      const agentId = Number(req.params.agentId);
      const crawls = await storage.getWebsiteCrawls(agentId);

      // Sort by scheduled date, with pending/scheduled first
      crawls.sort((a, b) => {
        // First sort by status (pending/scheduled first)
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;

        // Then sort by scheduled date
        const dateA = a.scheduledAt || a.createdAt;
        const dateB = b.scheduledAt || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      res.json(crawls);
    } catch (error) {
      console.error("Error fetching crawls:", error);
      res.status(500).json({ error: "Failed to fetch crawls" });
    }
  });

  app.get("/api/crawl/:id", async (req: Request, res: Response) => {
    try {
      const crawl = await storage.getWebsiteCrawl(Number(req.params.id));
      if (!crawl) {
        res.status(404).json({ error: "Crawl not found" });
        return;
      }
      res.json(crawl);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crawl data" });
    }
  });

  // Knowledge document routes
  app.post("/api/knowledge-documents", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const documentData = req.body;
      console.log("Creating knowledge document:", documentData);

      // Create the knowledge document
      const document = await storage.createKnowledgeDocument({
        name: documentData.name,
        type: documentData.type,
        source: documentData.source,
        content: documentData.content,
        metadata: documentData.metadata || null,
        agentId: documentData.agentId || null,
      });

      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating knowledge document:", error);
      res.status(400).json({
        error: "Failed to create knowledge document",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Update knowledge document
  app.patch(
    "/api/knowledge-documents/:id",
    async (req: Request, res: Response) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const documentId = Number(req.params.id);
        const updates = req.body;

        const document = await storage.updateKnowledgeDocument(
          documentId,
          updates,
        );
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }

        res.json(document);
      } catch (error) {
        console.error("Error updating knowledge document:", error);
        res.status(400).json({
          error: "Failed to update knowledge document",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Delete knowledge document
  app.delete(
    "/api/knowledge-documents/:id",
    async (req: Request, res: Response) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const documentId = Number(req.params.id);
        await storage.deleteKnowledgeDocument(documentId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting knowledge document:", error);
        res.status(400).json({
          error: "Failed to delete knowledge document",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Get knowledge documents
  app.get("/api/knowledge-documents", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const documents = await storage.getKnowledgeDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching knowledge documents:", error);
      res.status(500).json({
        error: "Failed to fetch knowledge documents",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Add ElevenLabs API route with proper implementation
  app.get("/api/voices", async (_req: Request, res: Response) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        console.warn("ELEVENLABS_API_KEY environment variable is not set");
        return res.json({
          voices: [],
          warning:
            "Voice selection is currently unavailable. Please configure ElevenLabs API key.",
        });
      }

      console.log("Fetching voices from ElevenLabs API with provided key...");
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          Accept: "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        return res.status(response.status).json({
          error: `Failed to fetch voices: ${response.statusText}`,
          details: errorText,
        });
      }

      const data = await response.json();
      console.log("ElevenLabs response:", data);

      if (!data.voices || !Array.isArray(data.voices)) {
        console.warn("Invalid response format from ElevenLabs API:", data);
        return res.json({
          voices: [],
          warning: "Invalid response from voice service",
        });
      }

      const voices = data.voices.map((voice: any) => ({
        id: voice.voice_id,
        name: voice.name,
        category: voice.category || "Other",
        description: voice.description || "",
        previewUrl: voice.preview_url,
        settings: voice.settings || {
          stability: 0.75,
          similarity_boost: 0.75,
        },
      }));

      console.log("Processed voices:", voices);
      res.json({ voices });
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to fetch voices",
      });
    }
  });

  // Chat Analytics Routes
  app.get("/api/analytics/chat", async (req: Request, res: Response) => {
    try {
      const timeRange = (req.query.timeRange as string) || "week";
      const now = new Date();
      let startDate = new Date();

      switch (timeRange) {
        case "day":
          startDate.setDate(now.getDate() - 1);
          break;
        case "week":
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      // Get all chat sessions within the time range
      const sessions = await storage.getVoiceChatSessions();
      const filteredSessions = sessions.filter(
        (session) =>
          new Date(session.started_at) >= startDate &&
          new Date(session.started_at) <= now,
      );

      // Calculate metrics
      const totalSessions = filteredSessions.length;
      const uniqueUsers = new Set(
        filteredSessions.map((session) => session.user_id),
      ).size;

      // Calculate average duration
      const durationsSum = filteredSessions.reduce(
        (sum, session) => sum + (session.duration || 0),
        0,
      );
      const averageDuration =
        totalSessions > 0 ? durationsSum / totalSessions : 0;

      // Calculate response rate (sessions with agent responses / total sessions)
      const sessionsWithResponses = filteredSessions.filter(
        (session) => session.agent_response !== null,
      ).length;
      const responseRate =
        totalSessions > 0 ? sessionsWithResponses / totalSessions : 0;

      // Group sessions by date
      const sessionsByDate = filteredSessions.reduce((acc: any[], session) => {
        const date = new Date(session.started_at).toISOString().split("T")[0];
        const existingEntry = acc.find((entry) => entry.date === date);

        if (existingEntry) {
          existingEntry.sessions += 1;
        } else {
          acc.push({ date, sessions: 1 });
        }

        return acc;
      }, []);

      // Fill in missing dates with zero sessions
      let currentDate = new Date(startDate);
      while (currentDate <= now) {
        const dateStr = currentDate.toISOString().split("T")[0];
        if (!sessionsByDate.find((entry) => entry.date === dateStr)) {
          sessionsByDate.push({ date: dateStr, sessions: 0 });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Sort by date
      sessionsByDate.sort((a, b) => a.date.localeCompare(b.date));

      res.json({
        totalSessions,
        averageDuration,
        totalUsers: uniqueUsers,
        responseRate,
        sessionsByDate,
      });
    } catch (error) {
      console.error("Error fetching chat analytics:", error);
      res.status(500).json({ error: "Failed to fetch chat analytics" });
    }
  });

  // Add the new text-to-speech endpoint
  app.post("/api/text-to-speech", async (req: Request, res: Response) => {
    try {
      // Authentication check
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { text, voiceId } = req.body;

      if (!text || !voiceId) {
        return res.status(400).json({ error: "Text and voiceId are required" });
      }

      if (!process.env.ELEVENLABS_API_KEY) {
        throw new Error("ElevenLabs API key not configured");
      }

      console.log("Converting text to speech with ElevenLabs:", {
        text,
        voiceId,
        timestamp: new Date().toISOString(),
      });

      const synthesisResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.75,
            },
          }),
        },
      );

      if (!synthesisResponse.ok) {
        const errorText = await synthesisResponse.text();
        console.error("ElevenLabs synthesis error:", {
          status: synthesisResponse.status,
          text: errorText,
        });
        throw new Error("Failed to synthesize speech");
      }

      console.log("Audio synthesis successful");

      const audioBuffer = await synthesisResponse.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      res.json({ audio: audioBase64 });
    } catch (error) {
      console.error("Text-to-speech error:", error);
      res.status(500).json({
        error: "Failed to convert text to speech",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Add PDF parsing endpoint
  app.post("/api/parse-pdf", upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: "File must be a PDF" });
      }

      // Parse PDF and extract text
      const data = await pdf(req.file.buffer);
      
      // Clean the extracted text
      let cleanContent = data.text
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        // Remove PDF artifacts and control characters
        .replace(/[^\x20-\x7E\n]/g, '')
        // Normalize line endings
        .replace(/\r\n/g, '\n')
        // Remove empty lines
        .replace(/\n\s*\n/g, '\n')
        .trim();

      // Basic validation of extracted content
      if (!cleanContent || cleanContent.length < 10) {
        return res.status(400).json({ 
          error: "Could not extract readable text from PDF" 
        });
      }

      res.json({ content: cleanContent });

    } catch (error) {
      console.error('PDF parsing error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to parse PDF" 
      });
    }
  });

  app.post("/api/analyze-url", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      console.log("Analyzing URL:", url);

      // Validate URL format
      try {
        new URL(url);
      } catch (error) {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      // Fetch the webpage content with user agent to avoid being blocked
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch URL: ${response.status} ${response.statusText}`,
        );
      }

      const html = await response.text();
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Remove unwanted elements first
      document
        .querySelectorAll(
          'script, style, noscript, iframe, nav, footer, aside, [style*="display:none"], .social-share',
        )
        .forEach((el) => el.remove());

      // Extract title (try multiple sources)
      const title =
        document.querySelector("title")?.textContent?.trim() ||
        document.querySelector("h1")?.textContent?.trim() ||
        new URL(url).hostname;

      // Extract description (try multiple sources)
      let description =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") ||
        document
          .querySelector('meta[property="og:description"]')
          ?.getAttribute("content");

      if (!description) {
        // Try to get first significant paragraph
        const firstParagraph = Array.from(document.querySelectorAll("p")).find(
          (p) => {
            const text = p.textContent?.trim();
            return text && text.length > 50; // Only consider paragraphs with meaningful content
          },
        );
        description = firstParagraph?.textContent?.trim() || "";
      }

      // Find main content container
      const mainContentSelectors = [
        "main",
        "article",
        '[role="main"]',
        ".main-content",
        "#main-content",
        ".content",
        "#content",
        "body",
      ];

      let contentElement = null;
      for (const selector of mainContentSelectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
      }

      if (!contentElement) {
        contentElement = document.body;
      }

      // Clean up content element
      contentElement
        .querySelectorAll(
          'nav, footer, header, aside, .sidebar, [role="complementary"]',
        )
        .forEach((el) => el.remove());

      // Extract meaningful text content
      const textElements = contentElement.querySelectorAll(
        "p, h1, h2, h3, h4, h5, h6, li",
      );
      const mainContent = Array.from(textElements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 20) // Filter out short snippets
        .join("\n\n");

      // Extract and clean up internal links
      const baseUrl = new URL(url);
      const seen = new Set<string>();
      const pages = Array.from(document.querySelectorAll("a"))
        .map((link) => {
          const href = link.getAttribute("href");
          if (!href) return null;

          try {
            // Skip anchor links and non-http(s) protocols
            if (
              href.startsWith("#") ||
              href.startsWith("mailto:") ||
              href.startsWith("tel:") ||
              href.startsWith("javascript:")
            ) {
              return null;
            }

            // Convert relative to absolute URL
            const fullUrl = new URL(href, baseUrl);

            // Skip common social media and external links
            if (
              fullUrl.hostname !== baseUrl.hostname ||
              fullUrl.hostname.includes("facebook.com") ||
              fullUrl.hostname.includes("twitter.com") ||
              fullUrl.hostname.includes("instagram.com")
            ) {
              return null;
            }

            // Remove hash and query parameters for cleaner URLs
            fullUrl.hash = "";
            fullUrl.search = "";
            return fullUrl.href;
          } catch {
            return null;
          }
        })
        .filter((url): url is string => {
          if (!url || seen.has(url)) return false;
          seen.add(url);
          return true;
        });

      // Extract services and features
      const serviceKeywords = [
        "service",
        "product",
        "solution",
        "feature",
        "package",
        "plan",
        "offer",
      ];
      const services = Array.from(document.querySelectorAll("h2, h3, h4, h5"))
        .map((heading) => {
          const text = heading.textContent?.trim();
          if (
            !text ||
            !serviceKeywords.some(
              (keyword) =>
                text.toLowerCase().includes(keyword) ||
                (
                  heading.previousElementSibling?.textContent?.toLowerCase() ||
                  ""
                ).includes(keyword),
            )
          ) {
            return null;
          }

          let description = "";
          let nextElement = heading.nextElementSibling;
          let descriptionElements = 0;

          // Look for description in the next few elements
          while (nextElement && descriptionElements < 2) {
            if (
              nextElement.tagName === "P" ||
              nextElement.tagName === "UL" ||
              nextElement.tagName === "OL" ||
              nextElement.tagName === "DIV"
            ) {
              description += (nextElement.textContent?.trim() || "") + " ";
              descriptionElements++;
            }
            nextElement = nextElement.nextElementSibling;
          }

          return {
            title: text,
            description: description.trim(),
          };
        })
        .filter(
          (service): service is { title: string; description: string } =>
            service !== null && service.title.length > 0,
        );

      // Ensure we have valid data
      const analysisData = {
        title: title || "Untitled Page",
        description: description || "No description available",
        pages: pages.slice(0, 50), // Limit to 50 pages
        services: services.length > 0 ? services : [],
        content: mainContent || "",
      };

      console.log("Website analysis completed:", {
        url,
        title: analysisData.title,
        descriptionLength: analysisData.description.length,
        pagesFound: analysisData.pages.length,
        servicesFound: analysisData.services.length,
        contentLength: analysisData.content.length,
      });

      res.json(analysisData);
    } catch (error) {
      console.error("Error analyzing URL:", error);
      res.status(500).json({
        error: "Failed to analyze URL",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get crawls for an agent
  app.get("/api/crawl/:agentId", async (req: Request, res: Response) => {
    try {
      const agentId = Number(req.params.agentId);
      const crawls = await storage.getWebsiteCrawls(agentId);

      // Sort by scheduled date, with pending/scheduled first
      crawls.sort((a, b) => {
        // First sort by status (pending/scheduled first)
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;

        // Then sort by scheduled date
        const dateA = a.scheduledAt || a.createdAt;
        const dateB = b.scheduledAt || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      res.json(crawls);
    } catch (error) {
      console.error("Error fetching crawls:", error);
      res.status(500).json({ error: "Failed to fetch crawls" });
    }
  });

  app.get("/api/crawl/:id", async (req: Request, res: Response) => {
    try {
      const crawl = await storage.getWebsiteCrawl(Number(req.params.id));
      if (!crawl) {
        res.status(404).json({ error: "Crawl not found" });
        return;
      }
      res.json(crawl);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crawl data" });
    }
  });

  // Knowledge document routes
  app.post("/api/knowledge-documents", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const documentData = req.body;
      console.log("Creating knowledge document:", documentData);

      // Create the knowledge document
      const document = await storage.createKnowledgeDocument({
        name: documentData.name,
        type: documentData.type,
        source: documentData.source,
        content: documentData.content,
        metadata: documentData.metadata || null,
        agentId: documentData.agentId || null,
      });

      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating knowledge document:", error);
      res.status(400).json({
        error: "Failed to create knowledge document",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Update knowledge document
  app.patch(
    "/api/knowledge-documents/:id",
    async (req: Request, res: Response) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const documentId = Number(req.params.id);
        const updates = req.body;

        const document = await storage.updateKnowledgeDocument(
          documentId,
          updates,
        );
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }

        res.json(document);
      } catch (error) {
        console.error("Error updating knowledge document:", error);
        res.status(400).json({
          error: "Failed to update knowledge document",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Delete knowledge document
  app.delete(
    "/api/knowledge-documents/:id",
    async (req: Request, res: Response) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const documentId = Number(req.params.id);
        await storage.deleteKnowledgeDocument(documentId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting knowledge document:", error);
        res.status(400).json({
          error: "Failed to delete knowledge document",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Get knowledge documents
  app.get("/api/knowledge-documents", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const documents = await storage.getKnowledgeDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching knowledge documents:", error);
      res.status(500).json({
        error: "Failed to fetch knowledge documents",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Add ElevenLabs API route with proper implementation
  app.get("/api/voices", async (_req: Request, res: Response) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        console.warn("ELEVENLABS_API_KEY environment variable is not set");
        return res.json({
          voices: [],
          warning:
            "Voice selection is currently unavailable. Please configure ElevenLabs API key.",
        });
      }

      console.log("Fetching voices from ElevenLabs API with provided key...");
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          Accept: "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        return res.status(response.status).json({
          error: `Failed to fetch voices: ${response.statusText}`,
          details: errorText,
        });
      }

      const data = await response.json();
      console.log("ElevenLabs response:", data);

      if (!data.voices || !Array.isArray(data.voices)) {
        console.warn("Invalid response format from ElevenLabs API:", data);
        return res.json({
          voices: [],
          warning: "Invalid response from voice service",
        });
      }

      const voices = data.voices.map((voice: any) => ({
        id: voice.voice_id,
        name: voice.name,
        category: voice.category || "Other",
        description: voice.description || "",
        previewUrl: voice.preview_url,
        settings: voice.settings || {
          stability: 0.75,
          similarity_boost: 0.75,
        },
      }));

      console.log("Processed voices:", voices);
      res.json({ voices });
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to fetch voices",
      });
    }
  });

  // Chat Analytics Routes
  app.get("/api/analytics/chat", async (req: Request, res: Response) => {
    try {
      const timeRange = (req.query.timeRange as string) || "week";
      const now = new Date();
      let startDate = new Date();

      switch (timeRange) {
        case "day":
          startDate.setDate(now.getDate() - 1);
          break;
        case "week":
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      // Get all chat sessions within the time range
      const sessions = await storage.getVoiceChatSessions();
      const filteredSessions = sessions.filter(
        (session) =>
          new Date(session.started_at) >= startDate &&
          new Date(session.started_at) <= now,
      );

      // Calculate metrics
      const totalSessions = filteredSessions.length;
      const uniqueUsers = new Set(
        filteredSessions.map((session) => session.user_id),
      ).size;

      // Calculate average duration
      const durationsSum = filteredSessions.reduce(
        (sum, session) => sum + (session.duration || 0),
        0,
      );
      const averageDuration =
        totalSessions > 0 ? durationsSum / totalSessions : 0;

      // Calculate response rate (sessions with agent responses / total sessions)
      const sessionsWithResponses = filteredSessions.filter(
        (session) => session.agent_response !== null,
      ).length;
      const responseRate =
        totalSessions > 0 ? sessionsWithResponses / totalSessions : 0;

      // Group sessions by date
      const sessionsByDate = filteredSessions.reduce((acc: any[], session) => {
        const date = new Date(session.started_at).toISOString().split("T")[0];
        const existingEntry = acc.find((entry) => entry.date === date);

        if (existingEntry) {
          existingEntry.sessions += 1;
        } else {
          acc.push({ date, sessions: 1 });
        }

        return acc;
      }, []);

      // Fill in missing dates with zero sessions
      let currentDate = new Date(startDate);
      while (currentDate <= now) {
        const dateStr = currentDate.toISOString().split("T")[0];
        if (!sessionsByDate.find((entry) => entry.date === dateStr)) {
          sessionsByDate.push({ date: dateStr, sessions: 0 });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Sort by date
      sessionsByDate.sort((a, b) => a.date.localeCompare(b.date));

      res.json({
        totalSessions,
        averageDuration,
        totalUsers: uniqueUsers,
        responseRate,
        sessionsByDate,
      });
    } catch (error) {
      console.error("Error fetching chat analytics:", error);
      res.status(500).json({ error: "Failed to fetch chat analytics" });
    }
  });

  // Add the new text-to-speech endpoint
  app.post("/api/text-to-speech", async (req: Request, res: Response) => {
    try {
      // Authentication check
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { text, voiceId } = req.body;

      if (!text || !voiceId) {
        return res.status(400).json({ error: "Text and voiceId are required" });
      }

      if (!process.env.ELEVENLABS_API_KEY) {
        throw new Error("ElevenLabs API key not configured");
      }

      console.log("Converting text to speech with ElevenLabs:", {
        text,
        voiceId,
        timestamp: new Date().toISOString(),
      });

      const synthesisResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.75,
            },
          }),
        },
      );

      if (!synthesisResponse.ok) {
        const errorText = await synthesisResponse.text();
        console.error("ElevenLabs synthesis error:", {
          status: synthesisResponse.status,
          text: errorText,
        });
        throw new Error("Failed to synthesize speech");
      }

      console.log("Audio synthesis successful");

      const audioBuffer = await synthesisResponse.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      res.json({ audio: audioBase64 });
    } catch (error) {
      console.error("Text-to-speech error:", error);
      res.status(500).json({
        error: "Failed to convert text to speech",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return httpServer;
}

function addDays(date: Date, days: number): Date {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

function addWeeks(date: Date, weeks: number): Date {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + weeks * 7);
  return newDate;
}

function addMonths(date: Date, months: number): Date {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
}
