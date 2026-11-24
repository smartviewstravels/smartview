import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { loadAll } from "@/components/data";
import { getReminders } from "@/lib/calc";
import { formatDate, formatPKR } from "@/lib/format";
import { FINANCE_TYPE_LABELS, type ReminderItem } from "@/lib/types";

/**
 * Notifications: payment reminders, added automatically. A record shows
 * up here when it still has pending money and its next payment date is
 * overdue, due today, or due within 7 days — the same rule as the
 * dashboard reminders. Nothing is entered by hand, and a notification
 * disappears on its own once the record is paid.
 */
export default async function NotificationsPage() {
  await requireAdmin();
  const { records } = await loadAll();
  const reminders = getReminders(records);
  const overdue = reminders.filter((r) => r.overdue);
  const dueToday = reminders.filter((r) => !r.overdue && r.dueInDays === 0);
  const dueSoon = reminders.filter((r) => !r.overdue && r.dueInDays > 0);

  return (
    <div>
      <h1>Notifications</h1>
      <p className="note" style={{ marginBottom: 16 }}>
        {reminders.length === 0
          ? "No payment reminders right now."
          : `${reminders.length} reminder${reminders.length === 1 ? "" : "s"} — ${overdue.length} overdue, ${dueToday.length} due today, ${dueSoon.length} due soon.`}{" "}
        Reminders appear automatically when a payment comes within 7 days of
        its due date, and clear themselves once the record is paid.
      </p>

      {reminders.length === 0 ? (
        <p>Nothing due. You&apos;re all caught up.</p>
      ) : (
        <>
          <ReminderSection title="Overdue" items={overdue} />
          <ReminderSection title="Due today" items={dueToday} />
          <ReminderSection title="Due soon (within 7 days)" items={dueSoon} />
        </>
      )}
    </div>
  );
}

function ReminderSection({
  title,
  items,
}: {
  title: string;
  items: ReminderItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="section">
      <h2>
        {title} ({items.length})
      </h2>
      <div>
        {items.map((item) => (
          <div
            className={
              item.overdue
                ? "list-row overdue"
                : item.dueInDays <= 7
                  ? "list-row due-soon"
                  : "list-row"
            }
            key={item.record.id}
          >
            <Link href={`/records/${item.record.id}`}>
              {item.customer?.name ?? "Unknown customer"}
            </Link>
            {" — "}
            {FINANCE_TYPE_LABELS[item.record.type]}
            {item.record.type === "tour" && item.record.tour_name
              ? ` (${item.record.tour_name})`
              : ""}
            <br />
            Pending: {formatPKR(item.pending)} — Due date:{" "}
            {formatDate(item.next_payment_date)} —{" "}
            {item.overdue ? (
              <span className="badge badge-overdue">
                Overdue by {-item.dueInDays} day
                {-item.dueInDays === 1 ? "" : "s"}
              </span>
            ) : item.dueInDays === 0 ? (
              <span className="badge badge-due">Due today</span>
            ) : (
              <span className="badge badge-due">
                Due in {item.dueInDays} day
                {item.dueInDays === 1 ? "" : "s"}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
