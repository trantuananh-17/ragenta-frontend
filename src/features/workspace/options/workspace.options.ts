import { queryOptions } from "@tanstack/react-query";

import {
  getInvitations,
  getMemberRoles,
  getMembers,
  getMyWorkspaces,
  getWorkspaceOverview,
  getWorkspaceRoles,
} from "../service/workspace.service";

export const workspaceKeys = {
  all: () => ["workspace"] as const,
  mine: () => [...workspaceKeys.all(), "mine"] as const,
  overview: (workspaceId: string) =>
    [...workspaceKeys.all(), "overview", workspaceId] as const,
  members: (workspaceId: string) =>
    [...workspaceKeys.all(), "members", workspaceId] as const,
  invitations: (workspaceId: string) =>
    [...workspaceKeys.all(), "invitations", workspaceId] as const,
  roles: (workspaceId: string) =>
    [...workspaceKeys.all(), "roles", workspaceId] as const,
  memberRoles: (workspaceId: string, memberId: string) =>
    [...workspaceKeys.all(), "member-roles", workspaceId, memberId] as const,
};

export const workspaceOptions = {
  mine: () =>
    queryOptions({ queryKey: workspaceKeys.mine(), queryFn: getMyWorkspaces }),
  overview: (workspaceId: string) =>
    queryOptions({
      queryKey: workspaceKeys.overview(workspaceId),
      queryFn: () => getWorkspaceOverview(workspaceId),
    }),
  members: (workspaceId: string) =>
    queryOptions({
      queryKey: workspaceKeys.members(workspaceId),
      queryFn: () => getMembers(workspaceId),
    }),
  invitations: (workspaceId: string) =>
    queryOptions({
      queryKey: workspaceKeys.invitations(workspaceId),
      queryFn: () => getInvitations(workspaceId),
    }),
  roles: (workspaceId: string) =>
    queryOptions({
      queryKey: workspaceKeys.roles(workspaceId),
      queryFn: () => getWorkspaceRoles(workspaceId),
    }),
  memberRoles: (workspaceId: string, memberId: string) =>
    queryOptions({
      queryKey: workspaceKeys.memberRoles(workspaceId, memberId),
      queryFn: () => getMemberRoles(workspaceId, memberId),
    }),
};
