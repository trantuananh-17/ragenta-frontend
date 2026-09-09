/**
 * Display helpers shared by every screen. Credits are integers in the hundreds
 * of thousands, so they are grouped rather than shortened — an admin adjusting a
 * balance needs the exact number, not "1.2M".
 */
const numberFormat = new Intl.NumberFormat("en-US");

export function formatCredits(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return numberFormat.format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return numberFormat.format(value);
}

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** Absolute, UTC, unambiguous — an audit trail read across timezones. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

/** File sizes, in the units an uploader thinks in. */
export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

/** "3 minutes ago" — for a list where the exact instant does not matter. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

/**
 * A message's own time, the way a transcript shows it: the clock alone for
 * today, the date as well for anything older.
 *
 * Empty rather than the "—" the helpers above return, because the caller
 * renders nothing at all when there is no time. A missing or unparseable
 * `createdAt` means the age of that message is unknown, and a placeholder — let
 * alone today's clock — would read as authoritative with nothing to prompt a
 * second look. No time is the honest answer.
 */
export function formatMessageTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return date.toLocaleString(undefined, {
    ...(isToday ? {} : { month: "short", day: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}
