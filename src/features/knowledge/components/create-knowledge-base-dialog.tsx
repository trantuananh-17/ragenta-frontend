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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { useCreateKnowledgeBase } from "../hooks/knowledge.hook";
import { ChunkingMethodPicker } from "./chunking-method-picker";

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
  parserId: z.string(),
  /**
   * Both cost a model call per batch of passages at ingestion time, so they are
   * off by default and the form says what they buy.
   */
  autoKeywords: z.coerce.number().int().min(0).max(10),
  autoQuestions: z.coerce.number().int().min(0).max(5),
  raptor: z.boolean(),
});

const DEFAULTS = {
  name: "",
  description: "",
  embedding: WORKSPACE_DEFAULT,
  chunkTokenSize: 512,
  chunkOverlapPercent: 15,
  parserId: "general",
  autoKeywords: 0,
  autoQuestions: 0,
  raptor: false,
} as const;

/**
 * Creating a knowledge base is the one moment its embedding model can be chosen
 * — it is frozen on the row afterwards. The chunking settings are not frozen,
 * but they only take effect on a re-index, and the form says both rather than
 * leaving either to be discovered from a disabled field.
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
    defaultValues: { ...DEFAULTS },
  });

  // Cleared on open rather than in an effect, so the previous attempt is never
  // briefly on screen.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) reset({ ...DEFAULTS });
  }

  const embeddingModels =
    catalogue.data?.models.filter(
      (model) => model.capability === "embedding" && model.selectable,
    ) ?? [];
  // `useWatch` rather than `watch()`: the latter returns a fresh function on
  // every render, which opts the whole component out of the React Compiler.
  const embedding = useWatch({ control, name: "embedding" });
  const parserId = useWatch({ control, name: "parserId" });

  /**
   * Nothing here can succeed without an embedding model, and the failure comes
   * from the server after the form is filled in. Saying so up front, and
   * refusing the submit, is the difference between "this product is broken" and
   * "somebody has to store a key" — which is a distinction the person filling
   * the form cannot otherwise make.
   */
  const blocked = catalogue.isSuccess && embeddingModels.length === 0;
  const raptor = useWatch({ control, name: "raptor" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New knowledge base</DialogTitle>
          <DialogDescription>
            A set of documents that are retrieved together. The embedding model
            is fixed once it exists — vectors from two models are not comparable.
            The chunking settings can be changed later, but they only apply to
            documents re-indexed after the change.
          </DialogDescription>
        </DialogHeader>

        {blocked && (
          <Alert variant="destructive">
            <AlertTitle>No embedding model is configured</AlertTitle>
            <AlertDescription>
              A knowledge base has to embed its documents the moment it is
              created, so this will be refused until an administrator stores a
              provider key in the admin console. Every other field here is
              filled in vain without one.
            </AlertDescription>
          </Alert>
        )}

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
                parserId: parsed.parserId,
                parserConfig: {
                  ...(parsed.autoKeywords > 0
                    ? { autoKeywords: parsed.autoKeywords }
                    : {}),
                  ...(parsed.autoQuestions > 0
                    ? { autoQuestions: parsed.autoQuestions }
                    : {}),
                  ...(parsed.raptor ? { raptor: { enabled: true } } : {}),
                },
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor="parserId">Chunking method</Label>
            <ChunkingMethodPicker
              id="parserId"
              workspaceId={workspaceId}
              value={parserId}
              onChange={(value) => setValue("parserId", value)}
            />
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
            precisely; longer ones keep more context around each answer. The
            Q&amp;A, Table, One and Presentation methods ignore these — their
            boundaries come from the document.
          </p>

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <h3 className="text-sm font-medium">Indexing extras</h3>
              <p className="text-xs text-muted-foreground">
                Each one runs a model over your documents while they are indexed,
                so each one costs credits once and makes retrieval better every
                time afterwards. All three are off by default.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="autoKeywords">Keywords per passage</Label>
                <Input
                  id="autoKeywords"
                  type="number"
                  {...register("autoKeywords")}
                />
                <p className="text-xs text-muted-foreground">
                  Synonyms and product names the passage never uses, so a search
                  for them still finds it. 0 disables it.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="autoQuestions">Questions per passage</Label>
                <Input
                  id="autoQuestions"
                  type="number"
                  {...register("autoQuestions")}
                />
                <p className="text-xs text-muted-foreground">
                  Questions the passage answers, indexed beside it — a question
                  matches another question better than it matches prose.
                </p>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="raptor">Summary tree</Label>
                <p className="text-xs text-muted-foreground">
                  Groups related passages and indexes a model-written summary of
                  each group, so &ldquo;what does this document say overall&rdquo;
                  matches something. Answers cite summaries as summaries.
                </p>
              </div>
              <Switch
                id="raptor"
                checked={raptor === true}
                onCheckedChange={(checked) => setValue("raptor", checked)}
              />
            </div>
          </div>
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
            disabled={create.isPending || blocked}
          >
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
