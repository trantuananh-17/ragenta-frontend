# ragenta-frontend

The customer application. Next.js 16 App Router, React 19 with the React
Compiler, Tailwind v4, shadcn/ui on Radix, TanStack Query v5, ky + zod 4, nuqs,
Better Auth client, and a Hono proxy at `/api/*`.

Dev port `3001`; the container listens on `8082`, the port reserved for this
service in `ragenta-deployment/docs/vm-access.md`.

```bash
pnpm install
cp .env.example .env.local   # point RAGENTA_API_URL at a running backend
pnpm dev
```

## What it is for

Chatting with your own documents. A workspace holds knowledge bases; a knowledge
base holds documents; a document is parsed, chunked, embedded and indexed by the
backend's worker; a conversation retrieves passages from one of those bases and
answers with `[[n]]` citations that map back to the exact chunk. Everything is
paid for in credits from a ledger.

## Layout

```text
src/
├── app/
│   ├── (auth)/            sign-in, sign-up, password reset, invitation — no shell
│   ├── (app)/             the signed-in shell: sidebar + top bar
│   ├── onboarding/        create the first workspace (outside the shell on purpose)
│   └── api/[[...route]]/  the Hono proxy mount
├── components/            app shell, shared primitives, ui/ (shadcn)
├── features/<name>/       one folder per domain — see below
├── lib/                   ky, auth, workspace resolution, SSE, formatting
└── proxy/                 the Hono app the route above mounts
```

### Feature modules

Every feature is the same five folders, which is what makes a new screen a
mechanical exercise rather than a design decision:

```text
features/<name>/
├── service/     API calls + zod schemas — the only place a URL is written
├── options/     queryOptions + key factories (no "use client", so the server can import them)
├── hooks/       "use client" — useSuspenseQuery / useMutation wrappers
├── server/      prefetch.ts (and params-loader.ts where nuqs is used)
└── components/  the screens
```

`options/` is split from `hooks/` because `queryOptions` in a `"use client"` file
cannot be imported by a server prefetch. Keeping them in a directive-free file
lets both runtimes share one key factory, so a prefetch and a hook can never
disagree about a cache key.

Modules: `auth`, `workspace`, `projects`, `knowledge`, `chat`, `models`,
`billing`, `usage`, `account`.

### The page pattern

Server component: gate, prefetch, hydrate. Client component: suspend on the same
query the server already filled.

```tsx
export default async function Page() {
  const workspace = await requireWorkspace();
  await prefetchKnowledgeBases(workspace.id);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<Error />}>
        <Suspense fallback={<Loading />}>
          <Screen />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
```

## Authentication and the workspace

`ragenta-backend` is the only source of identity. `lib/auth.ts` asks it for the
session on every server render — a revoked session stops working here the moment
it stops working there — and `requireAuth()` is the gate every page behind
`(app)` inherits from its layout.

There is **no JWT layer**. The backend authenticates the Better Auth session
cookie directly, so the proxy forwards the cookie and adds nothing.

A workspace is a Better Auth organization, and every product route is
`/v1/workspaces/:workspaceId/...`. `lib/workspace.ts` resolves which one a render
is about: the `ragenta_workspace` cookie if it names a workspace the caller is
still a member of, otherwise their most recent membership. The cookie is a
**preference, not a credential** — the backend answers 404 for a workspace you
are not in, so a forged cookie buys nothing, which is also why it is validated
against the real membership list rather than trusted.

The resolved workspace is handed down through `WorkspaceProvider`. Screens read
it with `useWorkspace()` / `useWorkspaceId()` instead of re-deriving it, so two
halves of one page can never end up looking at different tenants.

Roles are UX only here: `canContribute` and `canAdminister` decide whether a
button is shown. The backend re-checks membership and role at the resource
boundary on every request, and is what actually enforces them.

## The API layer

```text
Browser ──ky──▶ /api/v1/*  ──Hono proxy──▶ RAGENTA_API_URL/v1/*
Server  ─────────────────ky (cookie replayed)────▶ RAGENTA_API_URL/v1/*
```

`lib/ky.ts` is dual-mode: in the browser the prefix is relative, so the call is
same-origin and the httpOnly session cookie rides along with no CORS
arrangement; on the server it addresses the backend directly and replays the
caller's cookie. The backend URL therefore never reaches the bundle.

