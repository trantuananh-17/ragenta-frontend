"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useModelCatalogue } from "@/features/models/hooks/models.hook";
import {
  modelKey,
  parseModelKey,
} from "@/features/models/service/models.service";
import { useCreateKnowledgeBase } from "../hooks/knowledge.hook";

const WORKSPACE_DEFAULT = "__default__";

const schema = z.object({
  name: z.string().trim().min(2, "At least two characters.").max(120),
  description: z.string().trim().max(600).optional(),
  embedding: z.string(),
  chunkTokenSize: z.coerce
    .number()
    .int()
    .min(64, "64 tokens is the floor.")
    .max(2048, "2048 tokens is the ceiling."),
  chunkOverlapPercent: z.coerce
    .number()
    .int()
    .min(0)
    .max(50, "Beyond half, the overlap is most of the chunk."),
});

/**
 * Creating a knowledge base is the one moment its embedding model and chunking
 * can be chosen — both are frozen on the row afterwards. That is stated on the
 * form rather than discovered later from a disabled field.
 */
export function CreateKnowledgeBaseDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateKnowledgeBase(workspaceId);
  const catalogue = useModelCatalogue(workspaceId);
  const [wasOpen, setWasOpen] = useState(open);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      embedding: WORKSPACE_DEFAULT,
      chunkTokenSize: 512,
      chunkOverlapPercent: 15,
    },
  });

  // Cleared on open rather than in an effect, so the previous attempt is never
  // briefly on screen.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      reset({
        name: "",
        description: "",
        embedding: WORKSPACE_DEFAULT,
        chunkTokenSize: 512,
        chunkOverlapPercent: 15,
      });
    }
  }

  const embeddingModels =
    catalogue.data?.models.filter(
      (model) => model.capability === "embedding" && model.selectable,
    ) ?? [];
  // `useWatch` rather than `watch()`: the latter returns a fresh function on
  // every render, which opts the whole component out of the React Compiler.
  const embedding = useWatch({ control, name: "embedding" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New knowledge base</DialogTitle>
          <DialogDescription>
            A set of documents that are retrieved together. The embedding model
            and the chunking below are fixed once it exists — vectors from two
            models are not comparable, so changing them later would mean
            re-ingesting everything.
          </DialogDescription>
        </DialogHeader>

        <form
          id="create-knowledge-base"
          className="grid gap-4"
          onSubmit={handleSubmit((values) => {
            const parsed = schema.parse(values);
            create.mutate(
              {
                name: parsed.name,
                description: parsed.description || null,
                embedding:
                  parsed.embedding === WORKSPACE_DEFAULT
                    ? undefined
                    : (parseModelKey(parsed.embedding) ?? undefined),
                chunkTokenSize: parsed.chunkTokenSize,
                chunkOverlapPercent: parsed.chunkOverlapPercent,
              },
              { onSuccess: () => onOpenChange(false) },
            );
          })}
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Product handbook" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="What is in here, and what it is good for answering."
              {...register("description")}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="embedding">Embedding model</Label>
            <Select
              value={embedding}
              onValueChange={(value) => setValue("embedding", value)}
            >
              <SelectTrigger id="embedding">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WORKSPACE_DEFAULT}>
                  Workspace default
                </SelectItem>
                {embeddingModels.map((model) => (
                  <SelectItem key={modelKey(model)} value={modelKey(model)}>
                    {model.model}
                    <span className="ml-1 text-muted-foreground">
                      {model.provider}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {embeddingModels.length === 0 && catalogue.isSuccess && (
              <p className="text-xs text-muted-foreground">
                No embedding model is configured on this deployment, so creation
                will be refused. An administrator has to store a provider key.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="chunkTokenSize">Chunk size (tokens)</Label>
              <Input
                id="chunkTokenSize"
                type="number"
                {...register("chunkTokenSize")}
              />
              {errors.chunkTokenSize && (
                <p className="text-sm text-destructive">
                  {errors.chunkTokenSize.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="chunkOverlapPercent">Overlap (%)</Label>
              <Input
                id="chunkOverlapPercent"
                type="number"
                {...register("chunkOverlapPercent")}
              />
              {errors.chunkOverlapPercent && (
                <p className="text-sm text-destructive">
                  {errors.chunkOverlapPercent.message}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            512 tokens with 15% overlap suits prose. Shorter chunks retrieve more
            precisely; longer ones keep more context around each answer.
          </p>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-knowledge-base"
            disabled={create.isPending}
          >
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
