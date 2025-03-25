import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KnowledgeDocument, Agent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Edit2, Trash2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DocumentDetailsDialogProps {
  document: KnowledgeDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DocumentDetailsDialog({
  document,
  open,
  onOpenChange,
}: DocumentDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editedDocument, setEditedDocument] = useState<KnowledgeDocument | null>(null);
  const { toast } = useToast();

  // Fetch available agents
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    enabled: open, // Only fetch when dialog is open
  });

  // Reset states when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    setIsEditing(false);
    setDeleteDialogOpen(false);
    setEditedDocument(null);
    onOpenChange(newOpen);
  };

  // Start editing
  const handleEdit = () => {
    setEditedDocument({...document});
    setIsEditing(true);
  };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedDoc: Partial<KnowledgeDocument>) => {
      if (!document?.id) throw new Error("Document ID is required");
      const res = await apiRequest("PATCH", `/api/knowledge-documents/${document.id}`, updatedDoc);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update document");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-documents"] });
      toast({
        title: "Success",
        description: "Document updated successfully",
      });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!document?.id) throw new Error("Document ID is required");
      const res = await apiRequest("DELETE", `/api/knowledge-documents/${document.id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete document");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-documents"] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
      handleOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle save
  const handleSave = async () => {
    if (!editedDocument) return;
    await updateMutation.mutateAsync(editedDocument);
  };

  // Handle agent assignment
  const handleAgentAssignment = async (agentId: string) => {
    if (!document?.id) return;

    try {
      await updateMutation.mutateAsync({
        ...document,
        agentId: agentId === "none" ? null : Number(agentId),
      });

      toast({
        title: "Success",
        description: agentId === "none" 
          ? "Document unassigned from agent"
          : "Document assigned to agent",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign document to agent",
        variant: "destructive",
      });
    }
  };

  if (!document) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex flex-col max-w-[90vw] sm:max-w-[600px] max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                {isEditing ? (
                  <Input
                    value={editedDocument?.name || ""}
                    onChange={(e) =>
                      setEditedDocument(prev => prev ? { ...prev, name: e.target.value } : null)
                    }
                    className="text-lg font-semibold"
                  />
                ) : (
                  <DialogTitle className="text-xl">{document.name}</DialogTitle>
                )}
                <DialogDescription className="mt-1.5">
                  Source: {document.source}
                </DialogDescription>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setIsEditing(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="icon"
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleEdit}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="space-y-6 pb-6">
              <div>
                <h3 className="font-semibold mb-2">Document Type</h3>
                <p className="text-sm text-muted-foreground capitalize">{document.type}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Assigned Agent</h3>
                <Select
                  value={document.agentId?.toString() || "none"}
                  onValueChange={handleAgentAssignment}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Agent</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  Assign this document to an agent to use its content for responses
                </p>
              </div>

              {document.metadata && (
                <div>
                  <h3 className="font-semibold mb-2">Website Information</h3>
                  <div className="space-y-4">
                    {document.metadata.description && (
                      <div>
                        <h4 className="text-sm font-medium">Description</h4>
                        {isEditing ? (
                          <Textarea
                            value={editedDocument?.metadata?.description || ""}
                            onChange={(e) =>
                              setEditedDocument(prev => prev ? { ...prev, metadata: { ...prev.metadata, description: e.target.value } } : null)
                            }
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">{document.metadata.description}</p>
                        )}
                      </div>
                    )}

                    {document.metadata.pages && document.metadata.pages.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium">Pages Found</h4>
                        <ScrollArea className="h-[100px] w-full rounded-md border p-2">
                          <ul className="text-sm space-y-1">
                            {document.metadata.pages.map((page: string, i: number) => (
                              <li key={i} className="text-muted-foreground">
                                {page}
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </div>
                    )}

                    {document.metadata.services && document.metadata.services.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium">Services/Features</h4>
                        <ScrollArea className="h-[150px] w-full rounded-md border p-2">
                          <div className="space-y-3">
                            {document.metadata.services.map((service: any, i: number) => (
                              <div key={i} className="space-y-1">
                                <h5 className="text-sm font-medium">{service.title}</h5>
                                {service.description && (
                                  <p className="text-sm text-muted-foreground">{service.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Content</h3>
                {isEditing ? (
                  <Textarea
                    value={editedDocument?.content || ""}
                    onChange={(e) =>
                      setEditedDocument(prev => prev ? { ...prev, content: e.target.value } : null)
                    }
                    className="min-h-[200px]"
                  />
                ) : (
                  <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                    <p className="text-sm whitespace-pre-wrap">{document.content}</p>
                  </ScrollArea>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the document
              and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}