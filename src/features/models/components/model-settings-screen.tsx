"use client";

import { AlertTriangle, Check, Lock } from "lucide-react";

import { DetailSection } from "@/components/detail-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { formatNumber } from "@/lib/format";
import { canAdminister } from "@/lib/workspace";
import {
  useModelCatalogueSuspense,
  useModelSettingsSuspense,
  useUpdateModelSettings,
} from "../hooks/models.hook";
import { modelKey, parseModelKey } from "../service/models.service";
import type { CatalogueModel } from "../service/models.service";

/**
 * Why a model cannot be picked, in the terms that decide it.
 *
 * `configured` is about this deployment holding a provider key — an operator
 * problem. `entitled` is about the plan — a commercial one. Collapsing them into
 * "unavailable" would send half of these people to the wrong place.
 */
function Availability({ model }: { model: CatalogueModel }) {
  if (model.selectable) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="size-3.5 text-emerald-600" />
        available
      </span>
    );
  }
  if (!model.configured) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <AlertTriangle className="size-3.5 text-amber-500" />
        no provider key
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Lock className="size-3.5" />
      not in your plan
    </span>
  );
}

export function ModelSettingsScreen() {
  const { workspace } = useWorkspace();
  const catalogue = useModelCatalogueSuspense(workspace.id);
  const settings = useModelSettingsSuspense(workspace.id);
  const update = useUpdateModelSettings(workspace.id);

  const mayEdit = canAdminister(workspace.role);
  const chatModels = catalogue.data.models.filter(
    (model) => model.capability === "chat",
  );
  const embeddingModels = catalogue.data.models.filter(
    (model) => model.capability === "embedding",
  );

  const selectableChat = chatModels.filter((model) => model.selectable);
  const selectableEmbedding = embeddingModels.filter((model) => model.selectable);

  return (
    <div className="space-y-6">
      {catalogue.data.configuredProviders.length === 0 && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>No provider is configured</AlertTitle>
          <AlertDescription>
            This deployment holds no API key for any model provider, so nothing
            here can run. A platform administrator has to store one before chat
            or ingestion will work.
          </AlertDescription>
        </Alert>
      )}

      <DetailSection
        title="Workspace defaults"
        description={
          settings.data.isDefault
            ? "This workspace has never chosen, so it runs on the built-in economy defaults."
            : "What every conversation and every upload uses unless a project or a single turn overrides it."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="chat-model">
              Chat model
            </label>
            <Select
              value={modelKey(settings.data.chat)}
              disabled={!mayEdit || update.isPending}
              onValueChange={(value) => {
                const chat = parseModelKey(value);
                if (chat) update.mutate({ chat });
              }}
            >
              <SelectTrigger id="chat-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectableChat.map((model) => (
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
            <label className="text-sm font-medium" htmlFor="embedding-model">
              Embedding model
            </label>
            <Select
              value={modelKey(settings.data.embedding)}
              disabled={!mayEdit || update.isPending}
              onValueChange={(value) => {
                const embedding = parseModelKey(value);
                if (embedding) update.mutate({ embedding });
              }}
            >
              <SelectTrigger id="embedding-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectableEmbedding.map((model) => (
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
              Changing this affects knowledge bases created from now on. Existing
              ones keep the model their vectors were built with.
            </p>
          </div>
        </div>

        {!mayEdit && (
          <p className="mt-4 text-sm text-muted-foreground">
            Your role is {workspace.role}; changing the workspace default is an
            owner or admin decision because it has a price attached.
          </p>
        )}
      </DetailSection>

      <DetailSection
        title="Catalogue"
        description={`What the ${catalogue.data.plan} plan can reach on this deployment.`}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Use</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">Context</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {catalogue.data.models.map((model) => (
              <TableRow key={`${model.provider}/${model.model}`}>
                <TableCell className="text-sm font-medium">
                  {model.model}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {model.provider}
                </TableCell>
                <TableCell className="text-xs">{model.capability}</TableCell>
                <TableCell>
                  <Badge
                    variant={model.tier === "premium" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {model.tier}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {model.contextWindow ? formatNumber(model.contextWindow) : "—"}
                </TableCell>
                <TableCell>
                  <Availability model={model} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DetailSection>
    </div>
  );
}

export function ModelSettingsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function ModelSettingsError() {
  return (
    <p className="text-sm text-muted-foreground">
      The model catalogue could not be loaded.
    </p>
  );
}
