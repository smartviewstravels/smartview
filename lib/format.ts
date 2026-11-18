// Formatting helpers: PKR with commas, dates as DD-MM-YYYY.
// All dates in the app are YYYY-MM-DD strings; "today" is Pakistan time (Asia/Karachi).

/** 100000 -> "PKR 100,000". Amounts are whole rupees in this system. */
export function formatPKR(amount: number): string {
  const n = Math.round(amount);
  return "PKR " + n.toLocaleString("en-PK");
}

/** Plain number with commas, no currency label. */
export function formatNumber(amount: number): string {
  return Math.round(amount).toLocaleString("en-PK");
}

/** "2026-11-19" -> "19-11-2026". Returns "—" for null/empty. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parts = iso.slice(0, 10).split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

/** Today's date in Pakistan time, as YYYY-MM-DD. */
export function todayPKT(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA gives YYYY-MM-DD
}

/** YYYY-MM-DD plus n days. */
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). Negative when b is before a. */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T12:00:00").getTime();
  const db = new Date(b + "T12:00:00").getTime();
  return Math.round((db - da) / 86400000);
}

/** "2026-11-19" -> "19 Nov 2026" (short, human-readable). */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
