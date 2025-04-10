var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express3 from "express";
import { createServer as createServer2 } from "http";

// server/routes.ts
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

// server/storage.ts
import dotenv2 from "dotenv";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  agents: () => agents,
  apiConfigurations: () => apiConfigurations,
  callHistory: () => callHistory,
  insertAgentSchema: () => insertAgentSchema,
  insertApiConfigurationSchema: () => insertApiConfigurationSchema,
  insertCallHistorySchema: () => insertCallHistorySchema,
  insertKnowledgeDocumentSchema: () => insertKnowledgeDocumentSchema,
  insertPhoneNumberSchema: () => insertPhoneNumberSchema,
  insertUserSchema: () => insertUserSchema,
  insertVoiceChatSessionSchema: () => insertVoiceChatSessionSchema,
  insertWebsiteCrawlSchema: () => insertWebsiteCrawlSchema,
  knowledgeDocuments: () => knowledgeDocuments,
  phoneNumbers: () => phoneNumbers,
  users: () => users,
  voiceChatSessions: () => voiceChatSessions,
  websiteCrawls: () => websiteCrawls
});
import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").default("ai").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  voiceId: text("voice_id"),
  systemPrompt: text("system_prompt"),
  greetingMessage: text("greeting_message"),
  voiceSettings: jsonb("voice_settings")
});
var phoneNumbers = pgTable("phone_numbers", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull().unique(),
  label: text("label").notNull(),
  twilioSid: text("twilio_sid").notNull(),
  twilioToken: text("twilio_token").notNull(),
  agentId: integer("agent_id").references(() => agents.id),
  userId: integer("user_id").references(() => users.id).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var callHistory = pgTable("call_history", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  phoneNumberId: integer("phone_number_id").references(() => phoneNumbers.id),
  source: text("source").notNull(),
  duration: integer("duration").notNull(),
  status: text("status").notNull(),
  recordingEnabled: boolean("recording_enabled").default(true).notNull(),
  recordingUrl: text("recording_url"),
  transcriptUrl: text("transcript_url"),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var knowledgeDocuments = pgTable("knowledge_documents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  source: text("source").notNull(),
  content: text("content"),
  embeddings: jsonb("embeddings"),
  metadata: jsonb("metadata"),
  agentId: integer("agent_id").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var websiteCrawls = pgTable("website_crawls", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  status: text("status").notNull(),
  crawlData: jsonb("crawl_data"),
  error: text("error"),
  agentId: integer("agent_id").references(() => agents.id),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  scheduledAt: timestamp("scheduled_at"),
  scheduleRecurrence: text("schedule_recurrence"),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  batchId: text("batch_id"),
  crawlConfig: jsonb("crawl_config")
});
var voiceChatSessions = pgTable("voice_chat_sessions", {
  id: serial("id").primaryKey(),
  session_id: text("session_id").notNull(),
  user_id: integer("user_id").references(() => users.id).notNull(),
  agent_id: integer("agent_id").references(() => agents.id).notNull(),
  status: text("status").notNull(),
  started_at: timestamp("started_at").defaultNow().notNull(),
  ended_at: timestamp("ended_at"),
  transcription: text("transcription"),
  agent_response: text("agent_response"),
  metadata: jsonb("metadata"),
  duration: integer("duration")
});
var apiConfigurations = pgTable("api_configurations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  apiKey: text("api_key").notNull(),
  apiEndpoint: text("api_endpoint").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertPhoneNumberSchema = createInsertSchema(phoneNumbers).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertCallHistorySchema = createInsertSchema(callHistory).omit({
  id: true,
  createdAt: true
});
var insertKnowledgeDocumentSchema = createInsertSchema(knowledgeDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertApiConfigurationSchema = createInsertSchema(apiConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertWebsiteCrawlSchema = createInsertSchema(websiteCrawls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  crawlData: true,
  error: true
}).extend({
  scheduleRecurrence: z.enum(["once", "daily", "weekly", "monthly"]).optional(),
  scheduledAt: z.string().datetime().optional(),
  crawlConfig: z.object({
    depth: z.number().min(1).max(5).default(2),
    maxPages: z.number().min(1).max(100).default(10),
    selector: z.string().default("article, p, h1, h2, h3, h4, h5, h6"),
    filters: z.array(z.string()).optional()
  }).optional()
});
var insertVoiceChatSessionSchema = createInsertSchema(voiceChatSessions).omit({
  id: true
});

// server/db.ts
import dotenv from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
dotenv.config();
neonConfig.webSocketConstructor = ws;
console.log(process.env.DATABASE_URL, "daturl");
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
dotenv2.config();
var PostgresSessionStore = connectPg(session);
var DatabaseStorage = class {
  sessionStore;
  constructor() {
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL
      },
      createTableIfMissing: true
    });
  }
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async createUser(insertUser) {
    const now = /* @__PURE__ */ new Date();
    const [user] = await db.insert(users).values({
      ...insertUser,
      createdAt: now,
      updatedAt: now
    }).returning();
    return user;
  }
  async updateUser(id, update) {
    const [user] = await db.update(users).set({ ...update, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, id)).returning();
    if (!user) throw new Error(`User with id ${id} not found`);
    return user;
  }
  async getAgents() {
    return db.select().from(agents);
  }
  async getAgentsByUserId(userId) {
    return db.select().from(agents).where(eq(agents.userId, userId));
  }
  async getAgent(id) {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }
  async createAgent(insertAgent) {
    const now = /* @__PURE__ */ new Date();
    const [agent] = await db.insert(agents).values({
      ...insertAgent,
      createdAt: now,
      updatedAt: now
    }).returning();
    return agent;
  }
  async updateAgent(id, updates) {
    const [agent] = await db.update(agents).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(agents.id, id)).returning();
    if (!agent) throw new Error(`Agent with id ${id} not found`);
    return agent;
  }
  // Knowledge Document methods
  async getKnowledgeDocuments() {
    return db.select().from(knowledgeDocuments);
  }
  async createKnowledgeDocument(document) {
    const now = /* @__PURE__ */ new Date();
    const [newDocument] = await db.insert(knowledgeDocuments).values({
      ...document,
      createdAt: now,
      updatedAt: now
    }).returning();
    return newDocument;
  }
  async updateKnowledgeDocument(id, updates) {
    if (updates.metadata && typeof updates.metadata === "object") {
      const metadata = { ...updates.metadata };
      if (metadata.lastAnalyzed && typeof metadata.lastAnalyzed === "string") {
        metadata.lastAnalyzed = new Date(metadata.lastAnalyzed);
      }
      updates = { ...updates, metadata };
    }
    const [document] = await db.update(knowledgeDocuments).set({
      ...updates,
      updatedAt: /* @__PURE__ */ new Date(),
      // Don't allow updating these fields
      createdAt: void 0,
      id: void 0
    }).where(eq(knowledgeDocuments.id, id)).returning();
    if (!document) throw new Error(`Document with id ${id} not found`);
    return document;
  }
  async deleteKnowledgeDocument(id) {
    await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
import multer from "multer";

// server/auth.ts
import dotenv3 from "dotenv";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session2 from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
dotenv3.config();
var scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function setupAuth(app3) {
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "dev_secret_key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1e3,
      // 24 hours
      sameSite: "lax",
      path: "/"
    },
    name: "sid"
    // Set a specific session ID name
  };
  app3.set("trust proxy", 1);
  app3.use(session2(sessionSettings));
  app3.use(passport.initialize());
  app3.use(passport.session());
  app3.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Session ID: ${req.sessionID} - Authenticated: ${req.isAuthenticated()}`);
    next();
  });
  const userCache = /* @__PURE__ */ new Map();
  const CACHE_TTL = 5 * 60 * 1e3;
  function cacheUser(user) {
    userCache.set(user.id, user);
    setTimeout(() => userCache.delete(user.id), CACHE_TTL);
  }
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("Attempting authentication for user:", username);
        const user = await storage.getUserByUsername(username);
        if (!user || !await comparePasswords(password, user.password)) {
          console.log("Authentication failed for user:", username);
          return done(null, false, { message: "Invalid username or password" });
        }
        console.log("Authentication successful for user:", username);
        cacheUser(user);
        return done(null, user);
      } catch (error) {
        console.error("Authentication error:", error);
        return done(error);
      }
    })
  );
  passport.serializeUser((user, done) => {
    console.log("Serializing user:", user.id);
    done(null, user.id);
  });
  passport.deserializeUser(async (id, done) => {
    try {
      const cachedUser = userCache.get(id);
      if (cachedUser) {
        console.log("Cache hit - User found:", id);
        return done(null, cachedUser);
      }
      console.log("Cache miss - Deserializing user:", id);
      const user = await storage.getUser(id);
      if (!user) {
        console.log("User not found during deserialization:", id);
        return done(null, false);
      }
      cacheUser(user);
      done(null, user);
    } catch (error) {
      console.error("Deserialization error:", error);
      done(error);
    }
  });
  const checkAuth2 = (req, res, next) => {
    if (!req.isAuthenticated()) {
      console.log("Unauthorized access attempt:", req.path);
      return res.status(401).json({ error: "Not authenticated" });
    }
    next();
  };
  app3.post("/api/register", async (req, res) => {
    try {
      console.log("Registration request received");
      if (!req.body.username || !req.body.password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      const hashedPassword = await hashPassword(req.body.password);
      const newUser = await storage.createUser({
        username: req.body.username,
        password: hashedPassword
      });
      console.log("User created successfully:", { id: newUser.id, username: newUser.username });
      cacheUser(newUser);
      req.login(newUser, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return res.status(500).json({ error: "Failed to log in after registration" });
        }
        res.status(201).json(newUser);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({
        error: "Failed to register user",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      req.login(user, (err2) => {
        if (err2) return next(err2);
        console.log("User logged in successfully:", user.id);
        cacheUser(user);
        res.json(user);
      });
    })(req, res, next);
  });
  app3.post("/api/logout", (req, res) => {
    const userId = req.user?.id;
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Failed to log out" });
      }
      if (userId) {
        userCache.delete(userId);
      }
      console.log("User logged out:", userId);
      res.sendStatus(200);
    });
  });
  app3.get("/api/user", checkAuth2, (req, res) => {
    console.log("User check:", req.user?.id, "Is authenticated:", req.isAuthenticated());
    res.json(req.user);
  });
  return { checkAuth: checkAuth2 };
}

// server/routes.ts
import { parse as parseCookie } from "cookie";
import { OpenAI } from "openai";
import { JSDOM } from "jsdom";
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
    // 10MB limit
  }
});
var pdfParse;
var initPdfParse = async () => {
  if (!pdfParse) {
    pdfParse = (await import("pdf-parse")).default;
  }
  return pdfParse;
};
function extractWebsiteMetadata(document) {
  const metadata = {
    title: "",
    description: "",
    pages: [],
    services: [],
    pageContents: [],
    crawledAt: (/* @__PURE__ */ new Date()).toISOString(),
    pageCount: 0,
    lastAnalyzed: (/* @__PURE__ */ new Date()).toISOString()
  };
  metadata.title = document.querySelector("title")?.textContent?.trim() || document.querySelector("h1")?.textContent?.trim() || document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "Untitled Page";
  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content") || document.querySelector('meta[property="og:description"]')?.getAttribute("content");
  const mainContent = document.querySelector(
    'main, [role="main"], article, .content, #content'
  ) || document;
  const introSection = Array.from(
    mainContent.querySelectorAll(
      'section, div[class*="intro"], div[class*="hero"], div[class*="about"]'
    )
  ).find((section) => {
    const text2 = section.textContent?.trim();
    return text2 && text2.length > 100 && !text2.includes("cookie") && !text2.includes("privacy");
  });
  const introParagraphs = introSection?.querySelectorAll("p") || mainContent.querySelectorAll("p");
  let introduction = Array.from(introParagraphs).slice(0, 3).map((p) => p.textContent?.trim()).filter(
    (text2) => typeof text2 === "string" && text2.length > 50
  ).join("\n\n");
  metadata.description = metaDesc || introduction || "No description available";
  let headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
  metadata.pageContents = Array.from(headings).map((heading) => {
    const level = parseInt(heading.tagName[1]);
    const title = heading.textContent?.trim() || "";
    let content = "";
    let features = [];
    let nextEl = heading.nextElementSibling;
    while (nextEl) {
      if (nextEl.tagName.match(/^H[1-6]$/) && parseInt(nextEl.tagName[1]) <= level) {
        break;
      }
      if (nextEl.matches("ul, ol")) {
        const extractedFeatures = Array.from(nextEl.querySelectorAll("li")).map((li) => li.textContent?.trim()).filter(
          (text2) => typeof text2 === "string" && text2.length > 10
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
      features: features.length > 0 ? features : void 0
    };
  }).filter(
    (section) => section.title.length > 0 && (section.content.length > 0 || (section.features?.length ?? 0) > 0)
  );
  const serviceSelectors = [
    'section[class*="service"], section[class*="feature"]',
    'div[class*="service"], div[class*="feature"]',
    ".card, .feature-card, .service-card",
    '[class*="service-item"], [class*="feature-item"]',
    '[data-testid*="service"], [data-testid*="feature"]',
    ".solutions, .products, .offerings"
  ];
  const serviceElements = document.querySelectorAll(serviceSelectors.join(","));
  const services = /* @__PURE__ */ new Map();
  serviceElements.forEach((element) => {
    const title = element.querySelector("h2, h3, h4, h5, h6, strong")?.textContent?.trim();
    if (!title || title.length < 3) return;
    const descElements = element.querySelectorAll("p");
    let description = Array.from(descElements).map((el) => el.textContent?.trim()).filter(
      (text2) => typeof text2 === "string" && text2.length > 20
    ).join("\n");
    const features = Array.from(element.querySelectorAll("ul li, ol li")).map((li) => li.textContent?.trim()).filter(
      (text2) => typeof text2 === "string" && text2.length > 10
    );
    if (!services.has(title)) {
      services.set(title, {
        description: description || "No description available",
        features: features.length > 0 ? features : []
      });
    }
  });
  metadata.services = Array.from(services.entries()).map(
    ([title, data]) => ({
      title,
      description: data.description,
      features: data.features
    })
  );
  const navLinks = Array.from(
    document.querySelectorAll('nav a, [role="navigation"] a, header a')
  ).map((link) => {
    const href = link.getAttribute("href");
    if (!href) return null;
    try {
      const fullUrl = new URL(href, "https://example.com");
      const type = href.includes("#") ? "anchor" : href.includes("mailto:") ? "email" : href.includes("tel:") ? "phone" : "page";
      return {
        path: fullUrl.pathname + fullUrl.search,
        title: link.textContent?.trim() || "",
        type
      };
    } catch {
      return null;
    }
  }).filter(
    (link) => link !== null && link.type === "page" && link.title.length > 0 && !link.path.includes("login") && !link.path.includes("signup")
  );
  metadata.pages = [
    ...Array.from(new Map(navLinks.map((link) => [link.path, link])).values())
  ];
  return metadata;
}
var app = express();
var { checkAuth } = setupAuth(app);
app.get("/api/agents", checkAuth, async (req, res) => {
  try {
    const agents2 = await storage.getAgentsByUserId(req.user.id);
    res.json(agents2);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});
app.post("/api/agents", checkAuth, async (req, res) => {
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
async function createConversationContext(documents, agent) {
  const documentContents = documents.map((doc) => ({
    name: doc.name,
    content: doc.content || "",
    metadata: doc.metadata
  }));
  const systemInstructions = `You are a document-focused AI assistant with STRICT limitations. Follow these rules without exception:

1. You can ONLY provide information that is explicitly present in the assigned documents.
2. Your knowledge is LIMITED to ONLY these documents:
${documentContents.map((doc) => `- ${doc.name}`).join("\n")}

3. For EVERY response you give:
   - First verify if the information exists in the documents
   - If found: Start with "Based on the document(s), ..." and provide only that information
   - If not found: Respond EXACTLY with this message: "I cannot answer this question as it's not covered in the assigned documents. I can only provide information that is explicitly present in [document names]. Please ask about the content from these documents."

4. NEVER use any external knowledge or general information, even if relevant.
5. NEVER make assumptions or inferences beyond what's directly stated in the documents.
6. If asked about topics like Google Pixel or any other subjects not in the documents, respond with the cannot-answer message.

Important: You have NO access to information outside these documents. Treat any other knowledge as non-existent.`;
  const documentContext = documentContents.map((doc) => `
Document: ${doc.name}
Content Summary: ${doc.content ? doc.content.substring(0, 200) + "..." : "No content"}
---`).join("\n");
  return {
    systemInstructions,
    documentContext,
    documentNames: documentContents.map((doc) => doc.name)
  };
}
app.post("/api/parse-pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "File must be a PDF" });
    }
    const parser = await initPdfParse();
    const data = await parser(req.file.buffer);
    let cleanContent = data.text.replace(/\s+/g, " ").replace(/[^\x20-\x7E\n]/g, "").replace(/\[\[.*?\]\]/g, "").replace(/\d+\s+\d+\s+obj.*?endobj/g, "").replace(/\r\n/g, "\n").replace(/\n\s*\n/g, "\n").replace(/<</g, "").replace(/>>/g, "").replace(/endstream/g, "").replace(/stream/g, "").trim();
    if (!cleanContent || cleanContent.length < 10) {
      return res.status(400).json({
        error: "Could not extract readable text from PDF"
      });
    }
    res.json({ content: cleanContent });
  } catch (error) {
    console.error("PDF parsing error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to parse PDF"
    });
  }
});
app.post("/api/chat", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { agentId, message } = req.body;
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
    const context = await createConversationContext(documents, agent);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: context.systemInstructions
        },
        {
          role: "system",
          content: `Available documents:
${context.documentContext}`
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.1
      // Use low temperature to keep responses focused and consistent
    });
    const response = completion.choices[0].message.content;
    if (!response.includes("Based on the document") && !response.includes("I cannot answer this question")) {
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
async function registerRoutes(app3) {
  setupAuth(app3);
  const httpServer = createServer(app3);
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
        console.log("WebSocket connection attempt:", {
          path: info.req.url,
          headers: {
            cookie: "present",
            origin: info.origin,
            host: info.req.headers.host
          }
        });
        callback(true);
      } catch (error) {
        console.error(
          "WebSocket verification error:",
          error instanceof Error ? error.message : "Unknown error"
        );
        callback(false, 500, "Internal server error");
      }
    }
  });
  let connectionCount = 0;
  async function generateWebsiteResponse(transcript, agentDocuments) {
    const queryTerms = new Set(transcript.toLowerCase().split(/\W+/));
    const isServiceQuery = queryTerms.has("service") || queryTerms.has("services");
    const websiteContent = agentDocuments.map((doc) => {
      const metadata = doc.metadata;
      return {
        title: metadata?.title || "",
        services: metadata?.services || [],
        pages: metadata?.pages || [],
        content: doc.content || ""
      };
    });
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
          content: `Available website content:
${JSON.stringify(websiteContent, null, 2)}`
        },
        { role: "user", content: transcript }
      ],
      temperature: 0.5,
      max_tokens: 100,
      stop: ["I don't know", "I'm not sure", "I cannot"]
    });
    return completion.choices[0].message.content || "I can only provide information about the website content and services.";
  }
  const contexts = /* @__PURE__ */ new Map();
  wss.on("connection", async (ws2, req) => {
    const currentConnection = ++connectionCount;
    console.log(`New WebSocket connection established #${currentConnection}`);
    try {
      const cookies = parseCookie(req.headers.cookie || "");
      const sessionId = cookies["connect.sid"];
      const url = new URL(req.url, `http://${req.headers.host}`);
      const urlParts = url.pathname.split("/");
      const agentId = urlParts[urlParts.length - 2];
      const currentSessionId = urlParts[urlParts.length - 1];
      if (!currentSessionId) {
        console.error("No voice chat session ID provided");
        ws2.close(1008, "Session ID required");
        return;
      }
      const agent = await storage.getAgent(Number(agentId));
      if (!agent) {
        console.error(`Agent ${agentId} not found`);
        ws2.close(1008, "Agent not found");
        return;
      }
      const rawDocuments = await storage.getKnowledgeDocuments();
      const documents = rawDocuments.map((doc) => ({
        ...doc,
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
        updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
        agentId: doc.agentId ?? void 0,
        metadata: doc.metadata,
        content: doc.content || ""
      }));
      const agentDocuments = documents.filter(
        (doc) => doc.agentId === agent.id
      );
      const { systemInstructions, servicesContext } = await createConversationContext(agentDocuments, agent);
      const messages = [
        {
          role: "system",
          content: `${systemInstructions}

Service Information:
${servicesContext}`
        }
      ];
      contexts.set(currentSessionId, messages);
      const currentMessages = contexts.get(currentSessionId) || [];
      const generateResponse = async (transcript) => {
        currentMessages.push({ role: "user", content: transcript });
        const completion = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            {
              role: "system",
              content: `${systemInstructions}

Service Information:
${servicesContext}

Only respond with website information. For unrelated questions, say "I can only provide information about the website content and services."`
            },
            ...currentMessages
          ].map((msg) => ({
            role: msg.role === "system" ? "system" : msg.role === "user" ? "user" : "assistant",
            content: msg.content
          })),
          temperature: 0.7,
          max_tokens: 150,
          // Keep responses concise
          stop: ["I don't know", "I am not sure", "I cannot"]
          // Prevent uncertain responses
        });
        const aiResponse = completion.choices[0].message.content;
        if (!aiResponse) {
          throw new Error("No AI response generated");
        }
        return aiResponse;
      };
      let greetingMessage = "";
      if (agentDocuments.length > 0) {
        const websiteDoc = agentDocuments[0];
        const websiteName = websiteDoc.name.replace(/^Website: /, "");
        const metadata = websiteDoc.metadata;
        const description = metadata?.description?.split(".")[0] || "";
        const allServices = agentDocuments.flatMap((doc) => {
          const docMetadata = doc.metadata;
          return (docMetadata?.services || []).filter(
            (service) => service !== null && typeof service === "object" && "title" in service && typeof service.title === "string" && service.title.length > 0
          );
        });
        let servicesList = "";
        if (allServices.length > 0) {
          const MAX_SERVICES = 3;
          servicesList = allServices.slice(0, MAX_SERVICES).map((service) => service.title).join(", ");
          if (allServices.length > MAX_SERVICES) {
            servicesList += ` and ${allServices.length - MAX_SERVICES} more services`;
          }
        }
        greetingMessage = `\u{1F44B} Hi! I'm your ${websiteName} assistant${description ? ` - ${description}` : ""}. ` + (servicesList ? `I can help you with ${servicesList}. ` : "") + "How may I assist you today?";
      } else {
        greetingMessage = `Hello! I'm ${agent.name}, your AI assistant. How can I help you today?`;
      }
      ws2.send(
        JSON.stringify({
          type: "transcription",
          text: greetingMessage,
          isFinal: true
        })
      );
      if (agent.voiceId) {
        try {
          const synthesisResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${agent.voiceId}`,
            {
              method: "POST",
              headers: {
                Accept: "audio/mpeg",
                "xi-api-key": process.env.ELEVENLABS_API_KEY,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                text: greetingMessage,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                  stability: 0.75,
                  similarity_boost: 0.75
                }
              })
            }
          );
          if (!synthesisResponse.ok) {
            const errorText = await synthesisResponse.text();
            console.error("ElevenLabs synthesis error:", {
              status: synthesisResponse.status,
              text: errorText
            });
            throw new Error(
              `Failed to synthesize speech: ${synthesisResponse.statusText}`
            );
          }
          const audioBuffer = await synthesisResponse.arrayBuffer();
          const audioBase64 = Buffer.from(audioBuffer).toString("base64");
          ws2.send(
            JSON.stringify({
              type: "audio",
              audio: audioBase64
            })
          );
        } catch (error) {
          console.error("Error synthesizing greeting:", error);
        }
      }
      ws2.on("message", async (message) => {
        try {
          if (!process.env.DEEPGRAM_API_KEY) {
            throw new Error("Deepgram API key not configured");
          }
          const encoding = "webm";
          const mimetype = "audio/webm;codecs=opus";
          const deepgramUrl = `https://api.deepgram.com/v1/listen?encoding=${encoding}&language=en-US&punctuate=true&interim_results=true`;
          const response = await fetch(deepgramUrl, {
            method: "POST",
            headers: {
              Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
              "Content-Type": mimetype
            },
            body: message
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error("Deepgram API error:", {
              status: response.status,
              text: errorText
            });
            throw new Error(`Deepgram API error: ${response.statusText}`);
          }
          const transcriptionData = await response.json();
          const transcript = transcriptionData.results?.channels[0]?.alternatives[0]?.transcript;
          if (transcript && transcript.trim()) {
            ws2.send(
              JSON.stringify({
                type: "transcription",
                text: transcript,
                isFinal: transcriptionData.is_final || false
              })
            );
            if (transcriptionData.is_final) {
              if (!process.env.OPENAI_API_SECRET) {
                throw new Error("OpenAI API key not configured");
              }
              const openai2 = new OpenAI({
                apiKey: process.env.OPENAI_API_SECRET
              });
              const currentMessages2 = contexts.get(currentSessionId) || [];
              currentMessages2.push({
                role: "user",
                content: transcript
              });
              const completion = await openai2.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                  {
                    role: "system",
                    content: `${systemInstructions}

Service Information:
${servicesContext}

Only respond with website information. For unrelated questions, say "I can only provide information about the website content and services."`
                  },
                  ...currentMessages2
                ].map((msg) => ({
                  role: msg.role === "system" ? "system" : msg.role === "user" ? "user" : "assistant",
                  content: msg.content
                })),
                temperature: 0.7,
                max_tokens: 150,
                // Keep responses concise
                stop: ["I don't know", "I am not sure", "I cannot"]
                // Prevent uncertain responses
              });
              const aiResponse = completion.choices[0].message.content;
              if (!aiResponse) {
                throw new Error("No AI response generated");
              }
              currentMessages2.push({
                role: "assistant",
                content: aiResponse
              });
              contexts.set(currentSessionId, currentMessages2);
              ws2.send(
                JSON.stringify({
                  type: "response",
                  text: aiResponse
                })
              );
              if (agent.voiceId) {
                try {
                  const synthesisResponse = await fetch(
                    `https://api.elevenlabs.io/v1/text-to-speech/${agent.voiceId}`,
                    {
                      method: "POST",
                      headers: {
                        Accept: "audio/mpeg",
                        "xi-api-key": process.env.ELEVENLABS_API_KEY,
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify({
                        text: aiResponse,
                        model_id: "eleven_monolingual_v1",
                        voice_settings: {
                          stability: 0.75,
                          similarity_boost: 0.75
                        }
                      })
                    }
                  );
                  if (!synthesisResponse.ok) {
                    const errorText = await synthesisResponse.text();
                    console.error("ElevenLabs synthesis error:", {
                      status: synthesisResponse.status,
                      text: errorText
                    });
                    throw new Error("Failed to synthesize speech");
                  }
                  const audioBuffer = await synthesisResponse.arrayBuffer();
                  const audioBase64 = Buffer.from(audioBuffer).toString("base64");
                  ws2.send(
                    JSON.stringify({
                      type: "audio",
                      audio: audioBase64
                    })
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
            error
          );
          ws2.send(
            JSON.stringify({
              type: "error",
              error: error instanceof Error ? error.message : "Processing failed"
            })
          );
        }
      });
      ws2.on("close", () => {
        console.log(`WebSocket connection #${currentConnection} closed`);
        contexts.delete(currentSessionId);
      });
    } catch (error) {
      console.error(`WebSocket error (connection #${currentConnection}):`, {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : void 0
      });
      ws2.close(1011, "Internal server error");
    }
  });
  if (!process.env.OPENAI_API_SECRET) {
    throw new Error("OpenAI API key not configured");
  }
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_SECRET
  });
  app3.post("/api/process", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const userText = req.body.text;
      const language = req.body.language || "en-US";
      const chatResponse = await openai.chat.completions.create({
        messages: [{ role: "user", content: userText }],
        model: "gpt-4-turbo-preview"
      });
      const response = chatResponse.choices[0].message.content;
      if (!response) {
        throw new Error("No response generated");
      }
      res.json({
        reply: response,
        language
      });
    } catch (error) {
      console.error("Process error:", error);
      res.status(500).json({
        error: "Failed to process response",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.post("/api/voice-chat", async (req, res) => {
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
      const documents = await storage.getKnowledgeDocuments();
      const agentDocuments = documents.filter(
        (doc) => doc.agentId === agent.id
      );
      let documentContext = "";
      let servicesContext = "";
      let greetingContext = "";
      let greetingMessage = "";
      if (agentDocuments.length > 0) {
        const allServices = agentDocuments.flatMap((doc) => doc.metadata?.services || []).filter((service) => service?.title);
        const websiteInfo = agentDocuments.map((doc) => ({
          name: doc.name.replace(/^Website: /, ""),
          description: doc.metadata?.description || ""
        }));
        const websiteName = websiteInfo.map((info) => info.name).join(" and ");
        const description = websiteInfo[0]?.description;
        greetingMessage = `\u{1F44B} Hi! I'm your ${websiteName} assistant${description ? ` - ${description.split(".")[0]}` : ""}. ` + (allServices.length > 0 ? `I can help you with ${allServices.slice(0, 3).map((service) => service.title).join(", ")}.` : "") + " How may I assist you today?";
        greetingContext = `\u{1F44B} Welcome to ${websiteName}!

` + (description ? `${description}

` : "") + "I'm your dedicated AI assistant here to help you.";
        if (allServices.length > 0) {
          servicesContext = "\n\nI can assist you with the following services:\n" + allServices.map(
            (service) => `\u2022 ${service.title}${service.description ? ` - ${service.description}` : ""}`
          ).join("\n");
          servicesContext += "\n\nHow can I help you with any of these services today?";
        }
        documentContext = "\n\nKnowledge Base Context:\n" + agentDocuments.map((doc) => doc.content).join("\n\n");
      } else {
        greetingMessage = `Hello! I'm ${agent.name}, your AI assistant. How can I help you today?`;
        greetingContext = `You are ${agent.name}, a helpful AI assistant.`;
      }
      const basePrompt = "You are a knowledgeable AI assistant. Provide warm, helpful, and accurate responses.";
      const systemPrompt = `${basePrompt}

${greetingContext}${servicesContext}${documentContext}

Instructions:
1. For the first message, always start with the greeting and introduce the available services.
2. Base your responses on the knowledge base information provided.
3. If asked about a service, provide detailed information from the knowledge base.
4. Keep responses friendly and professional.
5. If you don't have specific information in the knowledge base, be honest about it.`;
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: req.body.message }
        ]
      });
      const chatResponse = completion.choices[0].message.content;
      if (!chatResponse) {
        throw new Error("No response generated");
      }
      if (!agent.voiceId) {
        throw new Error("No voice selected for agent");
      }
      if (!process.env.ELEVENLABS_API_KEY) {
        throw new Error("ElevenLabs API key not configured");
      }
      console.log(
        "Converting chat response to speech with ElevenLabs using voice ID:",
        agent.voiceId
      );
      const synthesisResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${agent.voiceId}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: chatResponse,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.75
            }
          })
        }
      );
      if (!synthesisResponse.ok) {
        const errorText = await synthesisResponse.text();
        console.error("ElevenLabs synthesis error:", {
          status: synthesisResponse.status,
          text: errorText
        });
        throw new Error("Failed to synthesize speech");
      }
      const audioBuffer = await synthesisResponse.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");
      res.json({
        text: chatResponse,
        audio: audioBase64
      });
    } catch (error) {
      console.error("Error in chat and voice:", error);
      res.status(400).json({
        error: "Failed to process chat and voice",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.post("/api/chat", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const agent = await storage.getAgent(Number(req.body.agentId));
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      const documents = await storage.getKnowledgeDocuments();
      const agentDocuments = documents.filter(
        (doc) => doc.agentId === agent.id
      );
      let documentContext = "";
      let servicesContext = "";
      let greetingContext = "";
      let greetingMessage = "";
      if (agentDocuments.length > 0) {
        const allServices = agentDocuments.flatMap((doc) => doc.metadata?.services || []).filter((service) => service?.title);
        const websiteInfo = agentDocuments.map((doc) => ({
          name: doc.name.replace(/^Website: /, ""),
          description: doc.metadata?.description || ""
        }));
        const websiteName = websiteInfo.map((info) => info.name).join(" and ");
        const description = websiteInfo[0]?.description;
        greetingContext = `You are a knowledgeable AI assistant for ${websiteName}.
` + (description ? `${description}
` : "");
        greetingMessage = `\u{1F44B} Hi! I'm your ${websiteName} assistant${description ? ` - ${description.split(".")[0]}` : ""}. ` + (allServices.length > 0 ? `I can help you with ${allServices.slice(0, 3).map((service) => service.title).join(", ")}.` : "") + " How may I assist you today?";
        if (allServices.length > 0) {
          servicesContext = "\nYou can assist with these services:\n" + allServices.map(
            (service) => `\u2022 ${service.title}${service.description ? ` - ${service.description}` : ""}`
          ).join("\n");
          greetingMessage += "\n\nI can assist you with the following services:\n" + allServices.map(
            (service) => `\u2022 ${service.title}${service.description ? ` - ${service.description}` : ""}`
          ).join("\n") + "\n\nHow can I help you with any of these services today?";
        }
        documentContext = "\nKnowledge Base Context:\n" + agentDocuments.map((doc) => doc.content).join("\n\n");
      } else {
        greetingMessage = `Hello! I'm ${agent.name}, your AI assistant. How can I help you today?`;
        greetingContext = `You are ${agent.name}, a helpful AI assistant.`;
      }
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `${greetingContext}${servicesContext}${documentContext}

Instructions:
1. Base your responses on the knowledge base information provided.
2. If asked about a service, provide detailed information from the knowledge base.
3. Keep responses friendly and professional.
4. If you don't have specific information in the knowledge base, be honest about it.`
          },
          { role: "user", content: req.body.message }
        ]
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
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.get("/api/agents", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const agents2 = await storage.getAgentsByUserId(req.user.id);
      res.json(agents2);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });
  app3.post("/api/agents", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      console.log("Received agent creation request:", req.body);
      const validatedData = insertAgentSchema.parse(req.body);
      const agent = await storage.createAgent({
        ...validatedData,
        userId: req.user.id,
        type: validatedData.type || "ai",
        isActive: validatedData.isActive ?? true,
        voiceId: validatedData.voiceId || null
      });
      console.log("Created agent:", agent);
      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid agent data"
      });
    }
  });
  app3.get("/api/agents/:id", async (req, res) => {
    const agent = await storage.getAgent(Number(req.params.id));
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json(agent);
  });
  app3.patch("/api/agents/:id", async (req, res) => {
    try {
      const agent = await storage.getAgent(Number(req.params.id));
      if (!agent) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }
      const updatedAgent = await storage.updateAgent(Number(req.params.id), {
        ...agent,
        ...req.body
      });
      res.json(updatedAgent);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ error: "Failed to update agent" });
    }
  });
  app3.post("/api/crawl", async (req, res) => {
    try {
      console.log("Received crawl request for URL:", req.body.url);
      const crawlData = insertWebsiteCrawlSchema.parse(req.body);
      if (!crawlData.userId) {
        console.error("No user ID provided in request");
        return res.status(400).json({ error: "User ID is required" });
      }
      const userExists = await storage.getUser(Number(crawlData.userId));
      if (!userExists) {
        console.error(`User with ID ${crawlData.userId} not found`);
        return res.status(400).json({
          error: "Invalid user ID",
          details: "User not found in database"
        });
      }
      const crawl = await storage.createWebsiteCrawl({
        url: crawlData.url,
        status: "pending",
        userId: userExists.id,
        agentId: crawlData.agentId || null,
        scheduledAt: crawlData.scheduledAt,
        scheduleRecurrence: crawlData.scheduleRecurrence
      });
      try {
        let baseUrl;
        try {
          baseUrl = new URL(crawlData.url);
          if (!baseUrl.protocol) {
            baseUrl = new URL(`https://${crawlData.url}`);
          }
        } catch (error) {
          throw new Error(`Invalid URL format: ${error.message}`);
        }
        const firecrawlUrl = "https://api.firecrawl.io/v1/crawl";
        console.log("Calling Firecrawl API for URL:", baseUrl.toString());
        const firecrawlResponse = await fetch(firecrawlUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
            Accept: "application/json"
          },
          body: JSON.stringify({
            url: baseUrl.toString(),
            depth: crawlData.crawlConfig?.depth || 2,
            maxPages: crawlData.crawlConfig?.maxPages || 10,
            // Enhanced selectors for React apps
            selector: "main, article, [role='main'], .main-content, .content, div[class*='content'], div[class*='main'], section, div[data-reactroot], div[id='root'], div[id='app'], p, h1, h2, h3, h4, h5, h6",
            filters: crawlData.crawlConfig?.filters || [],
            timeout: 9e4,
            // 90 second timeout for SPAs
            waitForSelector: "#root, #app, [data-reactroot]",
            // Wait for React root
            waitUntil: ["networkidle0", "domcontentloaded"],
            // Wait for both network and DOM
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            headers: {
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5",
              "Sec-Fetch-Dest": "document",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-Site": "none",
              "Sec-Fetch-User": "?1",
              "Upgrade-Insecure-Requests": "1"
            },
            viewport: {
              width: 1920,
              height: 1080
            },
            javascript: true,
            // Enable JavaScript execution
            navigationTimeout: 3e4,
            // 30 seconds navigation timeout
            renderTimeout: 2e4,
            // 20 seconds render timeout
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
                metadata.title = title?.replace(/s+/g, ' ').trim();

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
                      return text && text.length > 50 && !text.includes('\xA9') && !text.includes('copyright');
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
            timeout: 9e4,
            // 90 second timeout for SPAs
            waitForSelector: "#root, #app, [data-reactroot]",
            // Wait for React root
            waitUntil: ["networkidle0", "domcontentloaded"],
            // Wait for both network and DOM
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            headers: {
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5",
              "Sec-Fetch-Dest": "document",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-Site": "none",
              "Sec-Fetch-User": "?1",
              "Upgrade-Insecure-Requests": "1"
            },
            viewport: {
              width: 1920,
              height: 1080
            },
            javascript: true,
            // Enable JavaScript execution
            navigationTimeout: 3e4,
            // 30 seconds navigation timeout
            renderTimeout: 2e4
            // 20 seconds render timeout
          })
        });
        if (!firecrawlResponse.ok) {
          const errorText = await firecrawlResponse.text();
          console.error("Firecrawl API error:", {
            url: baseUrl.toString(),
            status: firecrawlResponse.status,
            text: errorText
          });
          throw new Error(
            `Firecrawl API error: ${firecrawlResponse.statusText} - ${errorText}`
          );
        }
        const firecrawlData = await firecrawlResponse.json();
        console.log(
          "Firecrawl API response received for URL:",
          baseUrl.toString()
        );
        if (!firecrawlData.content || firecrawlData.content.trim().length === 0) {
          throw new Error("No content returned from Firecrawl API");
        }
        try {
          console.log("Attempting to extract metadata from crawled content");
          let extractedMetadata = null;
          if (firecrawlData.evaluationResult?.crawlMetadata) {
            extractedMetadata = firecrawlData.evaluationResult.crawlMetadata;
            console.log("Successfully extracted metadata from browser:", {
              title: extractedMetadata.title,
              hasDescription: !!extractedMetadata.description,
              servicesCount: extractedMetadata.services?.length || 0,
              pagesCount: extractedMetadata.pages?.length || 0
            });
          }
          if (!extractedMetadata?.description) {
            console.log(
              "Browser metadata extraction failed, attempting server-side extraction"
            );
            const dom = new JSDOM(firecrawlData.content);
            const document = dom.window.document;
            const titleMeta = document.querySelector(
              'meta[property="og:title"]'
            );
            const descMeta = document.querySelector(
              'meta[name="description"]'
            );
            const ogDescMeta = document.querySelector(
              'meta[property="og:description"]'
            );
            extractedMetadata = extractWebsiteMetadata(document);
            console.log("Server-side metadata extraction completed:", {
              title: extractedMetadata.title,
              hasDescription: !!extractedMetadata.description,
              servicesCount: extractedMetadata.services?.length || 0,
              pagesCount: extractedMetadata.pages?.length || 0
            });
          }
          const metadata = {
            crawledAt: (/* @__PURE__ */ new Date()).toISOString(),
            pageCount: firecrawlData.pageCount || 1,
            crawlStats: firecrawlData.stats || {},
            title: extractedMetadata.title || baseUrl.hostname,
            description: extractedMetadata.description || "A detailed analysis of this website's content and features.",
            pages: extractedMetadata.pages || [],
            services: extractedMetadata.services || [],
            lastAnalyzed: (/* @__PURE__ */ new Date()).toISOString()
          };
          const content = `# ${metadata.title}

## Introduction
${metadata.description}

${metadata.services.length > 0 ? `## Services and Features
${metadata.services.map(
            (service) => `### ${service.title}
${service.description || "No description available."}`
          ).join("\n\n")}` : ""}

${metadata.pages.length > 0 ? `## Available Pages
${metadata.pages.map((page) => `- [${page.title}](${page.path})`).join("\n")}` : ""}

## Technical Details
- Last crawled: ${metadata.crawledAt}
- Pages crawled: ${metadata.pageCount}
- Last analyzed: ${metadata.lastAnalyzed}

## Raw Content
${firecrawlData.content || ""}`;
          const knowledgeDoc = await storage.createKnowledgeDocument({
            name: `Website: ${metadata.title}`,
            type: "website",
            source: baseUrl.toString(),
            content,
            metadata,
            agentId: crawlData.agentId || void 0
          });
          console.log("Knowledge document created successfully:", {
            id: knowledgeDoc.id,
            name: knowledgeDoc.name,
            metadataPresent: !!knowledgeDoc.metadata,
            contentLength: knowledgeDoc.content?.length || 0
          });
          await storage.updateWebsiteCrawl(crawl.id, {
            status: "completed",
            documentId: knowledgeDoc.id,
            completedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
          res.status(201).json({ crawl, document: knowledgeDoc });
        } catch (error) {
          console.error("Error processing crawled content:", error);
          await storage.updateWebsiteCrawl(crawl.id, {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            completedAt: /* @__PURE__ */ new Date()
          });
          res.status(400).json({
            error: "Failed to process website content",
            details: error instanceof Error ? error.message : "Unknown error occurred",
            crawlId: crawl.id
          });
        }
      } catch (error) {
        await storage.updateWebsiteCrawl(crawl.id, {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error"
        });
        res.status(400).json({
          error: "Failed to crawl website",
          details: error instanceof Error ? error.message : "Unknown error occurred",
          crawlId: crawl.id
        });
      }
    } catch (error) {
      console.error("Crawl request error:", error);
      res.status(400).json({
        error: "Failed to process crawl request",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.get("/api/crawl/:agentId", async (req, res) => {
    try {
      const agentId = Number(req.params.agentId);
      const crawls = await storage.getWebsiteCrawls(agentId);
      crawls.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
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
  app3.get("/api/crawl/:id", async (req, res) => {
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
  app3.post("/api/knowledge-documents", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const documentData = req.body;
      console.log("Creating knowledge document:", documentData);
      const document = await storage.createKnowledgeDocument({
        name: documentData.name,
        type: documentData.type,
        source: documentData.source,
        content: documentData.content,
        metadata: documentData.metadata || null,
        agentId: documentData.agentId || null
      });
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating knowledge document:", error);
      res.status(400).json({
        error: "Failed to create knowledge document",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.patch(
    "/api/knowledge-documents/:id",
    async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        const documentId = Number(req.params.id);
        const updates = req.body;
        const document = await storage.updateKnowledgeDocument(
          documentId,
          updates
        );
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }
        res.json(document);
      } catch (error) {
        console.error("Error updating knowledge document:", error);
        res.status(400).json({
          error: "Failed to update knowledge document",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  app3.delete(
    "/api/knowledge-documents/:id",
    async (req, res) => {
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
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  app3.get("/api/knowledge-documents", async (req, res) => {
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
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.get("/api/voices", async (_req, res) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        console.warn("ELEVENLABS_API_KEY environment variable is not set");
        return res.json({
          voices: [],
          warning: "Voice selection is currently unavailable. Please configure ElevenLabs API key."
        });
      }
      console.log("Fetching voices from ElevenLabs API with provided key...");
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          Accept: "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        return res.status(response.status).json({
          error: `Failed to fetch voices: ${response.statusText}`,
          details: errorText
        });
      }
      const data = await response.json();
      console.log("ElevenLabs response:", data);
      if (!data.voices || !Array.isArray(data.voices)) {
        console.warn("Invalid response format from ElevenLabs API:", data);
        return res.json({
          voices: [],
          warning: "Invalid response from voice service"
        });
      }
      const voices = data.voices.map((voice) => ({
        id: voice.voice_id,
        name: voice.name,
        category: voice.category || "Other",
        description: voice.description || "",
        previewUrl: voice.preview_url,
        settings: voice.settings || {
          stability: 0.75,
          similarity_boost: 0.75
        }
      }));
      console.log("Processed voices:", voices);
      res.json({ voices });
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch voices"
      });
    }
  });
  app3.get("/api/analytics/chat", async (req, res) => {
    try {
      const timeRange = req.query.timeRange || "week";
      const now = /* @__PURE__ */ new Date();
      let startDate = /* @__PURE__ */ new Date();
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
      const sessions = await storage.getVoiceChatSessions();
      const filteredSessions = sessions.filter(
        (session3) => new Date(session3.started_at) >= startDate && new Date(session3.started_at) <= now
      );
      const totalSessions = filteredSessions.length;
      const uniqueUsers = new Set(
        filteredSessions.map((session3) => session3.user_id)
      ).size;
      const durationsSum = filteredSessions.reduce(
        (sum, session3) => sum + (session3.duration || 0),
        0
      );
      const averageDuration = totalSessions > 0 ? durationsSum / totalSessions : 0;
      const sessionsWithResponses = filteredSessions.filter(
        (session3) => session3.agent_response !== null
      ).length;
      const responseRate = totalSessions > 0 ? sessionsWithResponses / totalSessions : 0;
      const sessionsByDate = filteredSessions.reduce((acc, session3) => {
        const date = new Date(session3.started_at).toISOString().split("T")[0];
        const existingEntry = acc.find((entry) => entry.date === date);
        if (existingEntry) {
          existingEntry.sessions += 1;
        } else {
          acc.push({ date, sessions: 1 });
        }
        return acc;
      }, []);
      let currentDate = new Date(startDate);
      while (currentDate <= now) {
        const dateStr = currentDate.toISOString().split("T")[0];
        if (!sessionsByDate.find((entry) => entry.date === dateStr)) {
          sessionsByDate.push({ date: dateStr, sessions: 0 });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      sessionsByDate.sort((a, b) => a.date.localeCompare(b.date));
      res.json({
        totalSessions,
        averageDuration,
        totalUsers: uniqueUsers,
        responseRate,
        sessionsByDate
      });
    } catch (error) {
      console.error("Error fetching chat analytics:", error);
      res.status(500).json({ error: "Failed to fetch chat analytics" });
    }
  });
  app3.post("/api/text-to-speech", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { text: text2, voiceId } = req.body;
      if (!text2 || !voiceId) {
        return res.status(400).json({ error: "Text and voiceId are required" });
      }
      if (!process.env.ELEVENLABS_API_KEY) {
        throw new Error("ElevenLabs API key not configured");
      }
      console.log("Converting text to speech with ElevenLabs:", {
        text: text2,
        voiceId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const synthesisResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: text2,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.75
            }
          })
        }
      );
      if (!synthesisResponse.ok) {
        const errorText = await synthesisResponse.text();
        console.error("ElevenLabs synthesis error:", {
          status: synthesisResponse.status,
          text: errorText
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
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.post("/api/analyze-url", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      console.log("Analyzing URL:", url);
      try {
        new URL(url);
      } catch (error) {
        return res.status(400).json({ error: "Invalid URL format" });
      }
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch URL: ${response.status} ${response.statusText}`
        );
      }
      const html = await response.text();
      const dom = new JSDOM(html);
      const document = dom.window.document;
      document.querySelectorAll(
        'script, style, noscript, iframe, nav, footer, aside, [style*="display:none"], .social-share'
      ).forEach((el) => el.remove());
      const title = document.querySelector("title")?.textContent?.trim() || document.querySelector("h1")?.textContent?.trim() || new URL(url).hostname;
      let description = document.querySelector('meta[name="description"]')?.getAttribute("content") || document.querySelector('meta[property="og:description"]')?.getAttribute("content");
      if (!description) {
        const firstParagraph = Array.from(document.querySelectorAll("p")).find(
          (p) => {
            const text2 = p.textContent?.trim();
            return text2 && text2.length > 50;
          }
        );
        description = firstParagraph?.textContent?.trim() || "";
      }
      const mainContentSelectors = [
        "main",
        "article",
        '[role="main"]',
        ".main-content",
        "#main-content",
        ".content",
        "#content",
        "body"
      ];
      let contentElement = null;
      for (const selector of mainContentSelectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
      }
      if (!contentElement) {
        contentElement = document.body;
      }
      contentElement.querySelectorAll(
        'nav, footer, header, aside, .sidebar, [role="complementary"]'
      ).forEach((el) => el.remove());
      const textElements = contentElement.querySelectorAll(
        "p, h1, h2, h3, h4, h5, h6, li"
      );
      const mainContent = Array.from(textElements).map((el) => el.textContent?.trim()).filter((text2) => text2 && text2.length > 20).join("\n\n");
      const baseUrl = new URL(url);
      const seen = /* @__PURE__ */ new Set();
      const pages = Array.from(document.querySelectorAll("a")).map((link) => {
        const href = link.getAttribute("href");
        if (!href) return null;
        try {
          if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
            return null;
          }
          const fullUrl = new URL(href, baseUrl);
          if (fullUrl.hostname !== baseUrl.hostname || fullUrl.hostname.includes("facebook.com") || fullUrl.hostname.includes("twitter.com") || fullUrl.hostname.includes("instagram.com")) {
            return null;
          }
          fullUrl.hash = "";
          fullUrl.search = "";
          return fullUrl.href;
        } catch {
          return null;
        }
      }).filter((url2) => {
        if (!url2 || seen.has(url2)) return false;
        seen.add(url2);
        return true;
      });
      const serviceKeywords = [
        "service",
        "product",
        "solution",
        "feature",
        "package",
        "plan",
        "offer"
      ];
      const services = Array.from(document.querySelectorAll("h2, h3, h4, h5")).map((heading) => {
        const text2 = heading.textContent?.trim();
        if (!text2 || !serviceKeywords.some(
          (keyword) => text2.toLowerCase().includes(keyword) || (heading.previousElementSibling?.textContent?.toLowerCase() || "").includes(keyword)
        )) {
          return null;
        }
        let description2 = "";
        let nextElement = heading.nextElementSibling;
        let descriptionElements = 0;
        while (nextElement && descriptionElements < 2) {
          if (nextElement.tagName === "P" || nextElement.tagName === "UL" || nextElement.tagName === "OL" || nextElement.tagName === "DIV") {
            description2 += (nextElement.textContent?.trim() || "") + " ";
            descriptionElements++;
          }
          nextElement = nextElement.nextElementSibling;
        }
        return {
          title: text2,
          description: description2.trim()
        };
      }).filter(
        (service) => service !== null && service.title.length > 0
      );
      const analysisData = {
        title: title || "Untitled Page",
        description: description || "No description available",
        pages: pages.slice(0, 50),
        // Limit to 50 pages
        services: services.length > 0 ? services : [],
        content: mainContent || ""
      };
      console.log("Website analysis completed:", {
        url,
        title: analysisData.title,
        descriptionLength: analysisData.description.length,
        pagesFound: analysisData.pages.length,
        servicesFound: analysisData.services.length,
        contentLength: analysisData.content.length
      });
      res.json(analysisData);
    } catch (error) {
      console.error("Error analyzing URL:", error);
      res.status(500).json({
        error: "Failed to analyze URL",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.get("/api/crawl/:agentId", async (req, res) => {
    try {
      const agentId = Number(req.params.agentId);
      const crawls = await storage.getWebsiteCrawls(agentId);
      crawls.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
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
  app3.get("/api/crawl/:id", async (req, res) => {
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
  app3.post("/api/knowledge-documents", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const documentData = req.body;
      console.log("Creating knowledge document:", documentData);
      const document = await storage.createKnowledgeDocument({
        name: documentData.name,
        type: documentData.type,
        source: documentData.source,
        content: documentData.content,
        metadata: documentData.metadata || null,
        agentId: documentData.agentId || null
      });
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating knowledge document:", error);
      res.status(400).json({
        error: "Failed to create knowledge document",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.patch(
    "/api/knowledge-documents/:id",
    async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        const documentId = Number(req.params.id);
        const updates = req.body;
        const document = await storage.updateKnowledgeDocument(
          documentId,
          updates
        );
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }
        res.json(document);
      } catch (error) {
        console.error("Error updating knowledge document:", error);
        res.status(400).json({
          error: "Failed to update knowledge document",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  app3.delete(
    "/api/knowledge-documents/:id",
    async (req, res) => {
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
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  app3.get("/api/knowledge-documents", async (req, res) => {
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
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.get("/api/voices", async (_req, res) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        console.warn("ELEVENLABS_API_KEY environment variable is not set");
        return res.json({
          voices: [],
          warning: "Voice selection is currently unavailable. Please configure ElevenLabs API key."
        });
      }
      console.log("Fetching voices from ElevenLabs API with provided key...");
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          Accept: "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        return res.status(response.status).json({
          error: `Failed to fetch voices: ${response.statusText}`,
          details: errorText
        });
      }
      const data = await response.json();
      console.log("ElevenLabs response:", data);
      if (!data.voices || !Array.isArray(data.voices)) {
        console.warn("Invalid response format from ElevenLabs API:", data);
        return res.json({
          voices: [],
          warning: "Invalid response from voice service"
        });
      }
      const voices = data.voices.map((voice) => ({
        id: voice.voice_id,
        name: voice.name,
        category: voice.category || "Other",
        description: voice.description || "",
        previewUrl: voice.preview_url,
        settings: voice.settings || {
          stability: 0.75,
          similarity_boost: 0.75
        }
      }));
      console.log("Processed voices:", voices);
      res.json({ voices });
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch voices"
      });
    }
  });
  app3.get("/api/analytics/chat", async (req, res) => {
    try {
      const timeRange = req.query.timeRange || "week";
      const now = /* @__PURE__ */ new Date();
      let startDate = /* @__PURE__ */ new Date();
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
      const sessions = await storage.getVoiceChatSessions();
      const filteredSessions = sessions.filter(
        (session3) => new Date(session3.started_at) >= startDate && new Date(session3.started_at) <= now
      );
      const totalSessions = filteredSessions.length;
      const uniqueUsers = new Set(
        filteredSessions.map((session3) => session3.user_id)
      ).size;
      const durationsSum = filteredSessions.reduce(
        (sum, session3) => sum + (session3.duration || 0),
        0
      );
      const averageDuration = totalSessions > 0 ? durationsSum / totalSessions : 0;
      const sessionsWithResponses = filteredSessions.filter(
        (session3) => session3.agent_response !== null
      ).length;
      const responseRate = totalSessions > 0 ? sessionsWithResponses / totalSessions : 0;
      const sessionsByDate = filteredSessions.reduce((acc, session3) => {
        const date = new Date(session3.started_at).toISOString().split("T")[0];
        const existingEntry = acc.find((entry) => entry.date === date);
        if (existingEntry) {
          existingEntry.sessions += 1;
        } else {
          acc.push({ date, sessions: 1 });
        }
        return acc;
      }, []);
      let currentDate = new Date(startDate);
      while (currentDate <= now) {
        const dateStr = currentDate.toISOString().split("T")[0];
        if (!sessionsByDate.find((entry) => entry.date === dateStr)) {
          sessionsByDate.push({ date: dateStr, sessions: 0 });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      sessionsByDate.sort((a, b) => a.date.localeCompare(b.date));
      res.json({
        totalSessions,
        averageDuration,
        totalUsers: uniqueUsers,
        responseRate,
        sessionsByDate
      });
    } catch (error) {
      console.error("Error fetching chat analytics:", error);
      res.status(500).json({ error: "Failed to fetch chat analytics" });
    }
  });
  app3.post("/api/text-to-speech", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { text: text2, voiceId } = req.body;
      if (!text2 || !voiceId) {
        return res.status(400).json({ error: "Text and voiceId are required" });
      }
      if (!process.env.ELEVENLABS_API_KEY) {
        throw new Error("ElevenLabs API key not configured");
      }
      console.log("Converting text to speech with ElevenLabs:", {
        text: text2,
        voiceId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const synthesisResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: text2,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.75
            }
          })
        }
      );
      if (!synthesisResponse.ok) {
        const errorText = await synthesisResponse.text();
        console.error("ElevenLabs synthesis error:", {
          status: synthesisResponse.status,
          text: errorText
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
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.post("/api/parse-pdf", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }
      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({ error: "File must be a PDF" });
      }
      const data = await pdf(req.file.buffer);
      let cleanContent = data.text.replace(/\s+/g, " ").replace(/[^\x20-\x7E\n]/g, "").replace(/\r\n/g, "\n").replace(/\n\s*\n/g, "\n").trim();
      if (!cleanContent || cleanContent.length < 10) {
        return res.status(400).json({
          error: "Could not extract readable text from PDF"
        });
      }
      res.json({ content: cleanContent });
    } catch (error) {
      console.error("PDF parsing error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to parse PDF"
      });
    }
  });
  app3.post("/api/analyze-url", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      console.log("Analyzing URL:", url);
      try {
        new URL(url);
      } catch (error) {
        return res.status(400).json({ error: "Invalid URL format" });
      }
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch URL: ${response.status} ${response.statusText}`
        );
      }
      const html = await response.text();
      const dom = new JSDOM(html);
      const document = dom.window.document;
      document.querySelectorAll(
        'script, style, noscript, iframe, nav, footer, aside, [style*="display:none"], .social-share'
      ).forEach((el) => el.remove());
      const title = document.querySelector("title")?.textContent?.trim() || document.querySelector("h1")?.textContent?.trim() || new URL(url).hostname;
      let description = document.querySelector('meta[name="description"]')?.getAttribute("content") || document.querySelector('meta[property="og:description"]')?.getAttribute("content");
      if (!description) {
        const firstParagraph = Array.from(document.querySelectorAll("p")).find(
          (p) => {
            const text2 = p.textContent?.trim();
            return text2 && text2.length > 50;
          }
        );
        description = firstParagraph?.textContent?.trim() || "";
      }
      const mainContentSelectors = [
        "main",
        "article",
        '[role="main"]',
        ".main-content",
        "#main-content",
        ".content",
        "#content",
        "body"
      ];
      let contentElement = null;
      for (const selector of mainContentSelectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
      }
      if (!contentElement) {
        contentElement = document.body;
      }
      contentElement.querySelectorAll(
        'nav, footer, header, aside, .sidebar, [role="complementary"]'
      ).forEach((el) => el.remove());
      const textElements = contentElement.querySelectorAll(
        "p, h1, h2, h3, h4, h5, h6, li"
      );
      const mainContent = Array.from(textElements).map((el) => el.textContent?.trim()).filter((text2) => text2 && text2.length > 20).join("\n\n");
      const baseUrl = new URL(url);
      const seen = /* @__PURE__ */ new Set();
      const pages = Array.from(document.querySelectorAll("a")).map((link) => {
        const href = link.getAttribute("href");
        if (!href) return null;
        try {
          if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
            return null;
          }
          const fullUrl = new URL(href, baseUrl);
          if (fullUrl.hostname !== baseUrl.hostname || fullUrl.hostname.includes("facebook.com") || fullUrl.hostname.includes("twitter.com") || fullUrl.hostname.includes("instagram.com")) {
            return null;
          }
          fullUrl.hash = "";
          fullUrl.search = "";
          return fullUrl.href;
        } catch {
          return null;
        }
      }).filter((url2) => {
        if (!url2 || seen.has(url2)) return false;
        seen.add(url2);
        return true;
      });
      const serviceKeywords = [
        "service",
        "product",
        "solution",
        "feature",
        "package",
        "plan",
        "offer"
      ];
      const services = Array.from(document.querySelectorAll("h2, h3, h4, h5")).map((heading) => {
        const text2 = heading.textContent?.trim();
        if (!text2 || !serviceKeywords.some(
          (keyword) => text2.toLowerCase().includes(keyword) || (heading.previousElementSibling?.textContent?.toLowerCase() || "").includes(keyword)
        )) {
          return null;
        }
        let description2 = "";
        let nextElement = heading.nextElementSibling;
        let descriptionElements = 0;
        while (nextElement && descriptionElements < 2) {
          if (nextElement.tagName === "P" || nextElement.tagName === "UL" || nextElement.tagName === "OL" || nextElement.tagName === "DIV") {
            description2 += (nextElement.textContent?.trim() || "") + " ";
            descriptionElements++;
          }
          nextElement = nextElement.nextElementSibling;
        }
        return {
          title: text2,
          description: description2.trim()
        };
      }).filter(
        (service) => service !== null && service.title.length > 0
      );
      const analysisData = {
        title: title || "Untitled Page",
        description: description || "No description available",
        pages: pages.slice(0, 50),
        // Limit to 50 pages
        services: services.length > 0 ? services : [],
        content: mainContent || ""
      };
      console.log("Website analysis completed:", {
        url,
        title: analysisData.title,
        descriptionLength: analysisData.description.length,
        pagesFound: analysisData.pages.length,
        servicesFound: analysisData.services.length,
        contentLength: analysisData.content.length
      });
      res.json(analysisData);
    } catch (error) {
      console.error("Error analyzing URL:", error);
      res.status(500).json({
        error: "Failed to analyze URL",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.get("/api/crawl/:agentId", async (req, res) => {
    try {
      const agentId = Number(req.params.agentId);
      const crawls = await storage.getWebsiteCrawls(agentId);
      crawls.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
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
  app3.get("/api/crawl/:id", async (req, res) => {
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
  app3.post("/api/knowledge-documents", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const documentData = req.body;
      console.log("Creating knowledge document:", documentData);
      const document = await storage.createKnowledgeDocument({
        name: documentData.name,
        type: documentData.type,
        source: documentData.source,
        content: documentData.content,
        metadata: documentData.metadata || null,
        agentId: documentData.agentId || null
      });
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating knowledge document:", error);
      res.status(400).json({
        error: "Failed to create knowledge document",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.patch(
    "/api/knowledge-documents/:id",
    async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        const documentId = Number(req.params.id);
        const updates = req.body;
        const document = await storage.updateKnowledgeDocument(
          documentId,
          updates
        );
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }
        res.json(document);
      } catch (error) {
        console.error("Error updating knowledge document:", error);
        res.status(400).json({
          error: "Failed to update knowledge document",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  app3.delete(
    "/api/knowledge-documents/:id",
    async (req, res) => {
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
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  app3.get("/api/knowledge-documents", async (req, res) => {
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
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app3.get("/api/voices", async (_req, res) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        console.warn("ELEVENLABS_API_KEY environment variable is not set");
        return res.json({
          voices: [],
          warning: "Voice selection is currently unavailable. Please configure ElevenLabs API key."
        });
      }
      console.log("Fetching voices from ElevenLabs API with provided key...");
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          Accept: "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        return res.status(response.status).json({
          error: `Failed to fetch voices: ${response.statusText}`,
          details: errorText
        });
      }
      const data = await response.json();
      console.log("ElevenLabs response:", data);
      if (!data.voices || !Array.isArray(data.voices)) {
        console.warn("Invalid response format from ElevenLabs API:", data);
        return res.json({
          voices: [],
          warning: "Invalid response from voice service"
        });
      }
      const voices = data.voices.map((voice) => ({
        id: voice.voice_id,
        name: voice.name,
        category: voice.category || "Other",
        description: voice.description || "",
        previewUrl: voice.preview_url,
        settings: voice.settings || {
          stability: 0.75,
          similarity_boost: 0.75
        }
      }));
      console.log("Processed voices:", voices);
      res.json({ voices });
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch voices"
      });
    }
  });
  app3.get("/api/analytics/chat", async (req, res) => {
    try {
      const timeRange = req.query.timeRange || "week";
      const now = /* @__PURE__ */ new Date();
      let startDate = /* @__PURE__ */ new Date();
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
      const sessions = await storage.getVoiceChatSessions();
      const filteredSessions = sessions.filter(
        (session3) => new Date(session3.started_at) >= startDate && new Date(session3.started_at) <= now
      );
      const totalSessions = filteredSessions.length;
      const uniqueUsers = new Set(
        filteredSessions.map((session3) => session3.user_id)
      ).size;
      const durationsSum = filteredSessions.reduce(
        (sum, session3) => sum + (session3.duration || 0),
        0
      );
      const averageDuration = totalSessions > 0 ? durationsSum / totalSessions : 0;
      const sessionsWithResponses = filteredSessions.filter(
        (session3) => session3.agent_response !== null
      ).length;
      const responseRate = totalSessions > 0 ? sessionsWithResponses / totalSessions : 0;
      const sessionsByDate = filteredSessions.reduce((acc, session3) => {
        const date = new Date(session3.started_at).toISOString().split("T")[0];
        const existingEntry = acc.find((entry) => entry.date === date);
        if (existingEntry) {
          existingEntry.sessions += 1;
        } else {
          acc.push({ date, sessions: 1 });
        }
        return acc;
      }, []);
      let currentDate = new Date(startDate);
      while (currentDate <= now) {
        const dateStr = currentDate.toISOString().split("T")[0];
        if (!sessionsByDate.find((entry) => entry.date === dateStr)) {
          sessionsByDate.push({ date: dateStr, sessions: 0 });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      sessionsByDate.sort((a, b) => a.date.localeCompare(b.date));
      res.json({
        totalSessions,
        averageDuration,
        totalUsers: uniqueUsers,
        responseRate,
        sessionsByDate
      });
    } catch (error) {
      console.error("Error fetching chat analytics:", error);
      res.status(500).json({ error: "Failed to fetch chat analytics" });
    }
  });
  app3.post("/api/text-to-speech", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { text: text2, voiceId } = req.body;
      if (!text2 || !voiceId) {
        return res.status(400).json({ error: "Text and voiceId are required" });
      }
      if (!process.env.ELEVENLABS_API_KEY) {
        throw new Error("ElevenLabs API key not configured");
      }
      console.log("Converting text to speech with ElevenLabs:", {
        text: text2,
        voiceId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const synthesisResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: text2,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.75
            }
          })
        }
      );
      if (!synthesisResponse.ok) {
        const errorText = await synthesisResponse.text();
        console.error("ElevenLabs synthesis error:", {
          status: synthesisResponse.status,
          text: errorText
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
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  return httpServer;
}

// server/vite.ts
import express2 from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app3, server2) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server: server2 },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app3.use(vite.middlewares);
  app3.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app3) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app3.use(express2.static(distPath));
  app3.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app2 = express3();
var PORT = process.env.PORT || 5e3;
var server = createServer2(app2);
app2.use(express3.json({ limit: "50mb" }));
app2.use(express3.urlencoded({ extended: false, limit: "50mb" }));
app2.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});
app2.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server2 = await registerRoutes(app2);
  app2.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app2.get("env") === "development") {
    await setupVite(app2, server2);
  } else {
    serveStatic(app2);
  }
  if (process.env.NODE_ENV === "development") {
    await setupVite(app2, server2);
  } else {
    serveStatic(app2);
  }
  server2.listen(PORT, "0.0.0.0", () => {
    log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(process.env.OPENAI_API_SECRET, "url key openai");
  });
  return server2;
})();
