import { useState } from "react";
import { extractRawText } from 'mammoth';  // For parsing .docx files
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy } from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertKnowledgeDocumentSchema } from "@shared/schema";
import { useAuth } from "@/context/AuthContext";

// PDF extraction function using pdf.js
const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let content = [];
    let currentHeadingLevel = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      for (const item of textContent.items) {
        const text = (item as any).str.trim();
        if (!text) continue;

        // Extract style information
        const fontSize = (item as any).height || 0;
        const fontFamily = (item as any).fontName || '';
        const isBold = fontFamily.toLowerCase().includes('bold');

        // Format text based on style
        if (fontSize > 16 || (fontSize > 14 && isBold)) {
          content.push(`\n# ${text}\n`);
        } else if (fontSize > 14 || (fontSize > 12 && isBold)) {
          content.push(`\n## ${text}\n`);
        } else if (fontSize > 12 || isBold) {
          content.push(`\n### ${text}\n`);
        } else if (text.match(/^[•\-\*]\s+/) || text.match(/^\d+\.\s+/)) {
          // List items
          content.push(`\n- ${text}\n`);
        } else {
          // Regular paragraph text
          content.push(`${text} `);
        }
      }
      content.push('\n\n'); // Page break
    }

    return cleanText(content.join(''));
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF. Please ensure it is a valid PDF document.');
  }
};

// Word Document extraction function using mammoth
const extractTextFromWord = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await extractRawText({ arrayBuffer });
    const lines = result.value.split('\n');
    const formattedContent = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        inList = false;
        formattedContent.push('\n');
        continue;
      }

      // Handle list items
      if (line.match(/^[•\-\*]\s+/) || line.match(/^\d+\.\s+/)) {
        if (!inList) formattedContent.push('\n');
        inList = true;
        formattedContent.push(`- ${line.replace(/^[•\-\*\d+\.\s]+/, '')}\n`);
        continue;
      }

      // Handle headings
      if (line.length < 100 && line.match(/^[A-Z][^.!?]*$/)) {
        if (i === 0 || (lines[i-1] && !lines[i-1].trim())) {
          inList = false;
          formattedContent.push(line.toUpperCase() === line ? `\n# ${line}\n` : `\n## ${line}\n`);
          continue;
        }
      }

      // Regular text
      inList = false;
      formattedContent.push(`${line}\n`);
    }

    return cleanText(formattedContent.join(''));
  } catch (error) {
    console.error('Word document extraction error:', error);
    throw new Error('Failed to extract text from Word document. Please ensure it is a valid .docx file.');
  }
};

