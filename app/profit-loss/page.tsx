import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { loadAll } from "@/components/data";
import { computeTotals, type Period } from "@/lib/calc";
import { formatPKR } from "@/lib/format";
import { FINANCE_TYPES, FINANCE_TYPE_LABELS } from "@/lib/types";


const PERIODS: Period[] = ["today", "month", "all"];
const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  month: "This Month",
  all: "All Time",
};

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const { period: rawPeriod } = await searchParams;
  const period: Period =
    rawPeriod === "today" || rawPeriod === "month" || rawPeriod === "all"
      ? rawPeriod
      : "all";

  const { records, payments, expenses } = await loadAll();
  const totals = computeTotals(records, payments, expenses, period);

  return (
    <div>
      <h1>Profit &amp; Loss</h1>

      <div className="toolbar" role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/profit-loss?period=${p}`}
            className={p === period ? "btn btn-primary" : "btn"}
            aria-current={p === period ? "page" : undefined}
          >
            {PERIOD_LABELS[p]}
          </Link>
        ))}
      </div>

      <p className="note" style={{ marginBottom: 16 }}>
        Showing figures for: {PERIOD_LABELS[period]}.
      </p>

      <div className="stat-grid">
        <div className="card">
          <div className="stat-label">Total Received</div>
          <div className="stat-value">{formatPKR(totals.totalReceived)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Total Pending</div>
          <div className="stat-value">{formatPKR(totals.totalPending)}</div>
          <div className="note">
            Pending is not counted as profit until it is received.
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value">{formatPKR(totals.totalExpenses)}</div>
        </div>
        <div className="card">
          <div className="stat-label">
            {totals.profit >= 0 ? "Profit" : "Loss"}
          </div>
          <div className="stat-value">{formatPKR(totals.profit)}</div>
          <div className="note">Received minus expenses.</div>
        </div>
      </div>

      <section className="section">
        <h2>Breakdown by module</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Module</th>
                <th className="num">Received</th>
                <th className="num">Pending</th>
                <th className="num">Records</th>
              </tr>
            </thead>
            <tbody>
              {FINANCE_TYPES.map((t) => (
                <tr key={t}>
                  <td>{FINANCE_TYPE_LABELS[t]}</td>
                  <td className="num">{formatPKR(totals.byType[t].received)}</td>
                  <td className="num">{formatPKR(totals.byType[t].pending)}</td>
                  <td className="num">{totals.byType[t].count}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Total</td>
                <td className="num">{formatPKR(totals.totalReceived)}</td>
                <td className="num">{formatPKR(totals.totalPending)}</td>
                <td className="num">{records.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
