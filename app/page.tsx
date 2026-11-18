import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { loadAll } from "@/components/data";
import { computeTotals, getReminders } from "@/lib/calc";
import { formatDate, formatPKR } from "@/lib/format";
import { FINANCE_TYPE_LABELS } from "@/lib/types";


export default async function DashboardPage() {
  await requireAdmin();
  const { records, payments, expenses } = await loadAll();
  const totals = computeTotals(records, payments, expenses, "all");
  const reminders = getReminders(records);

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="stat-grid">
        <div className="card">
          <div className="stat-label">Total Received (All Time)</div>
          <div className="stat-value">{formatPKR(totals.totalReceived)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Total Pending</div>
          <div className="stat-value">{formatPKR(totals.totalPending)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Total Expenses (All Time)</div>
          <div className="stat-value">{formatPKR(totals.totalExpenses)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Profit (All Time)</div>
          <div className="stat-value">{formatPKR(totals.profit)}</div>
          <div className="note">Received minus expenses. Pending is not counted.</div>
        </div>
      </div>

      <section className="section">
        <h2>Payment reminders</h2>
        {reminders.length === 0 ? (
          <p>No reminders.</p>
        ) : (
          <div>
            {reminders.map((item) => (
              <div className="list-row" key={item.record.id}>
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
                {item.overdue
                  ? `Overdue by ${-item.dueInDays} day${-item.dueInDays === 1 ? "" : "s"}`
                  : item.dueInDays === 0
                    ? "Due today"
                    : `Due in ${item.dueInDays} day${item.dueInDays === 1 ? "" : "s"}`}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
