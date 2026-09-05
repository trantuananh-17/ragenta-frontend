"use client";

import { useState } from "react";

import { DetailSection } from "@/components/detail-shell";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCredits, formatDate, formatNumber } from "@/lib/format";
import { canAdminister } from "@/lib/workspace";
import {
  useUpdateWorkspace,
  useWorkspaceOverviewSuspense,
} from "../hooks/workspace.hook";
import { useWorkspace } from "./workspace-provider";

export function WorkspaceSettings() {
  const { workspace } = useWorkspace();
  const overview = useWorkspaceOverviewSuspense(workspace.id);
  const update = useUpdateWorkspace(workspace.id);
  const [name, setName] = useState(overview.data.workspace.name);

  const mayEdit = canAdminister(overview.data.role);

  return (
    <div className="space-y-6">
      <StatCardGrid>
        <StatCard
          label="Plan"
          value={<span className="capitalize">{overview.data.billing.plan}</span>}
        />
        <StatCard
          label="Credits"
          value={formatCredits(overview.data.billing.credits.total)}
          hint={
            overview.data.billing.credits.resetAt
              ? `Plan bucket resets ${formatDate(overview.data.billing.credits.resetAt)}`
              : "Top-up credits never expire"
          }
        />
        <StatCard
          label="Seats"
          value={`${formatNumber(overview.data.billing.seats.used)} / ${
            overview.data.billing.seats.limit === null
              ? "∞"
              : formatNumber(overview.data.billing.seats.limit)
          }`}
          hint="Members plus pending invitations"
        />
        <StatCard
          label="Created"
          value={formatDate(overview.data.workspace.createdAt)}
        />
      </StatCardGrid>

      <DetailSection
        title="General"
        description="The name people see in the workspace switcher and on invitations."
        actions={
          <Button
            size="sm"
            disabled={!mayEdit || update.isPending || name.trim().length < 2}
            onClick={() => update.mutate({ name: name.trim() })}
          >
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        }
      >
        <div className="grid gap-4 sm:max-w-md">
          <div className="grid gap-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={name}
              disabled={!mayEdit}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="workspace-slug">URL</Label>
            <Input
              id="workspace-slug"
              value={overview.data.workspace.slug}
              disabled
              readOnly
            />
            <p className="text-xs text-muted-foreground">
              Fixed. It identifies the workspace in invitations and links that
              have already been sent.
            </p>
          </div>
        </div>
      </DetailSection>

      {!mayEdit && (
        <p className="text-sm text-muted-foreground">
          Your role in this workspace is {overview.data.role}, which can read
          these settings but not change them.
        </p>
      )}
    </div>
  );
}

export function WorkspaceSettingsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function WorkspaceSettingsError() {
  return (
    <p className="text-sm text-muted-foreground">
      Workspace settings could not be loaded.
    </p>
  );
}
