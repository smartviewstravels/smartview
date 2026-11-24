import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { loadAll } from "@/components/data";
import { formatDate, formatPKR, todayPKT } from "@/lib/format";
import { FINANCE_TYPE_LABELS } from "@/lib/types";
import StatementActions, {
  type StatementData,
} from "@/components/StatementActions";

/**
 * Branded account statement for one customer: every record with its
 * total, paid, pending and due date, plus totals. The same data feeds
 * the Download PDF / Share buttons (StatementActions).
 */
export default async function StatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { customers, records } = await loadAll();
  const customer = customers.find((c) => c.id === id);
  if (!customer) notFound();

  const myRecords = records.filter((r) => r.customer_id === id);
  const rows = myRecords.map((r) => ({
    service:
      FINANCE_TYPE_LABELS[r.type] +
      (r.type === "tour" && r.tour_name ? ` (${r.tour_name})` : ""),
    total: r.total_amount,
    paid: r.received,
    pending: r.pending,
    dueDate: r.next_payment_date ? formatDate(r.next_payment_date) : "—",
    status: r.pending <= 0 ? "Paid" : "Open",
  }));
  const totalAmount = rows.reduce((s, r) => s + r.total, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalPending = rows.reduce((s, r) => s + r.pending, 0);

  const data: StatementData = {
    customerName: customer.name,
    customerPhone: customer.phone,
    customerCnic: customer.cnic_passport,
    statementDate: formatDate(todayPKT()),
    rows,
    totalAmount,
    totalPaid,
    totalPending,
  };

  return (
    <div>
      <p>
        <Link href="/customers">&larr; Back to customers</Link>
      </p>
      <h1>Account statement</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image
            src="/logo.png"
            alt="Smart View Travel logo"
            width={56}
            height={56}
            style={{ borderRadius: "50%" }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              Smart View Travel
            </div>
            <div className="note">Your Journey Our Passion</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div>
            <strong>Billed to:</strong> {customer.name}
          </div>
          {customer.phone && (
            <div className="note">Phone: {customer.phone}</div>
          )}
          {customer.cnic_passport && (
            <div className="note">CNIC / Passport: {customer.cnic_passport}</div>
          )}
          <div className="note">Statement date: {data.statementDate}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p>No records for this customer yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Pending</th>
                <th>Due date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.service}</td>
                  <td>{formatPKR(r.total)}</td>
                  <td>{formatPKR(r.paid)}</td>
                  <td>{formatPKR(r.pending)}</td>
                  <td>{r.dueDate}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <strong>Total ({rows.length} record{rows.length === 1 ? "" : "s"})</strong>
                </td>
                <td>
                  <strong>{formatPKR(totalAmount)}</strong>
                </td>
                <td>
                  <strong>{formatPKR(totalPaid)}</strong>
                </td>
                <td>
                  <strong>{formatPKR(totalPending)}</strong>
                </td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <section className="section">
        <StatementActions data={data} />
      </section>
    </div>
  );
}
