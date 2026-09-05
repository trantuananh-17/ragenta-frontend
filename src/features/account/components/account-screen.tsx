"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DetailShell, DetailSection } from "@/components/detail-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { useChangePassword, useUpdateProfile } from "../hooks/account.hook";
import type { SessionUser } from "@/lib/auth";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(8, "At least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  });

export function AccountScreen({ user }: { user: SessionUser }) {
  const { workspaces } = useWorkspace();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const [name, setName] = useState(user.name ?? "");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  return (
    <DetailShell>
      <PageHeader
        title="Account"
        description="You, across every workspace you belong to."
        badges={
          user.emailVerified ? (
            <StatusBadge tone="success">email verified</StatusBadge>
          ) : (
            <StatusBadge tone="warning">email not verified</StatusBadge>
          )
        }
      />

      <DetailSection
        title="Profile"
        actions={
          <Button
            size="sm"
            disabled={updateProfile.isPending || name.trim().length < 2}
            onClick={() => updateProfile.mutate({ name: name.trim() })}
          >
            {updateProfile.isPending ? "Saving..." : "Save"}
          </Button>
        }
      >
        <div className="grid gap-4 sm:max-w-md">
          <div className="grid gap-2">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="account-email">Email</Label>
            <Input id="account-email" value={user.email} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              Changing the address on an account is not self-serve — it is the
              identity every invitation and every audit entry is written against.
            </p>
          </div>
        </div>
      </DetailSection>

      <DetailSection
        title="Password"
        description="Changing it signs out every other browser."
      >
        <form
          className="grid gap-4 sm:max-w-md"
          onSubmit={handleSubmit((values) =>
            changePassword.mutate(
              {
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
              },
              { onSuccess: () => reset() },
            ),
          )}
        >
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              {...register("currentPassword")}
            />
            {errors.currentPassword && (
              <p className="text-sm text-destructive">
                {errors.currentPassword.message}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register("newPassword")}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive">
                {errors.newPassword.message}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Repeat it</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending ? "Changing..." : "Change password"}
          </Button>
        </form>
      </DetailSection>

      <DetailSection
        title="Workspaces"
        description="Where you are a member, and as what."
      >
        <ul className="divide-y">
          {workspaces.map((workspace) => (
            <li
              key={workspace.id}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="truncate text-sm">{workspace.name}</span>
              <StatusBadge tone="neutral">{workspace.role}</StatusBadge>
            </li>
          ))}
        </ul>
      </DetailSection>
    </DetailShell>
  );
}
