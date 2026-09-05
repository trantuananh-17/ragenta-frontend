import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { projectsOptions } from "../options/projects.options";

export async function prefetchProjects(
  workspaceId: string,
  includeArchived = false,
) {
  await getQueryClient().prefetchQuery(
    projectsOptions.list(workspaceId, includeArchived),
  );
}

export async function prefetchProject(workspaceId: string, projectId: string) {
  await getQueryClient().prefetchQuery(
    projectsOptions.detail(workspaceId, projectId),
  );
}
