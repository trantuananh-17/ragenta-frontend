"use client";

import { useState } from "react";
import { AlertCircle, BarChart3, Globe, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { WidgetActivityDialog } from "./widget-activity-dialog";
import { WidgetPreview } from "./widget-preview";
import { DetailSection } from "@/components/detail-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import { embedSnippet, identifiedEmbedSnippet, type Widget } from "../service/widgets.service";

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
                {widget.identitySecret && (
                  <IdentitySnippet
                    publicKey={widget.publicKey}
                    identitySecret={widget.identitySecret}
                  />
                )}
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
  const snippet = embedSnippet(publicKey);

  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-sm bg-muted px-2 py-1.5 font-mono text-xs">
          {snippet}
        </code>
        <CopyButton value={snippet} label="Copy" />
      </div>
      <p className="text-xs text-muted-foreground">
        Paste it before <code className="font-mono">&lt;/body&gt;</code>. The key is meant to be
        public — it only works on the sites listed above.
      </p>
    </div>
  );
}

/**
 * How the host site tells the agent who is chatting, so a connection can carry
 * `{{visitor.id}}` to their own API. Collapsed by default: most widgets never
 * need it, and the secret should not be on screen for everyone who opens the
 * page.
 */
function IdentitySnippet({
  publicKey,
  identitySecret,
}: {
  publicKey: string;
  identitySecret: string;
}) {
  const [open, setOpen] = useState(false);
  const snippet = identifiedEmbedSnippet(publicKey);

  if (!open) {
    return (
      <Button variant="link" size="sm" className="mt-1 h-auto px-0" onClick={() => setOpen(true)}>
        Identify signed-in visitors…
      </Button>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border bg-muted/40 p-3">
      <p className="text-xs">
        Your server signs the user id with this secret and renders it into the tag. The agent can
        then pass <code className="font-mono">{"{{visitor.id}}"}</code> and{" "}
        <code className="font-mono">{"{{visitor.email}}"}</code> to your API through a connection.
        Keep the secret on the server — never in the page.
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-sm bg-background px-2 py-1.5 font-mono text-xs">
          {identitySecret}
        </code>
        <CopyButton value={identitySecret} label="Copy secret" />
      </div>
      <div className="flex items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-sm bg-background px-2 py-1.5 font-mono text-xs">
          {snippet}
        </pre>
        <CopyButton value={snippet} label="Copy" />
      </div>
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
  const [position, setPosition] = useState<Widget["position"]>(widget?.position ?? "right");
  const [language, setLanguage] = useState<Widget["language"]>(widget?.language ?? "en");
  const [launcherLabel, setLauncherLabel] = useState(widget?.launcherLabel ?? "");
  const [placeholder, setPlaceholder] = useState(widget?.placeholder ?? "Type a message…");
  const [quickQuestions, setQuickQuestions] = useState(
    (widget?.quickQuestions ?? []).join("\n"),
  );
  const [ceiling, setCeiling] = useState(String(widget?.dailyCreditCeiling ?? 50_000));
  const [visitorLimit, setVisitorLimit] = useState(String(widget?.visitorHourlyLimit ?? 20));

  const originList = splitLines(origins);
  const questionList = splitLines(quickQuestions).slice(0, 6);

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

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-medium">How it looks</p>
          <div className="mt-2 grid gap-4 md:grid-cols-2">
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
              <Label htmlFor="widget-position">Position</Label>
              <Select
                value={position}
                onValueChange={(value) => setPosition(value === "left" ? "left" : "right")}
              >
                <SelectTrigger id="widget-position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Bottom right</SelectItem>
                  <SelectItem value="left">Bottom left</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="widget-language">Language</Label>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value === "vi" ? "vi" : "en")}
              >
                <SelectTrigger id="widget-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="vi">Tiếng Việt</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The chat&apos;s own words: Send, Searching…; your greeting and questions are
                whatever you type.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="widget-launcher-label">Button label</Label>
              <Input
                id="widget-launcher-label"
                value={launcherLabel}
                maxLength={40}
                placeholder="Ask us"
                onChange={(event) => setLauncherLabel(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Shown beside the chat button. Leave empty for the icon alone.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="widget-placeholder">Placeholder</Label>
              <Input
                id="widget-placeholder"
                value={placeholder}
                onChange={(event) => setPlaceholder(event.target.value)}
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
            <Label htmlFor="widget-quick-questions">Quick questions</Label>
            <Textarea
              id="widget-quick-questions"
              value={quickQuestions}
              rows={3}
              placeholder={"Where is my order?\nWhat is your return policy?"}
              onChange={(event) => setQuickQuestions(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              One per line. Up to six. Shown as buttons before the visitor types their first
              message — a good one is the question people ask most.
            </p>
          </div>
        </div>

        <WidgetPreview
          title={title}
          accentColor={accentColor}
          greeting={greeting}
          quickQuestions={questionList}
          placeholder={placeholder}
          launcherLabel={launcherLabel}
          position={position}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
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
        <div className="space-y-2">
          <Label htmlFor="widget-ceiling">Credits it may spend in a day</Label>
          <Input
            id="widget-ceiling"
            type="number"
            min={1_000}
            step={1_000}
            value={ceiling}
            onChange={(event) => setCeiling(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Its own ceiling, separate from the workspace balance. When it is reached the chat says
            it is unavailable until tomorrow — which is a bad hour rather than an empty wallet.
          </p>
        </div>
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
                  quickQuestions: questionList.map((question) => question.slice(0, 80)),
                  placeholder: placeholder.trim() || "Type a message…",
                  launcherLabel: launcherLabel.trim(),
                  position,
                  language,
                  dailyCreditCeiling: Number(ceiling) || 50_000,
                  visitorHourlyLimit: Number(visitorLimit) || 20,
                },
                { onSuccess: onDone },
              )
            }
          >
            {save.isPending && <Spinner data-icon="inline-start" />}
            {widget ? "Save" : "Publish"}
          </Button>
        </div>
      </div>
    </DetailSection>
  );
}

/** One entry per line — how origins and quick questions are typed. */
function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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
