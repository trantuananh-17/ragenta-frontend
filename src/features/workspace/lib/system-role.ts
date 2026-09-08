/**
 * The id a built-in workspace role is stored under.
 *
 * Mirrors `systemRoleId("workspace", key)` in the backend. It is composed rather
 * than looked up because every write of a member's roles has to carry their
 * built-in one — the backend refuses a set without it (ADR-053) — and fetching
 * the role list to find an id that is a pure function of the name would make the
 * common case wait on a request it does not need.
 *
 * A role string Ragenta does not ship resolves to `member`, matching the
 * backend's own fallback: never something higher.
 */
const BUILT_IN_ROLES = ["owner", "admin", "member", "viewer"] as const;

export function primarySystemRoleId(role: string): string {
  const primary = role.split(",")[0]?.trim().toLowerCase() ?? "";
  const key = (BUILT_IN_ROLES as readonly string[]).includes(primary)
    ? primary
    : "member";
  return `system:workspace:${key}`;
}
