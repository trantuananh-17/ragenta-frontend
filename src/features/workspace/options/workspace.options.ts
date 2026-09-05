import { queryOptions } from "@tanstack/react-query";

import {
  getInvitations,
  getMembers,
  getMyWorkspaces,
  getWorkspaceOverview,
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
};
