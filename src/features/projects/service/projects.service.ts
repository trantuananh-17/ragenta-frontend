import { z } from "zod";

import { api } from "@/lib/ky";

/**
 * A project groups work inside a workspace and may pin its own chat model. Null
 * `chatProvider`/`chatModel` means "inherit the workspace default", which is the
 * normal case — storing a copy of the default would freeze the project on it.
 *
 * Archived projects stay readable and keep their usage history; deleting is a
 * separate, owner-only action.
 */
export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  chatProvider: z.string().nullable(),
  chatModel: z.string().nullable(),
  createdBy: z.string().nullable(),
  archivedAt: z.coerce.string().nullable(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
});

export type Project = z.infer<typeof projectSchema>;

/** Every single-project route answers `{ project }`; the list answers `{ projects }`. */
const projectEnvelope = z.object({ project: projectSchema });

export async function getProjects(
  workspaceId: string,
  includeArchived: boolean,
): Promise<Project[]> {
  const response = await api.get(`workspaces/${workspaceId}/projects`, {
    searchParams: { includeArchived: includeArchived ? "true" : "false" },
  });
  const body = await response.json();
  return z.object({ projects: z.array(projectSchema) }).parse(body).projects;
}

export async function getProject(
  workspaceId: string,
  projectId: string,
): Promise<Project> {
  const response = await api.get(
    `workspaces/${workspaceId}/projects/${projectId}`,
  );
  return projectEnvelope.parse(await response.json()).project;
}

export async function createProject(
  workspaceId: string,
  input: { name: string; description?: string },
): Promise<Project> {
  const response = await api.post(`workspaces/${workspaceId}/projects`, {
    json: input,
  });
  return projectEnvelope.parse(await response.json()).project;
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  input: {
    name?: string;
    description?: string | null;
    /** Null clears the override and goes back to the workspace default. */
    chat?: { provider: string; model: string } | null;
  },
): Promise<Project> {
  const response = await api.patch(
    `workspaces/${workspaceId}/projects/${projectId}`,
    { json: input },
  );
  return projectEnvelope.parse(await response.json()).project;
}

export async function archiveProject(
  workspaceId: string,
  projectId: string,
): Promise<void> {
  await api.post(`workspaces/${workspaceId}/projects/${projectId}/archive`);
}

export async function restoreProject(
  workspaceId: string,
  projectId: string,
): Promise<void> {
  await api.post(`workspaces/${workspaceId}/projects/${projectId}/restore`);
}

export async function deleteProject(
  workspaceId: string,
  projectId: string,
): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/projects/${projectId}`);
}
