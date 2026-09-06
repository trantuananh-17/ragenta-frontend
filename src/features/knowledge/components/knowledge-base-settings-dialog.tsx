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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useModelCatalogue } from "@/features/models/hooks/models.hook";
import {
  modelKey,
  parseModelKey,
} from "@/features/models/service/models.service";
import { useUpdateKnowledgeBase } from "../hooks/knowledge.hook";
import type { KnowledgeBase } from "../service/knowledge.service";
import { ChunkingMethodPicker } from "./chunking-method-picker";

const NO_RERANKER = "__none__";

/**
 * Everything about a knowledge base that is not frozen.
 *
 * Two groups, and the difference between them is the whole point of separating
 * them on screen: **retrieval** settings are read at query time and change the
 * next answer, while **chunking** settings only reach documents re-indexed after
 * the change. Presenting them together with no distinction would make someone
 * lower the chunk size, see nothing happen, and conclude the setting is broken.
 */
export function KnowledgeBaseSettingsDialog({
  workspaceId,
  base,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  base: KnowledgeBase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateKnowledgeBase(workspaceId, base.id);
  const catalogue = useModelCatalogue(workspaceId);

  const [parserId, setParserId] = useState(base.parserId);
  const [topK, setTopK] = useState(String(base.topK));
  const [threshold, setThreshold] = useState(String(base.similarityThreshold));
  const [vectorWeight, setVectorWeight] = useState(String(base.vectorWeight));
  const [reranker, setReranker] = useState(
    base.rerankProvider && base.rerankModel
      ? modelKey({ provider: base.rerankProvider, model: base.rerankModel })
      : NO_RERANKER,
  );
  const [autoKeywords, setAutoKeywords] = useState(
    String(base.parserConfig.autoKeywords ?? 0),
  );
  const [autoQuestions, setAutoQuestions] = useState(
    String(base.parserConfig.autoQuestions ?? 0),
  );
  const [raptor, setRaptor] = useState(base.parserConfig.raptor?.enabled ?? false);

  const rerankModels =
    catalogue.data?.models.filter(
      (model) => model.capability === "rerank" && model.selectable,
    ) ?? [];

  const submit = () => {
    update.mutate(
      {
        parserId,
        parserConfig: {
          ...base.parserConfig,
          autoKeywords: Number(autoKeywords) || 0,
          autoQuestions: Number(autoQuestions) || 0,
          raptor: { ...base.parserConfig.raptor, enabled: raptor },
        },
        topK: Number(topK),
        similarityThreshold: Number(threshold),
        vectorWeight: Number(vectorWeight),
        rerank:
          reranker === NO_RERANKER ? null : (parseModelKey(reranker) ?? null),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{base.name} settings</DialogTitle>
          <DialogDescription>
            Retrieval settings change the very next answer. Chunking settings
            only reach documents that are re-indexed after the change — the
            passages already stored keep the shape they were cut with.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-4">
            <h3 className="text-sm font-medium">Retrieval</h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="topK">Passages</Label>
                <Input
                  id="topK"
                  type="number"
                  value={topK}
                  onChange={(event) => setTopK(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="threshold">Min. relevance</Label>
                <Input
                  id="threshold"
                  type="number"
                  step="0.05"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vectorWeight">Meaning weight</Label>
                <Input
                  id="vectorWeight"
                  type="number"
                  step="0.1"
                  value={vectorWeight}
                  onChange={(event) => setVectorWeight(event.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A passage scores on meaning and on wording, and the two are added
              with this weight — 0.7 means meaning decides and wording breaks
              ties. Raise it for questions asked in prose, lower it for part
              numbers and error codes. Anything below the minimum relevance is
              discarded rather than padding the answer with noise.
            </p>

            <div className="grid gap-2">
              <Label htmlFor="reranker">Reranker</Label>
              <Select value={reranker} onValueChange={setReranker}>
                <SelectTrigger id="reranker">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_RERANKER}>None</SelectItem>
                  {rerankModels.map((model) => (
                    <SelectItem key={modelKey(model)} value={modelKey(model)}>
                      {model.model}
                      <span className="ml-1 text-muted-foreground">
                        {model.provider}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A second pass that reads the question and each candidate passage
                together, rather than scoring them separately. Better ordering,
                one extra provider call per question.
                {rerankModels.length === 0 &&
                  " No reranking provider is configured on this deployment."}
              </p>
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <h3 className="text-sm font-medium">Chunking</h3>

            <ChunkingMethodPicker
              workspaceId={workspaceId}
              value={parserId}
              onChange={setParserId}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="settings-keywords">Keywords per passage</Label>
                <Input
                  id="settings-keywords"
                  type="number"
                  value={autoKeywords}
                  onChange={(event) => setAutoKeywords(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="settings-questions">Questions per passage</Label>
                <Input
                  id="settings-questions"
                  type="number"
                  value={autoQuestions}
                  onChange={(event) => setAutoQuestions(event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="settings-raptor">Summary tree</Label>
                <p className="text-xs text-muted-foreground">
                  Indexes model-written summaries of related passages, so a
                  whole-document question matches something.
                </p>
              </div>
              <Switch
                id="settings-raptor"
                checked={raptor}
                onCheckedChange={setRaptor}
              />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={update.isPending}>
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
