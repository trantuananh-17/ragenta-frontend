import { queryOptions } from "@tanstack/react-query";

import { getProject, getProjects } from "../service/projects.service";

export const projectsKeys = {
  all: () => ["projects"] as const,
  list: (workspaceId: string, includeArchived: boolean) =>
    [...projectsKeys.all(), "list", workspaceId, includeArchived] as const,
  detail: (workspaceId: string, projectId: string) =>
    [...projectsKeys.all(), "detail", workspaceId, projectId] as const,
};

export const projectsOptions = {
  list: (workspaceId: string, includeArchived = false) =>
    queryOptions({
      queryKey: projectsKeys.list(workspaceId, includeArchived),
      queryFn: () => getProjects(workspaceId, includeArchived),
    }),
  detail: (workspaceId: string, projectId: string) =>
    queryOptions({
      queryKey: projectsKeys.detail(workspaceId, projectId),
      queryFn: () => getProject(workspaceId, projectId),
    }),
};
