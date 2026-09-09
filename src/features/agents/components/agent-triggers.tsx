"use client";

import { useState } from "react";
import { Clock, Plus, Trash2, Webhook } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailSection } from "@/components/detail-shell";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import {
  useCreateTrigger,
  useDeleteTrigger,
  useTriggers,
  useUpdateTrigger,
} from "../hooks/agents.hook";
import {
  webhookUrl,
  type SaveTriggerInput,
  type Trigger,
  type TriggerKind,
} from "../service/agents.service";

/**
 * Cron for people who do not write cron.
 *
 * The free-text box is still there, because the presets cannot cover everything
 * and this product's users include people who know exactly what they want. What
 * the presets buy is that the common case never requires knowing that the fifth
 * field is the day of the week.
 */
const CRON_PRESETS = [
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 9 * * *", label: "Every day at 09:00" },
  { value: "0 9 * * 1-5", label: "Every weekday at 09:00" },
  { value: "0 9 * * 1", label: "Every Monday at 09:00" },
  { value: "0 9 1 * *", label: "The 1st of each month at 09:00" },
] as const;

const CUSTOM_CRON = "__custom__";

function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function timezoneOptions(): string[] {
  // Not in every engine, and a missing list only costs the suggestions.
  const withValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  try {
    return withValues.supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

/**
 * What starts this agent when nobody is watching.
 *
 * Both kinds spend money with nobody present, so the screen leads with the
 * consequence rather than the mechanism: a schedule says when it will next run,
 * a webhook says who can call it, and a failing one says how many times it has
 * failed. A webhook's secret is shown once, at creation, because it is stored
 * hashed and there is genuinely nothing to show afterwards.
 */
const TRIGGERS_DESCRIPTION =
	"A schedule runs this agent on a clock; a webhook lets another system start it. Both spend credits with nobody watching, so a broken one is backed off rather than retried forever."

export function AgentTriggers({
  workspaceId,
  agentId,
  disabled,
}: {
  workspaceId: string;
  agentId: string;
  disabled?: boolean;
}) {
  const { data: triggers, isPending } = useTriggers(workspaceId, agentId);
  const update = useUpdateTrigger(workspaceId, agentId);
  const remove = useDeleteTrigger(workspaceId, agentId);

  const [adding, setAdding] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<Trigger | null>(null);
  /** The one moment a webhook's secret exists outside the database. */
  const [freshSecret, setFreshSecret] = useState<{
    name: string;
    secret: string;
  } | null>(null);

  return (
    <div className="space-y-6">
      <DetailSection
        title="Triggers"
        description={TRIGGERS_DESCRIPTION}
        actions={
          !adding && (
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setAdding(true)}
            >
              <Plus className="size-4" />
              Add a trigger
            </Button>
          )
        }
      >
        {isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !triggers?.length ? (
          <p className="text-sm text-muted-foreground">
            Nothing starts this agent but a person. Add a schedule to run it on a
            clock, or a webhook to let another system start it.
          </p>
        ) : (
          <ul className="space-y-3">
            {triggers.map((trigger) => (
              <li key={trigger.id} className="rounded-md border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {trigger.kind === "schedule" ? (
                        <Clock className="size-4 text-muted-foreground" />
                      ) : (
                        <Webhook className="size-4 text-muted-foreground" />
                      )}
                      {trigger.name}
                      {trigger.enabled ? (
                        <StatusBadge tone="success">on</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">paused</StatusBadge>
                      )}
                      {trigger.failureCount > 0 && (
                        <StatusBadge tone="warning">
                          {trigger.failureCount} failed
                        </StatusBadge>
                      )}
                    </p>

                    {trigger.kind === "schedule" ? (
                      <p className="text-xs text-muted-foreground">
                        <code className="font-mono">{trigger.cron}</code> ·{" "}
                        {trigger.timezone}
                        {trigger.enabled &&
                          trigger.nextRunAt &&
                          ` · next ${formatDateTime(trigger.nextRunAt)}`}
                      </p>
                    ) : (
                      <WebhookAddress trigger={trigger} />
                    )}

                    {trigger.input && (
                      <p className="max-w-2xl truncate text-xs text-muted-foreground">
                        Asks: {trigger.input}
                      </p>
                    )}
                    {trigger.lastFiredAt && (
                      <p className="text-xs text-muted-foreground">
                        Last fired {formatDateTime(trigger.lastFiredAt)}
                      </p>
                    )}
                    {trigger.lastError && (
                      <p className="max-w-2xl text-xs text-destructive">
                        {trigger.lastError}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      aria-label={`${trigger.name} on`}
                      disabled={disabled || update.isPending}
                      checked={trigger.enabled}
                      onCheckedChange={(checked) =>
                        update.mutate({
                          triggerId: trigger.id,
                          input: {
                            kind: trigger.kind,
                            name: trigger.name,
                            enabled: checked,
                            input: trigger.input,
                            ...(trigger.cron ? { cron: trigger.cron } : {}),
                            timezone: trigger.timezone,
                          },
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${trigger.name}`}
                      disabled={disabled}
                      onClick={() => setPendingRemoval(trigger)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      {freshSecret && (
        <SecretOnce
          name={freshSecret.name}
          secret={freshSecret.secret}
          onDismiss={() => setFreshSecret(null)}
        />
      )}

      {adding && (
        <TriggerForm
          workspaceId={workspaceId}
          agentId={agentId}
          onDone={(created) => {
            setAdding(false);
            if (created) setFreshSecret(created);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
        title={`Remove ${pendingRemoval?.name ?? ""}?`}
        description={
          pendingRemoval?.kind === "webhook"
            ? "Its secret stops working immediately and whatever was calling it starts getting a 404. Runs it already started are kept."
            : "The agent stops running on this schedule. Runs it already started are kept."
        }
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

/** The URL a caller POSTs to, with the copy button next to it. */
function WebhookAddress({ trigger }: { trigger: Trigger }) {
  const [copied, setCopied] = useState(false);
  const url = webhookUrl(trigger.id);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <code className="overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs">
          POST {url}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1_500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        With the secret in an <code className="font-mono">X-Ragenta-Secret</code>{" "}
        header
        {trigger.secretHint && (
          <>
            {" "}
            (it starts <code className="font-mono">{trigger.secretHint}</code>)
          </>
        )}
        . The body&apos;s <code className="font-mono">input</code> is what the agent
        is asked.
      </p>
    </div>
  );
}

/** Shown once, right after creation, and never again. */
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
      <p className="text-sm font-medium">The secret for {name}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Copy it now. It is stored hashed, so this is the only time it can be shown —
        if it is lost, remove the webhook and add another.
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
    </div>
  );
}

function TriggerForm({
  workspaceId,
  agentId,
  onDone,
}: {
  workspaceId: string;
  agentId: string;
  onDone: (created?: { name: string; secret: string }) => void;
}) {
  const create = useCreateTrigger(workspaceId, agentId);

  const [kind, setKind] = useState<TriggerKind>("schedule");
  const [name, setName] = useState("");
  const [input, setInput] = useState("");
  const [preset, setPreset] = useState<string>(CRON_PRESETS[1].value);
  const [customCron, setCustomCron] = useState("");
  const [timezone, setTimezone] = useState(localTimezone());

  const zones = timezoneOptions();
  const cron = preset === CUSTOM_CRON ? customCron.trim() : preset;
  // A schedule with nothing to ask runs and produces nothing, which is why the
  // brief is required for one and only a fallback for a webhook.
  const ready =
    name.trim().length > 0 &&
    (kind === "webhook" || (cron.length > 0 && input.trim().length > 0));

  const submit = () => {
    const payload: SaveTriggerInput = {
      kind,
      name: name.trim(),
      enabled: true,
      input: input.trim(),
      timezone,
      ...(kind === "schedule" ? { cron } : {}),
    };

    create.mutate(payload, {
      onSuccess: (result) =>
        onDone(
          result.secret ? { name: name.trim(), secret: result.secret } : undefined,
        ),
    });
  };

  return (
    <DetailSection
      title="Add a trigger"
      description="A trigger's kind cannot be changed afterwards — the two are configured by different things, and one of them holds a credential."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Kind</Label>
          <Select value={kind} onValueChange={(next) => setKind(next as TriggerKind)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="schedule">On a schedule</SelectItem>
              <SelectItem value="webhook">When another system calls it</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="trigger-name">Name</Label>
          <Input
            id="trigger-name"
            value={name}
            placeholder={kind === "schedule" ? "Morning summary" : "Order created"}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            For you. It has to be unique within this agent.
          </p>
        </div>
      </div>

      {kind === "schedule" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>When</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRON_PRESETS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_CRON}>A cron expression…</SelectItem>
              </SelectContent>
            </Select>
            {preset === CUSTOM_CRON && (
              <>
                <Input
                  value={customCron}
                  placeholder="0 9 * * 1-5"
                  onChange={(event) => setCustomCron(event.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Five fields: minute, hour, day of month, month, day of week. Six
                  are refused — a seconds field would let a schedule run sixty times
                  a minute.
                </p>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="trigger-timezone">Time zone</Label>
            <Input
              id="trigger-timezone"
              value={timezone}
              list="trigger-timezones"
              onChange={(event) => setTimezone(event.target.value)}
            />
            {zones.length > 0 && (
              <datalist id="trigger-timezones">
                {zones.map((zone) => (
                  <option key={zone} value={zone} />
                ))}
              </datalist>
            )}
            <p className="text-xs text-muted-foreground">
              09:00 is a different instant in each zone, so this is read rather than
              guessed from wherever the server happens to run.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <Label htmlFor="trigger-input">
          {kind === "schedule"
            ? "What to ask the agent"
            : "What to ask when the call carries nothing"}
        </Label>
        <Textarea
          id="trigger-input"
          rows={3}
          value={input}
          placeholder={
            kind === "schedule"
              ? "Summarise yesterday's support tickets and list anything still open."
              : "Handle this event."
          }
          onChange={(event) => setInput(event.target.value)}
        />
        {kind === "webhook" && (
          <p className="text-xs text-muted-foreground">
            A caller that sends an <code className="font-mono">input</code> field
            decides for itself; this is the fallback for one that sends an empty
            body.
          </p>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button disabled={!ready || create.isPending} onClick={submit}>
          {create.isPending ? "Adding…" : "Add trigger"}
        </Button>
      </div>
    </DetailSection>
  );
}

/**
 * What triggers look like on a plan that does not include them.
 *
 * Shares `TRIGGERS_DESCRIPTION` with the real section so the two cannot drift,
 * and invents its rows rather than reading any: a replica exists so somebody can
 * see the feature before paying for it, and fetching a workspace's real triggers
 * to hide them behind a dimmed layer would be the leak this gate exists to avoid.
 */
export function AgentTriggersPreview() {
  return (
    <div className="space-y-6">
      <DetailSection title="Triggers" description={TRIGGERS_DESCRIPTION}>
        <ul className="space-y-3">
          <li className="rounded-md border p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Clock className="size-4 text-muted-foreground" />
              Every weekday at 08:00
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">0 8 * * 1-5</p>
          </li>
          <li className="rounded-md border p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Webhook className="size-4 text-muted-foreground" />
              Orders webhook
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              whsec_••••••••••••
            </p>
          </li>
        </ul>
      </DetailSection>
    </div>
  );
}
