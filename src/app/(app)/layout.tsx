import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { WorkspaceProvider } from "@/features/workspace/components/workspace-provider";
import { requireAuth } from "@/lib/auth";
import { listWorkspaces, requireWorkspace } from "@/lib/workspace";

/**
 * The signed-in shell.
 *
 * Both gates run here rather than on each page: a session, then a workspace. The
 * workspace is resolved once, on the server, and handed to the tree through
 * context — every screen below is scoped to it, and re-deriving it per component
 * is how two halves of one page end up looking at different tenants.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  const [workspace, workspaces] = await Promise.all([
    requireWorkspace(),
    listWorkspaces(),
  ]);

  return (
    <WorkspaceProvider workspace={workspace} workspaces={workspaces}>
      <SidebarProvider>
        <AppSidebar user={session.user} />
        <SidebarInset className="flex h-svh flex-col overflow-hidden bg-accent/20">
          {/* Mounted beside the sidebar, not inside it: the hotkey has to work
              with the sidebar collapsed. */}
          <CommandPalette />
          <AppHeader />
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </WorkspaceProvider>
  );
}
