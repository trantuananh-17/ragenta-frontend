"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateAgent } from "../hooks/agents.hook";

/**
 * Name and brief only.
 *
 * Everything else — model, knowledge bases, retrieval — is on the detail screen,
 * because the agent is created as a **draft** and cannot be run until it is
 * activated. Asking for ten settings before the thing exists would be a long
 * form in front of a decision the user has not made yet.
 */
export function CreateAgentDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const create = useCreateAgent(workspaceId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !instructions.trim()) return;
    create.mutate({
      name: name.trim(),
      description: null,
      projectId: null,
      config: { instructions: instructions.trim() },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New agent</DialogTitle>
            <DialogDescription>
              It starts as a draft. Choose its model and knowledge bases next, then
              activate it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Support triage"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-instructions">Instructions</Label>
              <Textarea
                id="agent-instructions"
                rows={5}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="What this agent is for, and how it should answer."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || !name.trim() || !instructions.trim()}
            >
              {create.isPending ? "Creating…" : "Create agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
