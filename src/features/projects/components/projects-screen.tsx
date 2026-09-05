"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FolderKanban } from "lucide-react";
import { z } from "zod";

import {
  EntityContainer,
  EntityEmptyView,
  EntityHeader,
} from "@/components/entity-components";
import { StatusBadge } from "@/components/status-badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { formatDate } from "@/lib/format";
import { canContribute } from "@/lib/workspace";
import { useCreateProject, useProjectsSuspense } from "../hooks/projects.hook";

const schema = z.object({
  name: z.string().trim().min(2, "At least two characters.").max(80),
  description: z.string().trim().max(500).optional(),
});

function CreateProjectDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateProject(workspaceId);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            A project groups conversations and usage inside this workspace, and
            can pin its own chat model. Knowledge bases stay workspace-wide.
          </DialogDescription>
        </DialogHeader>

        <form
          id="create-project"
          className="grid gap-4"
          onSubmit={handleSubmit((values) =>
            create.mutate(
              { name: values.name, description: values.description || undefined },
              { onSuccess: () => onOpenChange(false) },
            ),
          )}
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Customer support" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} {...register("description")} />
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
          <Button type="submit" form="create-project" disabled={create.isPending}>
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsScreen() {
  const { workspace } = useWorkspace();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data } = useProjectsSuspense(workspace.id, includeArchived);

  const mayCreate = canContribute(workspace.role);

  return (
    <>
      <EntityContainer
        header={
          <EntityHeader
            title="Projects"
            description="Group work inside the workspace. A project can pin its own chat model; usage is reported per project."
            newButtonLabel="New project"
            disabled={!mayCreate}
            onNew={() => setCreating(true)}
          />
        }
        search={
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={includeArchived}
              onCheckedChange={setIncludeArchived}
            />
            Show archived
          </label>
        }
      >
        {data.length === 0 ? (
          <EntityEmptyView
            icon={<FolderKanban />}
            title="No projects yet"
            message="Everything works without one — a project is for when a workspace does more than one kind of work."
            newLabel="New project"
            disabled={!mayCreate}
            onNew={mayCreate ? () => setCreating(true) : undefined}
          />
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group rounded-lg border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate font-medium group-hover:text-primary">
                    {project.name}
                  </h2>
                  {project.archivedAt && (
                    <StatusBadge tone="warning">archived</StatusBadge>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                  {project.description || "No description."}
                </p>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {project.chatModel
                    ? `Pinned to ${project.chatModel}`
                    : "Uses the workspace model"}{" "}
                  · created {formatDate(project.createdAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </EntityContainer>

      <CreateProjectDialog
        workspaceId={workspace.id}
        open={creating}
        onOpenChange={setCreating}
      />
    </>
  );
}

export function ProjectsLoading() {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((card) => (
        <Skeleton key={card} className="h-32 rounded-lg" />
      ))}
    </div>
  );
}

export function ProjectsError() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
      Projects could not be loaded.
    </div>
  );
}
