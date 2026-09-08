"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, KeyRound, Link2, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailSection } from "@/components/detail-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import {
  useApiKeysSuspense,
  useCreateApiKey,
  useDisconnectOAuth,
  useMyPermissionsSuspense,
  useOAuthConnectionsSuspense,
  useOAuthProvidersSuspense,
  useRevokeApiKey,
  useStartOAuth,
} from "../hooks/connections.hook";
import type { ApiKey, OAuthConnection } from "../service/connections.service";

/**
 * What can act on this workspace's behalf, and as whom.
 *
 * Two credentials on one screen because that is the question somebody comes here
 * with. A connected account is an agent acting **as a person** in another
 * system; an API key is a program acting **as this workspace**, carrying a
 * subset of what its creator may do.
 */
export function ConnectionsScreen() {
  const { workspace, can } = useWorkspace();
  const params = useSearchParams();

  const { data: providers } = useOAuthProvidersSuspense(workspace.id);
  const { data: connections } = useOAuthConnectionsSuspense(workspace.id);

  const mayManageAccounts = can("oauthConnection.manage");
  const start = useStartOAuth(workspace.id);
  const disconnect = useDisconnectOAuth(workspace.id);

  const [removing, setRemoving] = useState<OAuthConnection | null>(null);

  // The callback redirects back here with one of these.
  const connected = params.get("connected");
  const failed = params.get("error");

  return (
    <div className="space-y-6">
      {connected && (
        <p className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-400">
          {connected} connected.
        </p>
      )}
      {failed && (
        <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {failed}
        </p>
      )}

      <DetailSection
        title="Connected accounts"
        description="An agent can act as one of these — read a mailbox, post to a channel, open an issue. It acts as the person who connected it, so connect an account that should be doing that."
      >
        <ul className="space-y-2">
          {providers.map((provider) => {
            const mine = connections.filter((row) => row.provider === provider.id);

            return (
              <li key={provider.id} className="rounded-md border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Link2 className="size-4 text-muted-foreground" />
                      {provider.name}
                      {!provider.configured && (
                        <StatusBadge tone="neutral">not available here</StatusBadge>
                      )}
                    </p>
                    {!provider.configured && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        This deployment has not registered an app for {provider.name}, so it cannot
                        be connected yet.
                      </p>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!provider.configured || !mayManageAccounts || start.isPending}
                    onClick={() => start.mutate(provider.id)}
                  >
                    Connect
                  </Button>
                </div>

                {mine.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t pt-3">
                    {mine.map((connection) => (
                      <li
                        key={connection.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm">
                            {connection.accountLabel}
                            {connection.status === "active" ? (
                              <StatusBadge tone="success">connected</StatusBadge>
                            ) : (
                              <StatusBadge tone="danger">{connection.status}</StatusBadge>
                            )}
                            {!connection.renewable && (
                              <StatusBadge tone="warning">cannot renew</StatusBadge>
                            )}
                          </p>
                          {connection.lastError && (
                            <p className="mt-0.5 text-xs text-destructive">
                              {connection.lastError}
                            </p>
                          )}
                          {!connection.renewable && !connection.lastError && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {provider.name} issued no way to renew this, so it will need
                              reconnecting when it expires.
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Disconnect ${connection.accountLabel}`}
                          disabled={!mayManageAccounts}
                          onClick={() => setRemoving(connection)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </DetailSection>

      <ApiKeysSection />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Disconnect ${removing?.accountLabel ?? ""}?`}
        description="Any agent acting as this account stops being able to. The account itself is untouched — this only removes Ragenta's access."
        confirmLabel="Disconnect"
        destructive
        pending={disconnect.isPending}
        onConfirm={() => {
          if (!removing) return;
          disconnect.mutate(removing.id, { onSuccess: () => setRemoving(null) });
        }}
      />
    </div>
  );
}

function ApiKeysSection() {
  const { workspace, can } = useWorkspace();
  const { data: keys } = useApiKeysSuspense(workspace.id);
  const { data: mine } = useMyPermissionsSuspense(workspace.id);

  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const revoke = useRevokeApiKey(workspace.id);

  const mayCreate = can("apiKey.create");

  return (
    <>
      <DetailSection
        title="API keys"
        description="For a program calling Ragenta instead of a person. A key carries a subset of what you can do — and it keeps only what you still can, so a key you made stops doing what you stop being allowed to do."
      >
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No keys yet.</p>
        ) : (
          <ul className="space-y-2">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <KeyRound className="size-4 text-muted-foreground" />
                    {key.name}
                    {key.status === "active" ? (
                      <StatusBadge tone="success">active</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">{key.status}</StatusBadge>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{key.hint}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {key.permissions.length}{" "}
                    {key.permissions.length === 1 ? "permission" : "permissions"}
                    {key.lastUsedAt
                      ? ` · last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                      : " · never used"}
                  </p>
                </div>
                {key.status === "active" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Revoke ${key.name}`}
                    disabled={!can("apiKey.revoke")}
                    onClick={() => setRevoking(key)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {mayCreate && !creating && (
          <Button className="mt-4" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Create a key
          </Button>
        )}
      </DetailSection>

      {creating && <CreateKeyForm mine={mine} onDone={() => setCreating(false)} />}

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={`Revoke ${revoking?.name ?? ""}?`}
        description="It stops working immediately. The record of it stays, so the audit trail still has something to point at."
        confirmLabel="Revoke"
        destructive
        pending={revoke.isPending}
        onConfirm={() => {
          if (!revoking) return;
          revoke.mutate(revoking.id, { onSuccess: () => setRevoking(null) });
        }}
      />
    </>
  );
}

function CreateKeyForm({ mine, onDone }: { mine: string[]; onDone: () => void }) {
  const { workspace } = useWorkspace();
  const create = useCreateApiKey(workspace.id);

  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * Only what the creator holds. The backend refuses anything else by name, and
   * offering a permission that will be refused is a form that teaches somebody
   * to distrust it.
   */
  const offerable = mine.filter((permission) => !permission.startsWith("admin."));

  if (secret) {
    return (
      <DetailSection
        title="Copy this now"
        description="It is stored hashed, so this is the only time it can be shown. Closing this loses it — create another if that happens."
      >
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-xs">
            {secret}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(secret).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1_500);
              });
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <Button className="mt-4" size="sm" onClick={onDone}>
          Done
        </Button>
      </DetailSection>
    );
  }

  return (
    <DetailSection
      title="Create a key"
      description="Give it only what the program actually needs. A key that can do everything is one nobody can safely share."
    >
      <div className="space-y-2">
        <Label htmlFor="key-name">What it is for</Label>
        <Input
          id="key-name"
          value={name}
          placeholder="Order sync script"
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="mt-4 space-y-2">
        <Label>What it may do</Label>
        <div className="grid max-h-64 gap-1 overflow-auto rounded border p-2 md:grid-cols-2">
          {offerable.map((permission) => (
            <label
              key={permission}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted/60"
            >
              <Checkbox
                checked={chosen.has(permission)}
                onCheckedChange={(checked) =>
                  setChosen((current) => {
                    const next = new Set(current);
                    if (checked === true) next.add(permission);
                    else next.delete(permission);
                    return next;
                  })
                }
              />
              <span className="font-mono text-xs">{permission}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Only what you can do yourself is offered, and the key keeps only what you still can — so it
          stops doing anything you stop being allowed to do.
        </p>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!name.trim() || chosen.size === 0 || create.isPending}
          onClick={() =>
            create.mutate(
              { name: name.trim(), permissions: [...chosen] },
              { onSuccess: (created) => setSecret(created.secret) },
            )
          }
        >
          {create.isPending ? "Creating..." : "Create"}
        </Button>
      </div>
    </DetailSection>
  );
}

export function ConnectionsLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-48" />
    </div>
  );
}

export function ConnectionsError() {
  return (
    <div className="rounded-md border p-8 text-center">
      <AlertCircle className="mx-auto size-8 text-destructive" />
      <p className="mt-2 font-medium">Could not load connections</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The backend refused or is unreachable.
      </p>
    </div>
  );
}
