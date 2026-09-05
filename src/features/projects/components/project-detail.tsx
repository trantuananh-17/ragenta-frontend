"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailShell, DetailSection } from "@/components/detail-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useModelCatalogue } from "@/features/models/hooks/models.hook";
import {
  modelKey,
  parseModelKey,
} from "@/features/models/service/models.service";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { canAdminister, canContribute } from "@/lib/workspace";
import {
  useArchiveProject,
  useDeleteProject,
  useProjectSuspense,
  useUpdateProject,
} from "../hooks/projects.hook";

const WORKSPACE_DEFAULT = "__default__";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const { workspace } = useWorkspace();
  const project = useProjectSuspense(workspace.id, projectId);
  const update = useUpdateProject(workspace.id, projectId);
  const archive = useArchiveProject(workspace.id);
  const remove = useDeleteProject(workspace.id);
  const catalogue = useModelCatalogue(workspace.id);

  const [name, setName] = useState(project.data.name);
  const [description, setDescription] = useState(project.data.description ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mayEdit = canContribute(workspace.role);
  const mayArchive = canAdminister(workspace.role);
  const mayDelete = workspace.role === "owner";
  const archived = Boolean(project.data.archivedAt);

  const chatModels =
    catalogue.data?.models.filter(
      (model) => model.capability === "chat" && model.selectable,
    ) ?? [];
  const pinned =
    project.data.chatProvider && project.data.chatModel
      ? `${project.data.chatProvider}/${project.data.chatModel}`
      : WORKSPACE_DEFAULT;

  return (
    <DetailShell>
      <PageHeader
        back={{ href: "/projects", label: "Projects" }}
        title={project.data.name}
        description={project.data.description}
        badges={archived ? <StatusBadge tone="warning">archived</StatusBadge> : null}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={!mayArchive || archive.isPending}
              onClick={() => archive.mutate({ projectId, archived })}
            >
              {archived ? (
                <ArchiveRestore className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
              {archived ? "Restore" : "Archive"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!mayDelete}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </>
        }
      />

      <DetailSection
        title="Details"
        actions={
          <Button
            size="sm"
            disabled={!mayEdit || update.isPending}
            onClick={() =>
              update.mutate({ name, description: description || null })
            }
          >
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              disabled={!mayEdit}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              rows={3}
              value={description}
              disabled={!mayEdit}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-slug">URL</Label>
            <Input id="project-slug" value={project.data.slug} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              Fixed once the project exists.
            </p>
          </div>
        </div>
      </DetailSection>

      <DetailSection
        title="Chat model"
        description="Answers in this project use this model. Left on the workspace default, the project follows whatever the workspace picks — which is what you want unless this project has a reason of its own."
      >
        <Select
          value={pinned}
          disabled={!mayEdit || update.isPending}
          onValueChange={(value) =>
            update.mutate({
              chat: value === WORKSPACE_DEFAULT ? null : parseModelKey(value),
            })
          }
        >
          <SelectTrigger className="max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={WORKSPACE_DEFAULT}>Workspace default</SelectItem>
            {chatModels.map((model) => (
              <SelectItem key={modelKey(model)} value={modelKey(model)}>
                {model.model}
                <span className="ml-1 text-muted-foreground">
                  {model.provider}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DetailSection>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${project.data.name}?`}
        description="Archiving keeps the project and its usage history and is reversible. Deleting is not — and only the workspace owner can do it."
        confirmLabel="Delete project"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(projectId)}
      />
    </DetailShell>
  );
}

export function ProjectLoading() {
  return (
    <DetailShell>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full" />
    </DetailShell>
  );
}

export function ProjectError() {
  return (
    <DetailShell>
      <p className="text-sm text-muted-foreground">
        This project could not be loaded.
      </p>
    </DetailShell>
  );
}
