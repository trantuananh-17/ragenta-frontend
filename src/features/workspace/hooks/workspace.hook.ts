"use client";

import { useRouter } from "next/navigation";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api-error";
import { authClient } from "@/lib/auth-client";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";
import { workspaceKeys, workspaceOptions } from "../options/workspace.options";
import {
  cancelInvitation,
  createWorkspace,
  inviteMember,
  removeMember,
  updateMemberRole,
  updateWorkspace,
  type AssignableRole,
} from "../service/workspace.service";

export function useWorkspaceOverviewSuspense(workspaceId: string) {
  return useSuspenseQuery(workspaceOptions.overview(workspaceId));
}

export function useMembersSuspense(workspaceId: string) {
  return useSuspenseQuery(workspaceOptions.members(workspaceId));
}

export function useInvitationsSuspense(workspaceId: string) {
  return useSuspenseQuery(workspaceOptions.invitations(workspaceId));
}

/**
 * Switching workspace.
 *
 * Three things move together and all three are needed: the cookie this app
 * resolves the active workspace from, Better Auth's own `activeOrganizationId`
 * on the session (what `/v1/me` reports), and the cache — every query held is
 * scoped to the workspace being left.
 *
 * A year is fine for the cookie: it is a preference, and the backend refuses a
 * workspace the caller is not a member of regardless of what it says.
 */
export function useSwitchWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workspaceId: string) => {
      document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${workspaceId}; path=/; max-age=31536000; samesite=lax`;
      await authClient.organization.setActive({ organizationId: workspaceId });
    },
    onSuccess: () => {
      queryClient.clear();
      router.push("/chat");
      router.refresh();
    },
    onError: async (error) => {
      toast.error("Could not switch workspace", {
        description: await errorMessage(error),
      });
    },
  });
}

export function useCreateWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: async (workspace) => {
      document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${workspace.id}; path=/; max-age=31536000; samesite=lax`;
      await authClient.organization.setActive({ organizationId: workspace.id });
      queryClient.clear();
      router.push("/chat");
      router.refresh();
    },
    onError: async (error) => {
      toast.error("Workspace not created", {
        description: await errorMessage(error),
      });
    },
  });
}

export function useUpdateWorkspace(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name?: string; logo?: string | null }) =>
      updateWorkspace(workspaceId, input),
    onSuccess: () => {
      toast.success("Workspace updated.");
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all() });
      // The name is rendered by the server-side shell, not by a query.
      router.refresh();
    },
    onError: async (error) => {
      toast.error("Update refused", { description: await errorMessage(error) });
    },
  });
}

export function useInviteMember(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { email: string; role: AssignableRole }) =>
      inviteMember(workspaceId, input),
    onSuccess: (_result, input) => {
      toast.success("Invitation sent", { description: input.email });
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.invitations(workspaceId),
      });
      // An invitation occupies a seat, so the billing summary moves with it.
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.overview(workspaceId),
      });
    },
    onError: async (error) => {
      toast.error("Invitation refused", {
        description: await errorMessage(error),
      });
    },
  });
}

export function useCancelInvitation(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) =>
      cancelInvitation(workspaceId, invitationId),
    onSuccess: () => {
      toast.success("Invitation cancelled.");
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all() });
    },
    onError: async (error) => {
      toast.error("Could not cancel", {
        description: await errorMessage(error),
      });
    },
  });
}

export function useUpdateMemberRole(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: AssignableRole;
    }) => updateMemberRole(workspaceId, memberId, role),
    onSuccess: () => {
      toast.success("Role updated.");
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(workspaceId),
      });
    },
    onError: async (error) => {
      toast.error("Role change refused", {
        description: await errorMessage(error),
      });
    },
  });
}

export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => removeMember(workspaceId, memberId),
    onSuccess: () => {
      toast.success("Member removed.");
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all() });
    },
    onError: async (error) => {
      toast.error("Could not remove", {
        description: await errorMessage(error),
      });
    },
  });
}
