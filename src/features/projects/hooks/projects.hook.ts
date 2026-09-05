"use client";

import { useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api-error";
import { projectsKeys, projectsOptions } from "../options/projects.options";
import {
  archiveProject,
  createProject,
  deleteProject,
  restoreProject,
  updateProject,
} from "../service/projects.service";

export function useProjectsSuspense(workspaceId: string, includeArchived = false) {
  return useSuspenseQuery(projectsOptions.list(workspaceId, includeArchived));
}

/** Non-suspending, for the project picker in the chat composer. */
export function useProjects(workspaceId: string) {
  return useQuery(projectsOptions.list(workspaceId, false));
}

export function useProjectSuspense(workspaceId: string, projectId: string) {
  return useSuspenseQuery(projectsOptions.detail(workspaceId, projectId));
}

export function useCreateProject(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      createProject(workspaceId, input),
    onSuccess: (project) => {
      toast.success("Project created.");
      queryClient.invalidateQueries({ queryKey: projectsKeys.all() });
      router.push(`/projects/${project.id}`);
    },
    onError: async (error) => {
      toast.error("Not created", { description: await errorMessage(error) });
    },
  });
}

export function useUpdateProject(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      name?: string;
      description?: string | null;
      chat?: { provider: string; model: string } | null;
    }) => updateProject(workspaceId, projectId, input),
    onSuccess: (project) => {
      toast.success("Project updated.");
      queryClient.setQueryData(
        projectsKeys.detail(workspaceId, projectId),
        project,
      );
      queryClient.invalidateQueries({ queryKey: projectsKeys.all() });
    },
    onError: async (error) => {
      toast.error("Update refused", { description: await errorMessage(error) });
    },
  });
}

export function useArchiveProject(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, archived }: { projectId: string; archived: boolean }) =>
      archived
        ? restoreProject(workspaceId, projectId)
        : archiveProject(workspaceId, projectId),
    onSuccess: (_result, { archived }) => {
      toast.success(archived ? "Project restored." : "Project archived.");
      queryClient.invalidateQueries({ queryKey: projectsKeys.all() });
    },
    onError: async (error) => {
      toast.error("Action refused", { description: await errorMessage(error) });
    },
  });
}

export function useDeleteProject(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(workspaceId, projectId),
    onSuccess: () => {
      toast.success("Project deleted.");
      queryClient.invalidateQueries({ queryKey: projectsKeys.all() });
      router.push("/projects");
    },
    onError: async (error) => {
      toast.error("Could not delete", {
        description: await errorMessage(error),
      });
    },
  });
}
