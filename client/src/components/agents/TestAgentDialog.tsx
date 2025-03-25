import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react"; // Ensure these icons are imported
import { useToast } from "@/hooks/use-toast"; // Assuming this is available in your project

interface AgentChatDialogProps {
  agent: Agent;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export default function TestAgentDialog({ agent }: AgentChatDialogProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false); // Track recording state
  const [chatStatus, setChatStatus] = useState("idle"); // Track chat status (idle, recording, etc.)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null); // Store the recorded audio blob
  const [agentResponse, setAgentResponse] = useState<string | null>(null); // Store agent's text response
  const mediaRecorderRef = useRef<MediaRecorder | null>(null); // Reference to MediaRecorder

  const apiRequest = async (method: "POST", url: string, body: any) => {
    const headers = {
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error("API request failed");
    }

    return response;
  };
  const cleanResponse = (text: string): string => {
    // Remove any special characters such as '**' or others
    return text.replace(/\*\*/g, ""); // Example: Remove '**' symbols
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

      // Unified API call to /api/chat-and-voice
      const response = await apiRequest("POST", "/api/voice-chat", {
        agentId: agent.id,
        message: textToSend,
      });

      if (!response.ok) {
        // If the response status isn't OK (e.g., 400, 500, etc.), log the error
        console.error("API Error: ", response.status, await response.text());
        throw new Error("Failed to get response from the API");
      }

      // Try to parse the response as JSON
      const data = await response.json();

      if (!data.text || !data.audio) {
        throw new Error("Invalid response format from API");
      }

      const cleanedResponse = cleanResponse(data.text); // Clean the response before adding it

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: cleanedResponse, timestamp: new Date() },
      ]);

      setAgentResponse(cleanedResponse);

      // Play the audio from the API response
      const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
      setAudioElement(audio);
      audio.load(); // Ensure it's fully ready for playback

      audio.play().catch((error) => {
        console.error("Error playing audio:", error);
        toast({
          title: "Audio Playback Error",
          description: "Failed to play the audio message.",
          variant: "destructive",
        });
      });
    } catch (error) {
      console.error("Error during message handling:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addAudioElement = async (blob: Blob) => {
    try {
      console.log("Recording audio...");

      // Convert the blob to a FormData object
      const formData = new FormData();
      formData.append("file", blob, "recording.webm"); // Ensure the key is 'file' (required by OpenAI)
      formData.append("model", "whisper-1"); // Use the Whisper model for transcription

      const apiKey =process.env.OPENAI_API_KEY;
        
      const openaiUrl = "https://api.openai.com/v1/audio/transcriptions";

      const transcriptionResponse = await fetch(openaiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        console.error("Error response:", errorText);
        throw new Error("Failed to transcribe audio");
      }

      const transcriptionData = await transcriptionResponse.json();
      const transcribedText = transcriptionData.text;

      handleSendMessage(transcribedText);
    } catch (error) {
      console.error("Error while processing audio:", error);
      toast({
        title: "Error",
        description: "Failed to process the audio. Please try again.",
        variant: "destructive",
      });
    }
  };

  const startRecording = async () => {
    if (isRecording) return; // If already recording, do nothing

    setChatStatus("greeting"); // Set status to "greeting" while starting recording
    setIsRecording(true); // Set recording state to true
    setChatStatus("recording"); // Set status to "recording"

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        addAudioElement(audioBlob); // Process the audio for transcription
      };

      recorder.start();
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Recording Error",
        description: "Failed to start the recording. Please try again.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;

    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setChatStatus("idle"); // Reset status when done
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "greeting":
        return "Starting recording...";
      case "recording":
        return "Recording in progress...";
      case "idle":
        return "Ready for your voice input.";
      case "error":
        return "There was an error. Please try again.";
      default:
        return "Idle";
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          // Cleanup when dialog closes
          if (audioElement) {
            audioElement.pause();
            audioElement.currentTime = 0;
          }
          setIsRecording(false); // Reset the recording state
          setChatStatus("idle"); // Reset the chat status
          setAgentResponse(null); // Reset the agent's response text when dialog closes
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Voice Conversation </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Test {agent.name}</DialogTitle>
          <DialogDescription>
            Have a voice conversation with your AI agent
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative w-48 h-48 rounded-full bg-gradient-to-br from-pink-100 to-green-100">
            {!isRecording ? (
              <Button
                size="icon"
                variant="ghost"
                className="absolute inset-0 m-auto w-16 h-16 rounded-full"
                onClick={startRecording}
                disabled={chatStatus === "error" || chatStatus === "greeting"}
              >
                <Mic className="w-8 h-8" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="absolute inset-0 m-auto w-16 h-16 rounded-full"
                onClick={stopRecording}
              >
                <Square className="w-8 h-8" />
              </Button>
            )}
          </div>

          <div className="text-center mt-4">
            <p className="text-sm text-muted-foreground">
              {getStatusText(chatStatus)}
            </p>
            {isLoading && (
              <div className="mt-4">
                <p className="text-lg font-semibold text-muted-foreground">
                  Agent is thinking...
                </p>
              </div>
            )}
            {/* Display the agent's response text while the audio is playing */}
            {agentResponse && (
              <div className="mt-4">
                <p className="text-lg font-semibold text-muted-foreground">
                  {agentResponse}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