const cleanText = (text: string): string => {
  return text
    .trim()
    // Remove control characters and special markers
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // Remove PDF artifacts
    .replace(/(\d+\s+\d+\s+obj)|endobj|stream|endstream|<<|>>/g, '')
    // Fix heading formatting
    .replace(/^(#{1,6})\s*(.+)$/gm, '$1 $2')
    // Clean up multiple line breaks
    .replace(/\n{3,}/g, '\n\n')
    // Clean up spaces
    .replace(/[ \t]+/g, ' ')
    // Fix heading spacing
    .replace(/([^#])\n(#+ )/g, '$1\n\n$2')
    .replace(/(#+ .*)\n(?!#|\n)/g, '$1\n\n')
    // Clean list formatting
    .replace(/^-\s*([•\-\*]|\d+\.)\s*/gm, '- ')
    .trim();
};

const isValidUrl = (urlString: string) => {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const isValidDomain = (url: string) => {
  try {
    const { hostname } = new URL(url);
    // Check for common invalid domains
    return !hostname.includes('localhost') &&
           !hostname.includes('127.0.0.1') &&
           hostname.includes('.');
  } catch {
    return false;
  }
};

const CreateDocumentDialog = () => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [urlAnalysis, setUrlAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState<string | null>(null);

  const createDocumentMutation = useMutation({
    mutationFn: async (data: { name: string; content: string; type: string; source: string; metadata?: any }) => {
      const documentData = {
        ...data,
        userId: user?.id,
      };

      console.log("Creating document with data:", documentData);

      const validatedData = insertKnowledgeDocumentSchema.parse(documentData);
      const res = await apiRequest("POST", "/api/knowledge-documents", validatedData);

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create document");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-documents"] });
      toast({
        title: "Success",
        description: "Document created successfully",
      });
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setUrl("");
    setUrlAnalysis(null);
    setTextContent("");
    setFileName("");
    setFileContent(null);
  };

  const analyzeUrl = async () => {
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      });
      return;
    }

    // Basic URL validation
    if (!isValidUrl(url)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL starting with http:// or https://",
        variant: "destructive",
      });
      return;
    }

    // Domain validation
    if (!isValidDomain(url)) {
      toast({
        title: "Invalid Domain",
        description: "Please enter a valid website domain. Please do not use localhost or IP addresses.",
        variant: "destructive",
      });
      return;
    }

    try {
      setAnalyzing(true);
      setUrlAnalysis(null); // Clear previous analysis

      const res = await fetch("/api/analyze-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        let errorMessage = "Failed to analyze URL";
        try {
          const errorData = await res.json();
          if (res.status === 500) {
            errorMessage = "Internal server error. Please try again later or check if the website is accessible.";
          } else {
            errorMessage = errorData.details || errorData.error || errorMessage;
          }
        } catch {
          // If JSON parsing fails, use status text
          errorMessage = `Failed to analyze URL: ${res.statusText}. Please check if the website is accessible.`;
        }

        throw new Error(errorMessage);
      }

      const analysis = await res.json();

      // Validate the analysis data
      if (!analysis.title && !analysis.description && (!analysis.pages || analysis.pages.length === 0)) {
        throw new Error("Unable to extract meaningful content from the website. Please check if the URL is correct and the website is accessible.");
      }

      setUrlAnalysis(analysis);
      toast({
        title: "Analysis Complete",
        description: "Website analysis completed successfully",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze URL";
      console.error("URL analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setUrlAnalysis(null);
    } finally {
      setAnalyzing(false);
    }
  };


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setFileName(file.name);
      let content: string;

      // Validate file size
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File size exceeds 10MB limit');
      }

      // Process based on file type
      switch (file.type) {
        case 'application/pdf':
          content = await extractTextFromPdf(file);
          break;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          content = await extractTextFromWord(file);
          break;
        case 'text/plain':
          content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(cleanText(e.target?.result as string));
            reader.onerror = reject;
            reader.readAsText(file);
          });
          break;
        default:
          throw new Error(`Unsupported file type: ${file.type}`);
      }

      if (!content || content.length < 10) {
        throw new Error('Could not extract readable content from the file');
      }

      setFileContent(content);
    } catch (error) {
      console.error('File processing error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process file",
        variant: "destructive",
      });
      setFileName("");
      setFileContent(null);
    }
  };

  const handleSubmit = async (type: 'file' | 'url' | 'text') => {
    try {
      let data;
      switch (type) {
        case 'file':
          if (!fileName || !fileContent) {
            toast({
              title: "Error",
              description: "Please select a file",
              variant: "destructive",
            });
            return;
          }
          data = {
            name: fileName,
            content: fileContent,
            type: 'file',
            source: fileName,
          };
          break;
        case 'url':
          if (!url || !urlAnalysis) {
            toast({
              title: "Error",
              description: "Please analyze the URL first",
              variant: "destructive",
            });
            return;
          }
          data = {
            name: `Website: ${urlAnalysis.title || url}`,
            content: urlAnalysis.content,
            type: 'url',
            source: url,
            metadata: {
              pages: urlAnalysis.pages,
              services: urlAnalysis.services,
              description: urlAnalysis.description,
              lastAnalyzed: new Date().toISOString(),
            },
          };
          break;
        case 'text':
          if (!textContent) {
            toast({
              title: "Error",
              description: "Please enter some text",
              variant: "destructive",
            });
            return;
          }
          data = {
            name: "Text Document",
            content: textContent,
            type: 'text',
            source: 'manual',
          };
          break;
      }

      await createDocumentMutation.mutateAsync(data);
    } catch (error) {
      console.error('Error creating document:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create knowledge base document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create knowledge base document</DialogTitle>
          <DialogDescription>
            Upload files that will be passed to the LLM alongside the prompt.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="file">File</TabsTrigger>
            <TabsTrigger value="url">URL</TabsTrigger>
            <TabsTrigger value="text">Text</TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4">
            <div className="grid w-full gap-4">
              <div className="grid gap-2">
                <Label htmlFor="file">Upload files</Label>
                <div
                  className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <Input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept=".txt,.pdf,.doc,.docx"
                    onChange={handleFileChange}
                  />
                  <div className="text-center">
                    {fileName ? (
                      <p>Selected file: {fileName}</p>
                    ) : (
                      <>
                        <p>Click or drag files to upload</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Supported types: txt, pdf, doc, docx
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button
                onClick={() => handleSubmit('file')}
                disabled={!fileContent || createDocumentMutation.isPending}
              >
                Upload Document
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="url">Website URL</Label>
              <div className="flex gap-2">
                <Input
                  id="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  type="url"
                />
                <Button
                  onClick={analyzeUrl}
                  disabled={!url || analyzing}
                  variant="secondary"
                >
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Analyze"
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter a valid website URL starting with http:// or https://
              </p>

              {urlAnalysis && (
                <div className="mt-4 space-y-4">
                  <div className="rounded-lg border p-4 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{urlAnalysis.title}</h3>
                      <div className="prose prose-sm max-w-none">
                        <h4 className="text-sm font-medium mb-1">Introduction</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                          {urlAnalysis.description || 'No description available'}
                        </p>
                      </div>
                    </div>

                    {urlAnalysis.pageContents && urlAnalysis.pageContents.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Page Content</h4>
                        <div className="space-y-3">
                          {urlAnalysis.pageContents.map((section, i) => (
                            <div key={i} className="p-3 bg-muted rounded-md">
                              <h5 className="font-medium">{section.title}</h5>
                              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
                                {section.content}
                              </p>
                              {section.features && section.features.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-sm font-medium">Features:</p>
                                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                                    {section.features.map((feature, j) => (
                                      <li key={j}>{feature}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {urlAnalysis.services && urlAnalysis.services.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Services & Features</h4>
                        <div className="space-y-3">
                          {urlAnalysis.services.map((service: any, i: number) => (
                            <div key={i} className="p-3 bg-muted rounded-md">
                              <h5 className="font-medium">{service.title}</h5>
                              {service.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {service.description}
                                </p>
                              )}
                              {service.features && service.features.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-sm font-medium">Features:</p>
                                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                                    {service.features.map((feature, j) => (
                                      <li key={j}>{feature}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {urlAnalysis.pages && urlAnalysis.pages.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Available Pages</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {urlAnalysis.pages.map((page: any, i: number) => (
                            <div key={i} className="text-sm p-2 bg-muted rounded-md">
                              <div className="font-medium truncate">{page.title}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {page.path}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Technical Details</h4>
                      <div className="text-sm text-muted-foreground">
                        <p>Last analyzed: {new Date(urlAnalysis.lastAnalyzed).toLocaleString()}</p>
                        <p>Pages crawled: {urlAnalysis.pageCount}</p>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleSubmit('url')}
                    disabled={createDocumentMutation.isPending}
                    className="w-full"
                  >
                    Create Document from Website
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="text">Text content</Label>
              <Textarea
                id="text"
                placeholder="Enter your text here..."
                className="min-h-[200px]"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
              <Button
                onClick={() => handleSubmit('text')}
                disabled={!textContent || createDocumentMutation.isPending}
              >
                Create Text Document
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDocumentDialog;