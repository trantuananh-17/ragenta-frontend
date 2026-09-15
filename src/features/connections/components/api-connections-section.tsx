"use client";

import { useState } from "react";
import { Globe, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailSection } from "@/components/detail-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import {
  useCheckHttpConnection,
  useDeleteHttpConnection,
  useHttpConnectionsSuspense,
  useSaveHttpConnection,
} from "../hooks/connections.hook";
import type { HttpConnection } from "../service/connections.service";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/**
 * The workspace's own HTTP APIs, which an agent reaches through `api_call`.
 *
 * This is where a customer's API key goes: encrypted on the server, attached to
 * every call there, and never in a prompt or on this screen again after saving.
 * An embedded chat that has to look a visitor's order up in the customer's shop
 * is configured here, with `{{visitor.id}}` where the shop wants to know who.
 */
export function ApiConnectionsSection() {
  const { workspace, can } = useWorkspace();
  const { data: connections } = useHttpConnectionsSuspense(workspace.id);

  const [editing, setEditing] = useState<HttpConnection | "new" | null>(null);
  const [removing, setRemoving] = useState<HttpConnection | null>(null);
  const remove = useDeleteHttpConnection(workspace.id);
  const check = useCheckHttpConnection(workspace.id);

  const mayManage = can("connection.manage");

  return (
    <>
      <DetailSection
        title="Your APIs"
        description="An HTTP API of your own that an agent may call — your shop, your CRM, your helpdesk. The key is stored encrypted and attached on the server; the agent only ever names the connection."
      >
        {connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No APIs connected yet.</p>
        ) : (
          <ul className="space-y-2">
            {connections.map((connection) => (
              <li
                key={connection.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Globe className="size-4 text-muted-foreground" />
                    {connection.name}
                    <code className="font-mono text-xs text-muted-foreground">{connection.id}</code>
                    {connection.scope === "platform" && (
                      <StatusBadge tone="neutral">provided</StatusBadge>
                    )}
                    {!connection.enabled && <StatusBadge tone="neutral">off</StatusBadge>}
                    {connection.lastCheckOk === false && (
                      <StatusBadge tone="danger">check failed</StatusBadge>
                    )}
                  </p>
                  {connection.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{connection.description}</p>
                  )}
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {connection.baseUrl}
                    {connection.allowedPathPrefix}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {connection.allowedMethods.join(", ")}
                    {connection.hasSecret ? ` · key ${connection.secretHint}` : " · no key"}
                    {Object.keys(connection.extraHeaders).length > 0 &&
                      ` · ${Object.keys(connection.extraHeaders).length} extra header(s)`}
                  </p>
                  {connection.lastCheckError && (
                    <p className="mt-0.5 text-xs text-destructive">{connection.lastCheckError}</p>
                  )}
                </div>

                {connection.scope === "workspace" && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!mayManage || check.isPending}
                      onClick={() => check.mutate(connection.id)}
                    >
                      Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!mayManage}
                      onClick={() => setEditing(connection)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${connection.name}`}
                      disabled={!mayManage}
                      onClick={() => setRemoving(connection)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {mayManage && !editing && (
          <Button className="mt-4" size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Connect an API
          </Button>
        )}
      </DetailSection>

      {editing && (
        <ConnectionForm
          key={editing === "new" ? "new" : editing.id}
          connection={editing === "new" ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? ""}?`}
        description="Any agent calling this API stops being able to. The key is deleted with it."
        confirmLabel="Remove"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (!removing) return;
          remove.mutate(removing.id, { onSuccess: () => setRemoving(null) });
        }}
      />
    </>
  );
}

/** `Name: value` per line — the shape somebody copies out of their API docs. */
function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    const name = line.slice(0, at).trim();
    if (name) headers[name] = line.slice(at + 1).trim();
  }
  return headers;
}

function formatHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");
}

