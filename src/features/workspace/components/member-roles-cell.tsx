"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StatusBadge } from "@/components/status-badge";
import {
  useMemberRoles,
  useSetMemberRoles,
  useWorkspaceRoles,
} from "../hooks/workspace.hook";
import { primarySystemRoleId } from "../lib/system-role";

/**
 * The roles a member holds beyond their built-in one.
 *
 * Two controls rather than one because the model has two halves (ADR-053): the
 * built-in role is single-choice and belongs to the picker beside this, and the
 * workspace's own roles are additive. A single control mixing them would have to
 * explain why two of the first four cannot both be chosen.
 *
 * Built-in roles are not listed here at all — offering `admin` in a list that
 * adds rather than replaces would read as a second way to promote somebody, and
 * it is not one.
 */
export function MemberRolesCell({
  workspaceId,
  memberId,
  builtInRole,
  disabled,
}: {
  workspaceId: string;
  memberId: string;
  builtInRole: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  const roles = useWorkspaceRoles(workspaceId);
  // Only fetched once the popover is opened: a workspace with fifty members
  // should not make fifty requests to render a table nobody has clicked.
  const held = useMemberRoles(workspaceId, open ? memberId : null);
  const save = useSetMemberRoles(workspaceId);

  const custom = (roles.data ?? []).filter((role) => !role.isSystem);
  const heldCustom = (held.data ?? []).filter((role) => !role.isSystem);

  if (custom.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {roles.isPending ? "" : "—"}
      </span>
    );
  }

  function toggle(roleId: string, checked: boolean) {
    const next = new Set(heldCustom.map((role) => role.id));
    if (checked) next.add(roleId);
    else next.delete(roleId);

    // The built-in role travels with every write: the backend refuses a set that
    // does not carry the one `member.role` already names.
    save.mutate({
      memberId,
      roleIds: [primarySystemRoleId(builtInRole), ...next],
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 justify-between gap-2 font-normal"
        >
          {heldCustom.length > 0 ? (
            <span className="flex flex-wrap items-center gap-1">
              {heldCustom.slice(0, 2).map((role) => (
                <StatusBadge key={role.id} tone="neutral">
                  {role.name}
                </StatusBadge>
              ))}
              {heldCustom.length > 2 && <span>+{heldCustom.length - 2}</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">Add</span>
          )}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-1">
        {held.isPending ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Loading…</p>
        ) : (
          <ul className="max-h-64 overflow-auto">
            {custom.map((role) => {
              const checked = heldCustom.some((entry) => entry.id === role.id);
              return (
                <li key={role.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 hover:bg-muted/60">
                    <Checkbox
                      className="mt-0.5"
                      checked={checked}
                      disabled={save.isPending}
                      onCheckedChange={(value) => toggle(role.id, value === true)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm">{role.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {role.description ||
                          `${role.permissions.length} permissions`}
                      </span>
                    </span>
                    {checked && <Check className="mt-1 size-3.5 shrink-0 opacity-60" />}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
