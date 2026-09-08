"use client";

import { useState } from "react";
import { AlertCircle, Database, Plus, RefreshCw, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailSection } from "@/components/detail-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import {
  useDeleteDataSource,
  useDeleteQuery,
  useDataSourcesSuspense,
  useRefreshSchema,
  useSaveDataSource,
} from "../hooks/data-sources.hook";
import { QueryBuilder } from "./query-builder";
import type { DataQuery, DataSource } from "../service/data-sources.service";

/**
 * Databases an agent may look things up in.
 *
 * The screen's job is to make one sentence obvious: **an agent never writes
 * SQL.** It runs questions somebody approved, and this is where they are
 * approved. Everything else on the page follows from that.
 */
export function DataSourcesScreen() {
  const { workspace, can } = useWorkspace();
  const { data: sources } = useDataSourcesSuspense(workspace.id);

  const [connecting, setConnecting] = useState(false);
  const [buildingFor, setBuildingFor] = useState<DataSource | null>(null);
  const [removingSource, setRemovingSource] = useState<DataSource | null>(null);
  const [removingQuery, setRemovingQuery] = useState<DataQuery | null>(null);

  const mayManage = can("dataSource.manage");
  const removeSource = useDeleteDataSource(workspace.id);
  const removeQuery = useDeleteQuery(workspace.id);
  const refresh = useRefreshSchema(workspace.id);

  return (
    <div className="space-y-6">
      <DetailSection
        title="Databases"
        description="An agent can look things up in your own database — an order's status, a customer's plan. It never writes SQL: it runs questions you have approved."
      >
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No database connected.{" "}
            {mayManage
              ? "Connect one with a read-only user, and Ragenta will read its table names so you can write questions against them."
              : "Ask an owner or admin to connect one."}
          </p>
        ) : (
          <ul className="space-y-4">
            {sources.map((source) => (
              <li key={source.id} className="rounded-md border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Database className="size-4 text-muted-foreground" />
                      {source.name}
                      <StatusBadge tone="neutral">{source.engine}</StatusBadge>
                      {source.lastCheckOk === false && (
                        <StatusBadge tone="danger">unreachable</StatusBadge>
                      )}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{source.dsn}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {source.tables.length > 0
                        ? `${source.tables.length} ${source.tables.length === 1 ? "table" : "tables"} read${
                            source.schemaCachedAt
                              ? ` ${new Date(source.schemaCachedAt).toLocaleDateString()}`
                              : ""
                          }`
                        : "Schema not read yet."}
                    </p>
                    {source.lastCheckError && (
                      <p className="mt-1 max-w-xl text-xs text-destructive">
                        {source.lastCheckError}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!mayManage || refresh.isPending}
                      onClick={() => refresh.mutate(source.id)}
                    >
                      <RefreshCw className="size-4" />
                      Read schema
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${source.name}`}
                      disabled={!mayManage}
                      onClick={() => setRemovingSource(source)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 border-t pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Questions the agent may ask
                  </p>

                  {source.queries.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      None yet. Until one is approved, an agent given this connection can look up
                      nothing.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {source.queries.map((query) => (
                        <li
                          key={query.id}
                          className="flex flex-wrap items-start justify-between gap-2 rounded border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-mono text-xs">
                              {query.name}
                              {query.approvedAt ? (
                                <StatusBadge tone="success">approved</StatusBadge>
                              ) : (
                                <StatusBadge tone="warning">not approved</StatusBadge>
                              )}
                              {query.origin === "generated" && (
                                <StatusBadge tone="info">written for you</StatusBadge>
                              )}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {query.description}
                            </p>
                            <code className="mt-1 block overflow-x-auto text-[11px] text-muted-foreground/80">
                              {query.sql}
                            </code>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${query.name}`}
                            disabled={!mayManage}
                            onClick={() => setRemovingQuery(query)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {mayManage && (
                    <Button
                      className="mt-3"
                      variant="outline"
                      size="sm"
                      disabled={source.tables.length === 0}
                      onClick={() => setBuildingFor(source)}
                    >
                      <Plus className="size-4" />
                      Add a question
                    </Button>
                  )}
                  {mayManage && source.tables.length === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Read the schema first — a question can only be written against tables Ragenta
                      knows about.
                    </p>
                  )}
                </div>

                {buildingFor?.id === source.id && (
                  <div className="mt-4">
                    <QueryBuilder source={source} onDone={() => setBuildingFor(null)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {mayManage && !connecting && (
          <Button className="mt-4" size="sm" onClick={() => setConnecting(true)}>
            <Plus className="size-4" />
            Connect a database
          </Button>
        )}
      </DetailSection>

      {connecting && <ConnectForm onDone={() => setConnecting(false)} />}

      <ConfirmDialog
        open={removingSource !== null}
        onOpenChange={(open) => !open && setRemovingSource(null)}
        title={`Remove ${removingSource?.name ?? ""}?`}
        description="Every approved question on it goes too, and any agent using them stops being able to look things up. Your database is not touched."
        confirmLabel="Remove"
        destructive
        pending={removeSource.isPending}
        onConfirm={() => {
          if (!removingSource) return;
          removeSource.mutate(removingSource.id, { onSuccess: () => setRemovingSource(null) });
        }}
      />

      <ConfirmDialog
        open={removingQuery !== null}
        onOpenChange={(open) => !open && setRemovingQuery(null)}
        title={`Remove ${removingQuery?.name ?? ""}?`}
        description="Any agent that was calling it will say it could not look that up."
        confirmLabel="Remove"
        destructive
        pending={removeQuery.isPending}
        onConfirm={() => {
          if (!removingQuery) return;
          removeQuery.mutate(removingQuery.id, { onSuccess: () => setRemovingQuery(null) });
        }}
      />
    </div>
  );
}

function ConnectForm({ onDone }: { onDone: () => void }) {
  const { workspace } = useWorkspace();
  const save = useSaveDataSource(workspace.id);

  const [name, setName] = useState("");
  const [dsn, setDsn] = useState("");

  return (
    <DetailSection
      title="Connect a database"
      description="Ragenta reads only what you approve, and only through the questions you write."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="source-name">Name</Label>
          <Input
            id="source-name"
            value={name}
            placeholder="Shop database"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source-dsn">Connection string</Label>
          <Input
            id="source-dsn"
            type="password"
            value={dsn}
            placeholder="postgres://readonly:…@db.example.com:5432/shop"
            onChange={(event) => setDsn(event.target.value)}
            className="font-mono text-xs"
          />
        </div>
      </div>

      <div className="mt-3 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
        <p className="font-medium">Use a read-only database user.</p>
        <p className="mt-1 text-xs">
          Every query runs in a read-only transaction, so your database refuses a write whatever the
          statement says. That is a second line — the one that holds is the grant on your side.
          Postgres and MySQL are supported; the type is read from the connection string.
        </p>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!name.trim() || dsn.trim().length < 10 || save.isPending}
          onClick={() =>
            save.mutate(
              { name: name.trim(), dsn: dsn.trim(), enabled: true },
              { onSuccess: onDone },
            )
          }
        >
          {save.isPending ? "Connecting..." : "Connect"}
        </Button>
      </div>
    </DetailSection>
  );
}

export function DataSourcesLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-40" />
    </div>
  );
}

export function DataSourcesError() {
  return (
    <div className="rounded-md border p-8 text-center">
      <AlertCircle className="mx-auto size-8 text-destructive" />
      <p className="mt-2 font-medium">Could not load databases</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The backend refused or is unreachable. Reading this needs the{" "}
        <code className="font-mono text-xs">dataSource.read</code> permission.
      </p>
    </div>
  );
}