function ConnectionForm({
  connection,
  onDone,
}: {
  connection?: HttpConnection;
  onDone: () => void;
}) {
  const { workspace } = useWorkspace();
  const save = useSaveHttpConnection(workspace.id);

  const [slug, setSlug] = useState(connection?.id ?? "");
  const [name, setName] = useState(connection?.name ?? "");
  const [description, setDescription] = useState(connection?.description ?? "");
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? "");
  const [secret, setSecret] = useState("");
  const [authHeader, setAuthHeader] = useState(connection?.authHeader ?? "Authorization");
  const [authPrefix, setAuthPrefix] = useState(connection?.authPrefix ?? "Bearer ");
  const [headers, setHeaders] = useState(formatHeaders(connection?.extraHeaders ?? {}));
  const [methods, setMethods] = useState<Set<string>>(
    new Set(connection?.allowedMethods ?? ["GET"]),
  );
  const [pathPrefix, setPathPrefix] = useState(connection?.allowedPathPrefix ?? "");

  const ready =
    /^[a-z0-9][a-z0-9_-]{1,59}$/.test(slug) &&
    name.trim() &&
    /^https?:\/\//.test(baseUrl.trim()) &&
    methods.size > 0 &&
    // A new connection with no key is one the far API will refuse. Editing may
    // leave it blank to keep the stored key.
    (connection?.hasSecret || secret.trim());

  return (
    <DetailSection
      title={connection ? `Edit ${connection.name}` : "Connect an API"}
      description="The agent names the connection and a path; everything else — the host, the key, which methods and paths are allowed — is decided here and cannot be changed by talking to it."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="conn-slug">Connection id</Label>
          <Input
            id="conn-slug"
            value={slug}
            disabled={connection !== undefined}
            placeholder="shop"
            className="font-mono"
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
          />
          <p className="text-xs text-muted-foreground">
            What the agent calls it. Lowercase letters, digits, <code>-</code> and <code>_</code>.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="conn-name">Name</Label>
          <Input
            id="conn-name"
            value={name}
            placeholder="Shop API"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="conn-description">What is it for?</Label>
        <Textarea
          id="conn-description"
          value={description}
          rows={2}
          placeholder="Looks up a customer's orders and delivery status by order number."
          onChange={(event) => setDescription(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Written for the agent, in plain words. It reads this to decide when to call the API —
          you do not have to mention the connection in the agent&apos;s instructions.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="conn-url">Base URL</Label>
        <Input
          id="conn-url"
          value={baseUrl}
          placeholder="https://api.yourshop.com"
          className="font-mono"
          onChange={(event) => setBaseUrl(event.target.value)}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="conn-secret">API key</Label>
          <Input
            id="conn-secret"
            type="password"
            autoComplete="off"
            value={secret}
            placeholder={connection?.hasSecret ? `kept (${connection.secretHint})` : ""}
            onChange={(event) => setSecret(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Stored encrypted; never shown again. {connection?.hasSecret && "Blank keeps it."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="conn-header">Sent in header</Label>
          <Input
            id="conn-header"
            value={authHeader}
            placeholder="Authorization"
            className="font-mono"
            onChange={(event) => setAuthHeader(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="conn-prefix">Prefix</Label>
          <Input
            id="conn-prefix"
            value={authPrefix}
            placeholder="Bearer "
            className="font-mono"
            onChange={(event) => setAuthPrefix(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="conn-headers">Extra headers</Label>
        <Textarea
          id="conn-headers"
          value={headers}
          rows={3}
          placeholder={"X-User-Id: {{visitor.id}}\nX-User-Email: {{visitor.email}}"}
          className="font-mono text-xs"
          onChange={(event) => setHeaders(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          One <code className="font-mono">Name: value</code> per line. Use{" "}
          <code className="font-mono">{"{{visitor.id}}"}</code> and{" "}
          <code className="font-mono">{"{{visitor.email}}"}</code> for the signed-in visitor of an
          embedded chat — filled in on the server, so the agent cannot ask as somebody else.
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Methods the agent may use</Label>
          <div className="flex flex-wrap gap-3">
            {METHODS.map((method) => (
              <label key={method} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={methods.has(method)}
                  onCheckedChange={(checked) =>
                    setMethods((current) => {
                      const next = new Set(current);
                      if (checked === true) next.add(method);
                      else next.delete(method);
                      return next;
                    })
                  }
                />
                <span className="font-mono text-xs">{method}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            GET only means the agent can look things up but never change them.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="conn-path">Paths must start with</Label>
          <Input
            id="conn-path"
            value={pathPrefix}
            placeholder="/v1/orders"
            className="font-mono"
            onChange={(event) => setPathPrefix(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Blank allows the whole host.</p>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!ready || save.isPending}
          onClick={() =>
            save.mutate(
              {
                slug,
                input: {
                  name: name.trim(),
                  description: description.trim() || null,
                  enabled: connection?.enabled ?? true,
                  baseUrl: baseUrl.trim(),
                  ...(secret.trim() ? { secret: secret.trim() } : {}),
                  authHeader: authHeader.trim() || null,
                  authPrefix,
                  extraHeaders: parseHeaders(headers),
                  allowedMethods: METHODS.filter((method) => methods.has(method)),
                  allowedPathPrefix: pathPrefix.trim(),
                },
              },
              { onSuccess: onDone },
            )
          }
        >
          {save.isPending && <Spinner data-icon="inline-start" />}
          Save
        </Button>
      </div>
    </DetailSection>
  );
}
