import { z } from "zod";

import { api } from "@/lib/ky";
import { pageSchema } from "@/lib/pagination";

/**
 * A workspace is Better Auth's organization — the tenant every other resource
 * hangs off. Membership and role come from the caller's own membership row, so
 * this is always "the workspaces *you* are in", never a directory.
 */
export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  role: z.string(),
  createdAt: z.coerce.string(),
});

const planPriceSchema = z.object({
  monthlyUsd: z.number().nullable(),
  perSeatUsd: z.number().nullable(),
  includedSeats: z.number().nullable(),
  extraSeatUsd: z.number().nullable(),
});

export const planLimitsSchema = z.object({
  seatLimit: z.number().nullable(),
  creditsPerSeat: z.number().nullable(),
  flatCredits: z.number().nullable(),
  topupsEnabled: z.boolean(),
  modelTiers: z.array(z.string()),
  price: planPriceSchema,
  stripePriceKey: z.string().nullable(),
});

export const billingSummarySchema = z.object({
  plan: z.string(),
  limits: planLimitsSchema,
  credits: z.object({
    plan: z.number(),
    topup: z.number(),
    total: z.number(),
    resetAt: z.coerce.string().nullable(),
  }),
  seats: z.object({
    used: z.number(),
    limit: z.number().nullable(),
  }),
});

export const workspaceOverviewSchema = z.object({
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable(),
    createdAt: z.coerce.string(),
  }),
  billing: billingSummarySchema,
  /** The caller's own role in it, straight off the membership row. */
  role: z.string(),
});

export const memberSchema = z.object({
  id: z.string(),
  role: z.string(),
  createdAt: z.coerce.string(),
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  image: z.string().nullable(),
});

export const invitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  status: z.string(),
  expiresAt: z.coerce.string().nullable(),
  createdAt: z.coerce.string(),
});

export const membersPageSchema = pageSchema(memberSchema);

export type Workspace = z.infer<typeof workspaceSchema>;
export type WorkspaceOverview = z.infer<typeof workspaceOverviewSchema>;
export type BillingSummary = z.infer<typeof billingSummarySchema>;
export type Member = z.infer<typeof memberSchema>;
export type Invitation = z.infer<typeof invitationSchema>;

/** Assignable roles. `owner` is absent: ownership transfer is its own operation. */
export const ASSIGNABLE_ROLES = ["admin", "member", "viewer"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export async function getMyWorkspaces(): Promise<Workspace[]> {
  const response = await api.get("me/workspaces");
  const body = await response.json();
  return z.object({ workspaces: z.array(workspaceSchema) }).parse(body).workspaces;
}

export async function getWorkspaceOverview(
  workspaceId: string,
): Promise<WorkspaceOverview> {
  const response = await api.get(`workspaces/${workspaceId}`);
  return workspaceOverviewSchema.parse(await response.json());
}

/**
 * The created workspace comes back as Better Auth's own organization, so it
 * carries no membership row — the creator is its owner by construction.
 */
const createdWorkspaceSchema = z.object({
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable().default(null),
    createdAt: z.coerce.string(),
  }),
});

export async function createWorkspace(input: {
  name: string;
  slug?: string;
}): Promise<Workspace> {
  const response = await api.post("workspaces", { json: input });
  const { workspace } = createdWorkspaceSchema.parse(await response.json());
  return { ...workspace, role: "owner" };
}

export async function updateWorkspace(
  workspaceId: string,
  input: { name?: string; logo?: string | null },
): Promise<void> {
  await api.patch(`workspaces/${workspaceId}`, { json: input });
}

export async function getMembers(workspaceId: string) {
  const response = await api.get(`workspaces/${workspaceId}/members`, {
    searchParams: { limit: 100, offset: 0 },
  });
  return membersPageSchema.parse(await response.json());
}

export async function getInvitations(workspaceId: string): Promise<Invitation[]> {
  const response = await api.get(`workspaces/${workspaceId}/invitations`);
  const body = await response.json();
  return z
    .object({ invitations: z.array(invitationSchema) })
    .parse(body).invitations;
}

export async function inviteMember(
  workspaceId: string,
  input: { email: string; role: AssignableRole },
): Promise<void> {
  await api.post(`workspaces/${workspaceId}/invitations`, { json: input });
}

export async function cancelInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/invitations/${invitationId}`);
}

export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  role: AssignableRole,
): Promise<void> {
  await api.patch(`workspaces/${workspaceId}/members/${memberId}`, {
    json: { role },
  });
}

export async function removeMember(
  workspaceId: string,
  memberId: string,
): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/members/${memberId}`);
}
