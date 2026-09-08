"use client";

import { useState } from "react";
import { AlertCircle, Plus, Send, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailSection } from "@/components/detail-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  useCreateWebhook,
  useDeleteWebhook,
  useRotateWebhookSecret,
  useUpdateWebhook,
  useWebhookDeliveries,
  useWebhooksSuspense,
} from "../hooks/webhooks.hook";
import type { WebhookEndpoint, WebhookEvent } from "../service/webhooks.service";

/**
 * Where this workspace asks to be told when something happens here.
 *
 * The screen is built around the two things that make an integration break and
 * stay broken: whether the secret was ever written down, and whether a delivery
 * actually arrived. So the secret is shown once on a panel that says why, and
 * the delivery log is on the same page rather than in a support ticket.
 */
export function WebhooksScreen() {
  const { workspace, can } = useWorkspace();
  const { data } = useWebhooksSuspense(workspace.id);

  const [editing, setEditing] = useState<WebhookEndpoint | "new" | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<WebhookEndpoint | null>(null);
  /** The one moment a signing secret exists outside the database. */
  const [freshSecret, setFreshSecret] = useState<{ name: string; secret: string } | null>(
    null,
  );

  const mayManage = can("webhook.manage");
  const remove = useDeleteWebhook(workspace.id);
  const rotate = useRotateWebhookSecret(workspace.id);

  return (
    <div className="space-y-6">
      <DetailSection
        title="Webhooks"
        description="We POST a signed JSON body to your server when something happens here — a run finishes, a document finishes indexing. The signature proves it came from us and is not a replay."
      >
        {data.endpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing subscribed.{" "}
            {mayManage
              ? "Add an endpoint and choose which events it should be told about."
              : "Ask an owner or admin to add one."}
          </p>
        ) : (
          <ul className="space-y-3">
            {data.endpoints.map((endpoint) => (
              <li key={endpoint.id} className="rounded-md border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <Send className="size-4 text-muted-foreground" />
                      {endpoint.name}
                      {endpoint.enabled ? (
                        <StatusBadge tone="success">on</StatusBadge>
                      ) : endpoint.disabledAt ? (
                        <StatusBadge tone="danger">switched off after failures</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">paused</StatusBadge>
                      )}
                      {endpoint.enabled && endpoint.failureCount > 0 && (
                        <StatusBadge tone="warning">
                          {endpoint.failureCount} failed in a row
                        </StatusBadge>
                      )}
                    </p>

                    <p className="font-mono text-xs text-muted-foreground">
                      POST {endpoint.url}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {endpoint.events.length}{" "}
                      {endpoint.events.length === 1 ? "event" : "events"}:{" "}
                      <span className="font-mono">{endpoint.events.join(", ")}</span>
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Signs with <code className="font-mono">{endpoint.secretHint}</code>
                      {endpoint.lastDeliveryAt &&
                        ` · last delivered ${formatDateTime(endpoint.lastDeliveryAt)}`}
                    </p>

                    {endpoint.lastError && (
                      <p className="max-w-2xl text-xs text-destructive">
                        {endpoint.lastError}
                      </p>
                    )}
                    {endpoint.disabledAt && (
                      <p className="max-w-2xl text-xs text-muted-foreground">
                        Switched off {formatDateTime(endpoint.disabledAt)} after twenty
                        failures in a row. Turning it back on starts the count again.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!mayManage || rotate.isPending}
                      onClick={() =>
                        rotate.mutate(endpoint.id, {
                          onSuccess: (secret) =>
                            setFreshSecret({ name: endpoint.name, secret }),
                        })
                      }
                    >
                      New secret
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!mayManage}
                      onClick={() => setEditing(endpoint)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${endpoint.name}`}
                      disabled={!mayManage}
                      onClick={() => setPendingRemoval(endpoint)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {mayManage && !editing && (
          <Button className="mt-4" size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Add an endpoint
          </Button>
        )}
      </DetailSection>

      {freshSecret && (
        <SecretOnce
          name={freshSecret.name}
          secret={freshSecret.secret}
          onDismiss={() => setFreshSecret(null)}
        />
      )}

      {editing && (
        <EndpointForm
          key={editing === "new" ? "new" : editing.id}
          endpoint={editing === "new" ? undefined : editing}
          events={data.events}
          onDone={(created) => {
            setEditing(null);
            if (created) setFreshSecret(created);
          }}
        />
      )}

      <DeliveryLog />

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
        title={`Remove ${pendingRemoval?.name ?? ""}?`}
        description="Nothing more is sent to it, and its delivery history goes with it. Whatever was reading it will simply stop hearing from us."
        confirmLabel="Remove"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (!pendingRemoval) return;
          remove.mutate(pendingRemoval.id, {
            onSuccess: () => setPendingRemoval(null),
          });
        }}
      />
    </div>
  );
}

/**
 * Shown once, right after the secret is issued.
 *
 * It is encrypted at rest and never read back out to a caller, so this really is
 * the only time it can be shown — which the panel says, because "where did the
 * secret go" is otherwise a support ticket.
 */
function SecretOnce({
  name,
  secret,
  onDismiss,
}: {
  name: string;
  secret: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="text-sm font-medium">The signing secret for {name}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Copy it into your receiver now. It is stored encrypted and never shown again —
        if it is lost, issue a new one, which stops the old one working.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded bg-background px-2 py-1.5 font-mono text-xs">
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
        <Button size="sm" onClick={onDismiss}>
          I have it
        </Button>
      </div>

      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">How to check the signature</summary>
        <p className="mt-2">
          Each request carries{" "}
          <code className="font-mono">X-Ragenta-Signature: t=&lt;unix&gt;,v1=&lt;hex&gt;</code>
          . Recompute <code className="font-mono">HMAC-SHA256(secret, `${"${t}"}.${"${raw body}"}`)</code>{" "}
          and compare it in constant time, then reject anything more than five minutes
          old. The timestamp is inside the signed string, so moving it does not help an
          attacker replaying a captured delivery.
        </p>
      </details>
    </div>
  );
}

function EndpointForm({
  endpoint,
  events,
  onDone,
}: {
  endpoint?: WebhookEndpoint;
  events: WebhookEvent[];
  onDone: (created?: { name: string; secret: string }) => void;
}) {
  const { workspace } = useWorkspace();
  const create = useCreateWebhook(workspace.id);
  const update = useUpdateWebhook(workspace.id);

  const [name, setName] = useState(endpoint?.name ?? "");
  const [url, setUrl] = useState(endpoint?.url ?? "");
  const [enabled, setEnabled] = useState(endpoint?.enabled ?? true);
  const [chosen, setChosen] = useState<string[]>(endpoint?.events ?? []);

  const pending = create.isPending || update.isPending;
  const ready = name.trim() && url.trim().startsWith("https://") && chosen.length > 0;

  const submit = () => {
    const input = {
      name: name.trim(),
      url: url.trim(),
      enabled,
      events: chosen,
    };

    if (endpoint) {
      update.mutate({ endpointId: endpoint.id, input }, { onSuccess: () => onDone() });
      return;
    }

    create.mutate(input, {
      onSuccess: (result) => onDone({ name: input.name, secret: result.secret }),
    });
  };

  return (
    <DetailSection
      title={endpoint ? `Edit ${endpoint.name}` : "Add an endpoint"}
      description="Everything here can be changed later. The signing secret is issued once when the endpoint is created, and replaced only when you ask for a new one."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="webhook-name">Name</Label>
          <Input
            id="webhook-name"
            value={name}
            placeholder="Order system"
            onChange={(event) => setName(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">For you, not for the receiver.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="webhook-url">URL</Label>
          <Input
            id="webhook-url"
            value={url}
            placeholder="https://api.example.com/ragenta"
            onChange={(event) => setUrl(event.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            https only. Over http the signature would still prove who sent it and do
            nothing at all to stop anybody on the path reading your data.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label>Events to send</Label>
        <div className="space-y-3 rounded-lg border p-3">
          {events.map((event) => (
            <label
              key={event.key}
              htmlFor={`event-${event.key}`}
              className="flex items-start gap-2 text-sm"
            >
              <Checkbox
                id={`event-${event.key}`}
                className="mt-0.5"
                checked={chosen.includes(event.key)}
                onCheckedChange={(checked) =>
                  setChosen((current) =>
                    checked
                      ? [...current, event.key]
                      : current.filter((key) => key !== event.key),
                  )
                }
              />
              <span className="min-w-0">
                <span className="font-mono text-xs">{event.key}</span>
                <span className="block text-xs text-muted-foreground">
                  {event.summary}
                </span>
                <span className="block text-[11px] text-muted-foreground/80">
                  Carries {event.fields.join(", ")}
                </span>
              </span>
            </label>
          ))}
        </div>
        {chosen.length === 0 && (
          <p className="text-xs text-muted-foreground">
            An endpoint with nothing chosen is never called, so at least one is
            required — choosing none is not a way to say &ldquo;all&rdquo;.
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enabled" />
          <span className="text-muted-foreground">
            {enabled ? "Deliveries are sent" : "Paused — nothing is sent"}
          </span>
        </label>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onDone()}>
            Cancel
          </Button>
          <Button disabled={!ready || pending} onClick={submit}>
            {pending ? "Saving..." : endpoint ? "Save" : "Add endpoint"}
          </Button>
        </div>
      </div>
    </DetailSection>
  );
}

/**
 * Every attempt, whether it worked or not.
 *
 * Behind a disclosure and fetched only when it is opened: it is read when
 * somebody is arguing about whether an event was sent, which is not most visits
 * to this page.
 */
function DeliveryLog() {
  const { workspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const { data: deliveries, isPending } = useWebhookDeliveries(workspace.id, open);

  return (
    <DetailSection
      title="Deliveries"
      description="Every attempt, with the answer your server gave. This is what settles whether an event was sent."
      actions={
        <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide" : "Show"}
        </Button>
      }
    >
      {!open ? (
        <p className="text-sm text-muted-foreground">
          Hidden until you ask for it — the log is long and most of it is uneventful.
        </p>
      ) : isPending ? (
        <Skeleton className="h-40" />
      ) : !deliveries?.length ? (
        <p className="text-sm text-muted-foreground">
          Nothing has been delivered yet. An event only fires when one of the things you
          subscribed to actually happens.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Took</TableHead>
                <TableHead>Your server said</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(delivery.createdAt)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{delivery.event}</TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground">
                    {delivery.attempt}
                  </TableCell>
                  <TableCell>
                    {delivery.status === "succeeded" ? (
                      <StatusBadge tone="success">
                        {delivery.responseStatus ?? "ok"}
                      </StatusBadge>
                    ) : delivery.responseStatus ? (
                      <StatusBadge tone="danger">{delivery.responseStatus}</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">no response</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                    {delivery.durationMs === null
                      ? "—"
                      : `${formatNumber(delivery.durationMs)}ms`}
                  </TableCell>
                  <TableCell className="max-w-sm">
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {delivery.error ?? delivery.responseBody ?? ""}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </DetailSection>
  );
}

export function WebhooksLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-40" />
    </div>
  );
}

export function WebhooksError() {
  return (
    <div className="rounded-md border p-8 text-center">
      <AlertCircle className="mx-auto size-8 text-destructive" />
      <p className="mt-2 font-medium">Could not load webhooks</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The backend refused or is unreachable. Reading this needs the{" "}
        <code className="font-mono text-xs">webhook.read</code> permission, which owners
        and admins have — the list names the URLs this workspace sends its own data to.
      </p>
    </div>
  );
}
