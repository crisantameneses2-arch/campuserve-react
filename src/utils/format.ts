/* Shared formatting + status helpers (student, staff and admin sides). */

export type TransactionKind = "DOCUMENT" | "ITEM";

/** "Pending" | "Ready for Pickup" | "READY_FOR_PICKUP"  ->  "READY_FOR_PICKUP" */
export function normalizeStatus(status?: string | null): string {
  return String(status ?? "PENDING")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  READY_FOR_PICKUP: "Ready to Pick Up",
  COMPLETED: "Completed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  RESCHEDULED: "Rescheduled",
};

export function statusLabel(status?: string | null): string {
  const key = normalizeStatus(status);
  return STATUS_LABELS[key] ?? key.replace(/_/g, " ");
}

/** Firestore Timestamp | Date | ISO string | millis  ->  Date | null */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  const v = value as { toDate?: () => Date; seconds?: number };
  if (typeof v.toDate === "function") return v.toDate();
  if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
  const d = new Date(value as string | number | Date);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: unknown): string {
  const d = toDate(value);
  return d
    ? d.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";
}

export function formatDateTime(value: unknown): string {
  const d = toDate(value);
  return d
    ? d.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
}

export function formatTimeShort(value: unknown): string {
  const d = toDate(value);
  return d
    ? d.toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
}

/** "2026-10-05" -> "Mon, Oct 5, 2026" (date-only strings are parsed as local time). */
export function formatClaimDate(dateString?: string | null): string {
  if (!dateString) return "—";

  const d = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(d.getTime())) return dateString;

  return d.toLocaleDateString("en-PH", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** "14:00" -> "2:00 PM" ; anything else is returned untouched ("10:00AM - 12:00PM"). */
export function formatClaimTime(time?: string | null): string {
  if (!time) return "—";

  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());

  if (!match) return time;

  const hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;

  return `${display}:${minute} ${suffix}`;
}

export function timeAgo(value: unknown): string {
  const d = toDate(value);

  if (!d) return "just now";

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - d.getTime()) / 1000)
  );

  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);

  if (days === 1) return "Yesterday";

  if (days < 7) return `${days} days ago`;

  return formatDate(d);
}

export type DayGroup =
  | "Today"
  | "Yesterday"
  | "This Week"
  | "Earlier";

export const DAY_GROUP_ORDER: DayGroup[] = [
  "Today",
  "Yesterday",
  "This Week",
  "Earlier",
];

export function dayGroup(value: unknown): DayGroup {
  const d = toDate(value) ?? new Date();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfDay = new Date(d);
  startOfDay.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDay.getTime()) /
      86_400_000
  );

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";

  return "Earlier";
}

export function groupByDay<T>(
  items: T[],
  getDate: (item: T) => unknown
): { group: DayGroup; items: T[] }[] {
  const buckets = new Map<DayGroup, T[]>();

  for (const item of items) {
    const key = dayGroup(getDate(item));

    buckets.set(key, [
      ...(buckets.get(key) ?? []),
      item,
    ]);
  }

  return DAY_GROUP_ORDER
    .filter((g) => buckets.has(g))
    .map((g) => ({
      group: g,
      items: buckets.get(g)!,
    }));
}

export function peso(value?: number | null): string {
  return `₱${Number(value ?? 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Newest first, tolerant of pending server timestamps (null => now). */
export function millis(value: unknown): number {
  const d = toDate(value);

  return d ? d.getTime() : Date.now();
}