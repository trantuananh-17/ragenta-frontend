"use client";

import { useState } from "react";
import { AlertCircle, BarChart3, Globe, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { WidgetActivityDialog } from "./widget-activity-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAgentsSuspense } from "@/features/agents/hooks/agents.hook";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { useDeleteWidget, useSaveWidget, useWidgetsSuspense } from "../hooks/widgets.hook";
import { embedSnippet, type Widget } from "../service/widgets.service";

/**
 * The chat bubble a customer puts on their own website.
 *
 * The screen is opinionated about two things, because both are how this goes
 * wrong: the origins it will run on, and how much it may spend in a day. Neither
 * is buried in an "advanced" section — a widget is a public endpoint that costs
 * money, and somebody publishing one should have read both sentences.
 */
export function WidgetsScreen() {
  const { workspace, can } = useWorkspace();
  const { data: widgets } = useWidgetsSuspense(workspace.id);
  const { data: agents } = useAgentsSuspense(workspace.id);

  const [editing, setEditing] = useState<Widget | "new" | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<Widget | null>(null);
  const [inspecting, setInspecting] = useState<Widget | null>(null);

  const mayManage = can("widget.manage");
  const remove = useDeleteWidget(workspace.id);

  return (
    <div className="space-y-6">
      <DetailSection
        title="Embedded chat"
        description="A chat bubble on your own website, answering from this workspace's agents. Visitors do not need an account."
      >
        {widgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing published yet.{" "}
            {mayManage
              ? "Publish one and paste two lines into your site."
              : "Ask an owner or admin to publish one."}
          </p>
        ) : (
          <ul className="space-y-3">
            {widgets.map((widget) => (
              <li key={widget.id} className="rounded-md border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {widget.name}
                      {widget.enabled ? (
                        <StatusBadge tone="success">live</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">paused</StatusBadge>
                      )}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Globe className="size-3" />
                      {widget.allowedOrigins.join(", ")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInspecting(widget)}
                    >
                      <BarChart3 className="size-4" />
                      Activity
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!mayManage}
                      onClick={() => setEditing(widget)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${widget.name}`}
                      disabled={!mayManage}
                      onClick={() => setPendingRemoval(widget)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <EmbedSnippet publicKey={widget.publicKey} />
              </li>
            ))}
          </ul>
        )}

        {mayManage && (
          <Button className="mt-4" size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Publish a chat
          </Button>
        )}
      </DetailSection>

      {editing && (
        <WidgetForm
          key={editing === "new" ? "new" : editing.id}
          widget={editing === "new" ? undefined : editing}
          agents={agents.items.map((agent) => ({ id: agent.id, name: agent.name }))}
          onDone={() => setEditing(null)}
        />
      )}

      {inspecting && (
        <WidgetActivityDialog
          workspaceId={workspace.id}
          widget={inspecting}
          open
          onOpenChange={(next) => !next && setInspecting(null)}
        />
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
        title={`Remove ${pendingRemoval?.name ?? ""}?`}
        description="The chat stops answering immediately. Anybody who pasted the snippet into their site will see nothing — remove the script tag from the page as well."
        confirmLabel="Remove"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (!pendingRemoval) return;
          remove.mutate(pendingRemoval.id, { onSuccess: () => setPendingRemoval(null) });
        }}
      />
    </div>
  );
}

/** The two lines somebody pastes. Rendered from the browser's own origin. */
function EmbedSnippet({ publicKey }: { publicKey: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = embedSnippet(publicKey);

  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-xs">
          {snippet}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(snippet).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1_500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste it before <code className="font-mono">&lt;/body&gt;</code>. The key is meant to be
        public — it only works on the sites listed above.
      </p>
    </div>
  );
}

function WidgetForm({
  widget,
  agents,
  onDone,
}: {
  widget?: Widget;
  agents: { id: string; name: string }[];
  onDone: () => void;
}) {
  const { workspace } = useWorkspace();
  const save = useSaveWidget(workspace.id);

  const [name, setName] = useState(widget?.name ?? "");
  const [agentId, setAgentId] = useState(widget?.agentId ?? agents[0]?.id ?? "");
  const [origins, setOrigins] = useState((widget?.allowedOrigins ?? []).join("\n"));
  const [title, setTitle] = useState(widget?.title ?? "Chat");
  const [greeting, setGreeting] = useState(widget?.greeting ?? "");
  const [accentColor, setAccentColor] = useState(widget?.accentColor ?? "#7c3aed");
  const [ceiling, setCeiling] = useState(String(widget?.dailyCreditCeiling ?? 50_000));
  const [visitorLimit, setVisitorLimit] = useState(String(widget?.visitorHourlyLimit ?? 20));

  const originList = origins
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <DetailSection
      title={widget ? `Edit ${widget.name}` : "Publish a chat"}
      description="Everything here can be changed later, except which sites it runs on — change that whenever the site changes."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="widget-name">Name</Label>
          <Input
            id="widget-name"
            value={name}
            placeholder="Shop help"
            onChange={(event) => setName(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">For you, not for visitors.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="widget-agent">Agent</Label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger id="widget-agent">
              <SelectValue placeholder="Choose an agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Its published version decides what the chat knows and can do.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="widget-origins">Sites it may run on</Label>
        <Textarea
          id="widget-origins"
          value={origins}
          rows={3}
          placeholder={"https://shop.example.com\nhttps://*.example.com"}
          onChange={(event) => setOrigins(event.target.value)}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          One per line, scheme included. <code className="font-mono">https://*.example.com</code>{" "}
          covers subdomains. The chat refuses to load anywhere else — and an empty list means
          nowhere, so it must have at least one.
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="widget-title">Header</Label>
          <Input
            id="widget-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="widget-colour">Colour</Label>
          <Input
            id="widget-colour"
            type="color"
            value={accentColor}
            onChange={(event) => setAccentColor(event.target.value)}
            className="h-9 p-1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="widget-visitor-limit">Messages per visitor, per hour</Label>
          <Input
            id="widget-visitor-limit"
            type="number"
            min={1}
            max={200}
            value={visitorLimit}
            onChange={(event) => setVisitorLimit(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="widget-greeting">First message</Label>
        <Textarea
          id="widget-greeting"
          value={greeting}
          rows={2}
          placeholder="Hi — ask me anything about our products."
          onChange={(event) => setGreeting(event.target.value)}
        />
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="widget-ceiling">Credits it may spend in a day</Label>
        <Input
          id="widget-ceiling"
          type="number"
          min={1_000}
          step={1_000}
          value={ceiling}
          onChange={(event) => setCeiling(event.target.value)}
          className="max-w-48"
        />
        <p className="text-xs text-muted-foreground">
          Its own ceiling, separate from the workspace balance. When it is reached the chat says it
          is unavailable until tomorrow — which is a bad hour rather than an empty wallet.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={widget?.enabled ?? true}
            disabled
            aria-label="Live"
          />
          <span className="text-muted-foreground">
            {widget?.enabled === false ? "Paused" : "Live once saved"}
          </span>
        </label>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button
            disabled={
              save.isPending || !name.trim() || !agentId || originList.length === 0
            }
            onClick={() =>
              save.mutate(
                {
                  ...(widget ? { id: widget.id } : {}),
                  agentId,
                  name: name.trim(),
                  enabled: widget?.enabled ?? true,
                  allowedOrigins: originList,
                  greeting: greeting.trim(),
                  accentColor,
                  title: title.trim() || "Chat",
                  dailyCreditCeiling: Number(ceiling) || 50_000,
                  visitorHourlyLimit: Number(visitorLimit) || 20,
                },
                { onSuccess: onDone },
              )
            }
          >
            {save.isPending ? "Saving..." : widget ? "Save" : "Publish"}
          </Button>
        </div>
      </div>
    </DetailSection>
  );
}

export function WidgetsLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-32" />
    </div>
  );
}

export function WidgetsError() {
  return (
    <div className="rounded-md border p-8 text-center">
      <AlertCircle className="mx-auto size-8 text-destructive" />
      <p className="mt-2 font-medium">Could not load embedded chat</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The backend refused or is unreachable. Reading this needs the{" "}
        <code className="font-mono text-xs">widget.read</code> permission.
      </p>
    </div>
  );
}
