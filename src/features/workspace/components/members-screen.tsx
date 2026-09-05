"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Mail, Trash2, UserPlus } from "lucide-react";
import { z } from "zod";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailSection } from "@/components/detail-shell";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { canAdminister } from "@/lib/workspace";
import {
  useCancelInvitation,
  useInvitationsSuspense,
  useInviteMember,
  useMembersSuspense,
  useRemoveMember,
  useUpdateMemberRole,
  useWorkspaceOverviewSuspense,
} from "../hooks/workspace.hook";
import {
  ASSIGNABLE_ROLES,
  type AssignableRole,
} from "../service/workspace.service";
import { useWorkspace } from "./workspace-provider";

const inviteSchema = z.object({
  email: z.email("Enter a valid email address."),
  role: z.enum(ASSIGNABLE_ROLES),
});

/** What each role can actually do, in the words the backend enforces them by. */
const ROLE_HINT: Record<string, string> = {
  owner: "Everything, including deleting projects.",
  admin: "Members, billing and workspace settings.",
  member: "Upload, chat and spend credits.",
  viewer: "Read only — cannot spend credits.",
};

export function MembersScreen() {
  const { workspace } = useWorkspace();
  const overview = useWorkspaceOverviewSuspense(workspace.id);
  const members = useMembersSuspense(workspace.id);
  const invitations = useInvitationsSuspense(workspace.id);

  const invite = useInviteMember(workspace.id);
  const updateRole = useUpdateMemberRole(workspace.id);
  const removeMember = useRemoveMember(workspace.id);
  const cancelInvitation = useCancelInvitation(workspace.id);

  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const mayAdminister = canAdminister(overview.data.role);
  const seats = overview.data.billing.seats;
  const seatsFull = seats.limit !== null && seats.used >= seats.limit;

  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "member" },
  });

  // `useWatch` rather than `watch()`, which returns a new function each render
  // and would opt this component out of the React Compiler.
  const invitedRole = useWatch({ control, name: "role" });

  const pendingInvitations = invitations.data.filter(
    (invitation) => invitation.status === "pending",
  );

  return (
    <div className="space-y-6">
      <DetailSection
        title="Invite someone"
        description={
          seats.limit === null
            ? `${seats.used} seats in use.`
            : `${seats.used} of ${seats.limit} seats in use — a pending invitation holds a seat.`
        }
      >
        {seatsFull && (
          <p className="mb-4 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            Every seat on the {overview.data.billing.plan} plan is taken. Upgrade
            the plan, or remove a member, before inviting anyone else.
          </p>
        )}

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={handleSubmit((values) =>
            invite.mutate(values, { onSuccess: () => reset() }),
          )}
        >
          <div className="grid min-w-[240px] flex-1 gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              disabled={!mayAdminister}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={invitedRole}
              disabled={!mayAdminister}
              onValueChange={(value) =>
                setValue("role", value as AssignableRole)
              }
            >
              <SelectTrigger id="invite-role" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={!mayAdminister || invite.isPending}>
            <UserPlus className="size-4" />
            {invite.isPending ? "Sending..." : "Invite"}
          </Button>
        </form>

        <p className="mt-2 text-xs text-muted-foreground">
          {ROLE_HINT[invitedRole]}
        </p>
      </DetailSection>

      <DetailSection title="Members">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.data.items.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      {member.image && <AvatarImage src={member.image} alt="" />}
                      <AvatarFallback className="text-xs">
                        {(member.name || member.email).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.name || member.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {member.role === "owner" ? (
                    <StatusBadge tone="info">owner</StatusBadge>
                  ) : (
                    <Select
                      value={member.role}
                      disabled={!mayAdminister || updateRole.isPending}
                      onValueChange={(role) =>
                        updateRole.mutate({
                          memberId: member.id,
                          role: role as AssignableRole,
                        })
                      }
                    >
                      <SelectTrigger size="sm" className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(member.createdAt)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${member.email}`}
                    disabled={!mayAdminister || member.role === "owner"}
                    onClick={() => setPendingRemoval(member.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DetailSection>

      {pendingInvitations.length > 0 && (
        <DetailSection
          title="Pending invitations"
          description="Each one holds a seat until it is accepted or cancelled."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingInvitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="flex items-center gap-2 text-sm">
                    <Mail className="size-4 text-muted-foreground" />
                    {invitation.email}
                  </TableCell>
                  <TableCell className="text-sm">{invitation.role}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {invitation.expiresAt
                      ? formatDate(invitation.expiresAt)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Cancel the invitation to ${invitation.email}`}
                      disabled={!mayAdminister || cancelInvitation.isPending}
                      onClick={() => cancelInvitation.mutate(invitation.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DetailSection>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
        title="Remove this member?"
        description="They lose access to the workspace immediately. Their conversations and the usage they ran stay — the workspace paid for them."
        confirmLabel="Remove"
        destructive
        pending={removeMember.isPending}
        onConfirm={() => {
          if (pendingRemoval) removeMember.mutate(pendingRemoval);
          setPendingRemoval(null);
        }}
      />
    </div>
  );
}

export function MembersLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function MembersError() {
  return (
    <p className="text-sm text-muted-foreground">
      Members could not be loaded. Only owners and admins may read the invitation
      list.
    </p>
  );
}
