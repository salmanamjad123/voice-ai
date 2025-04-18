"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Agent } from "@shared/schema";
import { Mic, Square } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface RealtimeAgentDialogProps {
  agent: Agent;
}

const RealtimeAgentDialog: React.FC<RealtimeAgentDialogProps> = ({ agent }) => {
  const [message, setMessage] = useState<string>("");
  const [response, setResponse] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>("en-US");
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef<boolean>(false);

  const playNextInQueue = async () => {
    if (audioQueueRef.current.length === 0 || isPlayingRef.current) return;

    isPlayingRef.current = true;
    const nextAudio = audioQueueRef.current.shift();
    if (nextAudio && audioRef.current) {
      try {
        audioRef.current.src = `data:audio/mpeg;base64,${nextAudio}`;
        await audioRef.current.play();
      } catch (error) {
        console.error('Audio playback error:', error);
        isPlayingRef.current = false;
        playNextInQueue(); 
      }
    } else {
      isPlayingRef.current = false;
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => {
        isPlayingRef.current = false;
        playNextInQueue();
        if (isListening && !isProcessing) {
          startSpeechRecognition();
        }
      };
    }
  }, [isListening, isProcessing]);

  const playAudioFromBase64 = async (base64Audio: string) => {
    audioQueueRef.current.push(base64Audio);
    await playNextInQueue();
  };

  const requestMicrophoneAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      console.error("Microphone access error:", error);
      setShowPermissionHelp(true);
      toast({
        title: `Microphone Access Required - ${getBrowserName()}`,
        description: getPermissionInstructions(),
        variant: "destructive",
      });
      return false;
    }
  };

  const handleAgentResponse = async (text: string) => {
    try {
      setResponse(text);
      const res = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          voiceId: agent.voiceId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get speech response");
      }

      const data = await res.json();
      if (data.audio) {
        await playAudioFromBase64(data.audio);
      }
    } catch (error) {
      console.error("Error getting voice response:", error);
      toast({
        title: "Voice Response Error",
        description: "Failed to get voice response from agent",
        variant: "destructive",
      });
    }
  };

  const startSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    recognitionRef.current = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognitionRef.current.lang = language;
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onresult = async (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      console.log("Recognized Text:", transcript);
      setMessage(transcript);

      if (isProcessing) return;

      setIsProcessing(true);
      recognitionRef.current.stop(); 

      try {
        const res = await fetch("/api/voice-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentId: agent.id,
            message: transcript,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to get response from agent");
        }

        const data = await res.json();
        await handleAgentResponse(data.text);
      } catch (error) {
        console.error("Error in voice chat:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to process voice chat",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
        if (isListening) {
          startSpeechRecognition(); 
        }
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setShowPermissionHelp(true);
        toast({
          title: "Microphone Access Required",
          description: getPermissionInstructions(),
          variant: "destructive",
        });
      }

      if (!isListening) {
        cleanup();
      } else {
        setTimeout(startSpeechRecognition, 1000);
      }
    };

    recognitionRef.current.start();
    console.log("Speech recognition started");
  };

  const getBrowserName = () => {
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf("Chrome") > -1) return "Chrome";
    if (userAgent.indexOf("Safari") > -1) return "Safari";
    if (userAgent.indexOf("Firefox") > -1) return "Firefox";
    if (userAgent.indexOf("Edge") > -1) return "Edge";
    return "Unknown";
  };

  const getPermissionInstructions = () => {
    const browser = getBrowserName();
    switch (browser) {
      case "Chrome":
        return "Click the camera icon in the address bar and allow microphone access.";
      case "Firefox":
        return "Click the microphone icon in the address bar and choose 'Allow'.";
      case "Safari":
        return "Open Safari Preferences > Websites > Microphone and allow access.";
      case "Edge":
        return "Click the lock icon in the address bar and enable microphone access.";
      default:
        return "Please check your browser settings to allow microphone access.";
    }
  };

  const playGreeting = async () => {
    try {
      if (!agent.greetingMessage) {
        console.log("No greeting message configured");
        startSpeechRecognition();
        return;
      }

      console.log("Playing greeting message:", agent.greetingMessage);

      const res = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: agent.greetingMessage,
          voiceId: agent.voiceId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get speech response");
      }

      const data = await res.json();
      console.log("Greeting audio response received");

      if (data.audio) {
        await playAudioFromBase64(data.audio);
      } else {
        console.warn("No audio received for greeting");
        startSpeechRecognition();
      }
    } catch (error) {
      console.error("Error playing greeting:", error);
      startSpeechRecognition();
    }
  };

  const startCall = async () => {
    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        toast({
          title: "Browser Not Supported",
          description: "Please use Chrome, Edge, or Firefox for voice chat.",
          variant: "destructive",
        });
        return;
      }

      if (!agent.voiceId) {
        toast({
          title: "Voice Not Configured",
          description:
            "Please configure a voice for this agent in settings first.",
          variant: "destructive",
        });
        return;
      }

      if (isListening) return;

      const hasAccess = await requestMicrophoneAccess();
      if (!hasAccess) return;

      setIsListening(true);
      setResponse("");
      setShowPermissionHelp(false);
      setIsProcessing(false);

      console.log("Starting call, playing greeting...");
      await playGreeting();

    } catch (error) {
      console.error("Error starting call:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Could not start voice chat",
        variant: "destructive",
      });
      cleanup();
    }
  };

  const stopCall = () => {
    if (!isListening) return;
    cleanup();
  };

  const cleanup = () => {
    setIsListening(false);
    setIsProcessing(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      console.log("Call ended. Stopped listening.");
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          stopCall();
          setShowPermissionHelp(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Mic className="h-4 w-4 mr-2" />
          Voice Conversation
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Test {agent.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Have a voice conversation with your AI agent
          </p>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative w-48 h-48 rounded-full bg-gradient-to-br from-pink-100 to-green-100">
            {!isListening ? (
              <Button
                size="icon"
                variant="ghost"
                className="absolute inset-0 m-auto w-16 h-16 rounded-full"
                onClick={startCall}
                disabled={isListening}
              >
                <Mic className="w-8 h-8" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="absolute inset-0 m-auto w-16 h-16 rounded-full"
                onClick={stopCall}
              >
                <Square className="w-8 h-8" />
              </Button>
            )}
          </div>

          <div className="text-center mt-4">
            <p className="text-sm text-muted-foreground">
              {isProcessing
                ? "Processing your message..."
                : isListening
                ? "Listening... Click the square to stop."
                : "Click the mic to start speaking."}
            </p>
            {showPermissionHelp && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Browser Permission Required</AlertTitle>
                <AlertDescription>
                  {getPermissionInstructions()}
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2 mt-4">
              <p className="font-medium">
                You: <span className="font-normal">{message}</span>
              </p>
              <p className="font-medium">
                Bot: <span className="font-normal">{response}</span>
              </p>
            </div>
          </div>
        </div>

        <audio ref={audioRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
};

export default RealtimeAgentDialog;