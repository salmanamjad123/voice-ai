import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Agent } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Send, Mic, Square, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createWebSocketConnection } from '@/lib/websocket';

interface AgentChatDialogProps {
  agent: Agent;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export default function AgentChatDialog({ agent }: AgentChatDialogProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const websocketRef = useRef<WebSocket | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const cleanResponse = (text: string): string => {
    return text.replace(/\*\*/g, "");
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend) return;

    try {
      setIsLoading(true);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: textToSend, timestamp: new Date() },
      ]);
      setInput("");

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Agent is thinking...",
          timestamp: new Date(),
        },
      ]);

      const response = await apiRequest("POST", "/api/chat", {
        agentId: agent.id,
        message: textToSend,
      });
      if (!response.ok) throw new Error("Failed to get response from agent");

      const data = await response.json();
      const cleanedResponse = cleanResponse(data.response);

      setMessages((prev) => {
        const updatedMessages = [...prev];
        updatedMessages[updatedMessages.length - 1] = {
          role: "assistant",
          content: cleanedResponse,
          timestamp: new Date(),
        };
        return updatedMessages;
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setupWebSocket = useCallback(() => {
    if (!agent.voiceId) {
      toast({
        title: "Voice Not Configured",
        description: "Please configure a voice for this agent in the agent settings before starting voice chat.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create WebSocket connection using utility
      const ws = createWebSocketConnection(`/ws/transcription/${agent.id}`);
      websocketRef.current = ws;

      ws.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        handleSendMessage(data.transcription);
      });

    } catch (error) {
      console.error("WebSocket error:", error);
      toast({
        title: "Voice Chat Error",
        description: "An error occurred during voice chat. Please try again later.",
        variant: "destructive",
      });
      cleanup();
    }
  }, [agent.id, agent.voiceId, toast, handleSendMessage]);

  const startRecording = async () => {
    try {
      if (!agent.voiceId) {
        toast({
          title: "Voice Not Configured",
          description:
            "Please configure a voice for this agent in the agent settings before starting voice chat.",
          variant: "destructive",
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        chunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        // Send blob to server for processing
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.wav");
          const response = await fetch("/api/voice-chat", {
            method: "POST",
            body: formData,
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          handleSendMessage(data.transcription);
        } catch (error) {
          console.error("Error sending recording:", error);
          toast({
            title: "Recording Error",
            description:
              error instanceof Error
                ? error.message
                : "Could not send recording",
            variant: "destructive",
          });
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setupWebSocket();
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Recording Error",
        description:
          error instanceof Error
            ? error.message
            : "Could not access microphone",
        variant: "destructive",
      });
      cleanup();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cleanup = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    chunksRef.current = [];
    setIsRecording(false);
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Chat with AI agent</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Chat with {agent.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col h-[400px]">
          <ScrollArea
            ref={scrollAreaRef}
            className="flex-1 px-4 py-2 border rounded-md mb-4"
          >
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Start a conversation with your AI agent
              </p>
            ) : (
              <div className="space-y-4">
                {messages.map((message, i) => (
                  <div
                    key={i}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p>{message.content}</p>
                      <p className="text-xs opacity-50 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !isLoading && !isRecording) {
                  handleSendMessage();
                }
              }}
              disabled={isLoading || isRecording}
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !input.trim() || isRecording}
            >
              <Send className="h-4 w-4" />
            </Button>

            {/* <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    {!isRecording ? (
                      <Button
                        variant="outline"
                        onClick={startRecording}
                        disabled={isLoading || !agent.voiceId}
                        className={`flex-shrink-0 ${
                          !agent.voiceId ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <Mic className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        onClick={stopRecording}
                        className="flex-shrink-0"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {!agent.voiceId
                    ? "Please configure a voice for this agent in settings before using voice chat"
                    : isRecording
                    ? "Stop recording"
                    : "Start voice chat"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider> */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}