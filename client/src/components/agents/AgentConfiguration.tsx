"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type Agent } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import RealtimeAgentDialog from "./RealtimeAgentDialog";
import { Slider } from "@/components/ui/slider";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import VoiceSelector from "./VoiceSelector";
import { useAuth } from '@/context/AuthContext';

interface AgentConfigurationProps {
  agent: Agent;
}

export default function AgentConfiguration({ agent }: AgentConfigurationProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Add a check to prevent unauthorized access
  if (!agent || (agent.userId !== user?.id)) {
    return (
      <div className="flex-1 p-4">
        <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view or modify this agent.</p>
      </div>
    );
  }

  const [selectedVoiceId, setSelectedVoiceId] = useState(agent.voiceId || '');
  const [stability, setStability] = useState(
    agent.voiceSettings?.stability
      ? agent.voiceSettings.stability * 100
      : 75
  );
  const [similarityBoost, setSimilarityBoost] = useState(
    agent.voiceSettings?.similarity_boost
      ? agent.voiceSettings.similarity_boost * 100
      : 75
  );
  const [name, setName] = useState(agent.name || '');
  const [description, setDescription] = useState(agent.description || '');
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || '');
  const [isActive, setIsActive] = useState(agent.isActive);
  const [greetingMessage, setGreetingMessage] = useState(agent.greetingMessage || '');

  const { data: voicesResponse } = useQuery<{ voices: any[], warning?: string, error?: string }>({
    queryKey: ["/api/voices"],
    retry: 3,
  });

  const updateAgentMutation = useMutation({
    mutationFn: async (updates: Partial<Agent>) => {
      console.log("Updating agent with:", updates);
      return apiRequest("PATCH", `/api/agents/${agent.id}`, updates);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to update agent",
        variant: "destructive",
      });
    }
  });

  const handleBasicSettingsChange = () => {
    updateAgentMutation.mutate({
      name,
      description,
      systemPrompt: systemPrompt || null,
      greetingMessage: greetingMessage || null
    });
  };

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    updateAgentMutation.mutate({ voiceId });
  };

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{agent.name}</h2>
          <p className="text-sm text-muted-foreground">Configure your AI agent settings</p>
        </div>
        <RealtimeAgentDialog agent={agent} />
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle>Basic Settings</CardTitle>
              <CardDescription>Configure the basic properties of your agent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleBasicSettingsChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleBasicSettingsChange}
                />
              </div>
              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  onBlur={handleBasicSettingsChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Greeting Message</Label>
                <Textarea
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                  placeholder="Enter a greeting message that will be spoken when starting a voice call"
                  onBlur={handleBasicSettingsChange}
                />
                <p className="text-sm text-muted-foreground">
                  This message will be spoken by the agent when starting a voice conversation.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) => {
                    setIsActive(checked);
                    updateAgentMutation.mutate({ isActive: checked });
                  }}
                />
                <Label>Active</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice">
          <Card>
            <CardHeader>
              <CardTitle>Voice Selection</CardTitle>
              <CardDescription>
                Choose the voice for your agent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VoiceSelector
                value={selectedVoiceId}
                onChange={handleVoiceChange}
              />
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Voice Settings</CardTitle>
              <CardDescription>
                Adjust the voice characteristics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Stability</Label>
                <Slider
                  value={[stability]}
                  max={100}
                  step={1}
                  className="w-full"
                  onValueChange={(value) => setStability(value[0])}
                />
              </div>
              <div className="space-y-4">
                <Label>Similarity Boost</Label>
                <Slider
                  value={[similarityBoost]}
                  max={100}
                  step={1}
                  className="w-full"
                  onValueChange={(value) => setSimilarityBoost(value[0])}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Configure access and authentication settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Require Authentication</Label>
                  <Switch />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}