Two calls deliberately bypass ky:

- **Chat streaming** (`streamMessage`) uses raw `fetch`, because ky buffers a
  response before returning it and would hold every token until the answer was
  complete. `lib/sse.ts` parses the backend's SSE frames.
- **Document upload** uses raw `fetch` with `FormData`, so the browser sets the
  multipart boundary itself.

## Chat

One turn is a POST that streams Server-Sent Events. Everything that can refuse a
turn — no credits, a model outside the plan, a knowledge base that has gone — is
refused by the backend *before* the stream opens, so a refusal is a normal 4xx
with a message, not an error frame arriving after the UI has switched into
"answering".

While a turn runs, the answer accumulates in local state rather than in the
query cache: a `setQueryData` per token would re-render every subscriber on every
token. When the stream finishes the cache is invalidated and the server's own
rows win — they carry the citations, the model and what the turn cost, which the
deltas do not.

Citations are exact, not inferred. The model is asked to cite with `[[n]]`
markers and the server freezes the matching passages onto the message, so
rendering is a lookup by index — no post-hoc similarity matching that can point
at the wrong paragraph.

## Ingestion

Uploading queues a worker job; the row comes back `pending` and advances through
`parsing → chunking → embedding → ready`, or `failed` with a reason a human can
act on. The documents list polls **only while something is still in flight** and
stops the moment every row has settled.

A scanned PDF has no text layer and will fail — there is no OCR in the backend
yet, and the document says so rather than silently indexing nothing.

The document screen shows the chunks themselves, because they are the honest
view of a knowledge base: retrieval can only ever return one of those passages,
so an answer that misses something is usually explained there.

## Not built, and why

- **Agents.** The backend has no agent module yet; there is nothing to drive.
- **API keys.** No backend endpoint issues them.
- **Auto-reload settings.** The endpoints exist (`/billing/auto-reload`) and the
  service and query are written, but no screen edits it yet — it needs a Stripe
  payment method on file to be meaningful, and staging has no Stripe keys.
- **i18n.** The landing page ships `en`/`vi`; this app is English only until the
  copy is settled. `next-intl` is not installed, so adding it is a real change
  rather than filling in files.
- **Conversation search, regenerate, title auto-generation.** The backend
  supports none of the three.

## Deployment

Live on staging at **https://staging-frontend.ragenta.cloud**, running
`v0.1.0rc1`. The container listens on `127.0.0.1:8082`; `ragenta-deployment`
carries the `app` service, the `IMAGE_TAG_APP_FRONTEND` pin and the nginx vhost.

Releases are tags: `v1.2.0rc1` goes to staging, `v1.2.0` to production. The tag
builds and pushes the image to GHCR, then deploys.

**The deploy half is not wired yet.** This repository's `staging` GitHub
Environment has `DEPLOY_PATH` but not `SSH_HOST` / `SSH_USER` / `SSH_KEY`, so
`deploy-template.yml` publishes the image and then says it skipped. Until those
three secrets exist, a release has to be finished by hand on the VM — the same
four commands the workflow would have run:

```bash
cd /srv/ragenta-deployment/environments/staging
( umask 077; grep -v '^IMAGE_TAG_APP_FRONTEND=' .env > .env.next )
echo "IMAGE_TAG_APP_FRONTEND=v0.1.0rc1" >> .env.next && chmod 600 .env.next && mv .env.next .env
docker compose pull app && docker compose up -d app
```

The nginx vhost gives `/api/v1/workspaces` its own location with
`proxy_buffering off`, because chat answers stream token by token and the
default would hold the whole answer until the end. It is matched with `^~` and
no trailing slash on purpose: a `location /api/v1/workspaces/` makes nginx 301
the bare collection path, and a 301 on a POST is re-issued as a GET — which
would turn creating a workspace during onboarding into a silent no-op.

## Scripts

```bash
pnpm dev        # port 3001
pnpm build
pnpm start      # port 8082
pnpm lint
pnpm typecheck
```

`check.yml` runs lint → build → typecheck on every pull request and before every
release, in that order: `next build` writes `next-env.d.ts` and `.next/types`,
both of which `tsconfig` includes, so running `tsc` first would typecheck a
different program than the one that ships.
