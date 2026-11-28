import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { loadAll } from "@/components/data";
import { formatDate, formatPKR, todayPKT } from "@/lib/format";
import { buildLedger } from "@/lib/ledger";
import StatementActions, {
  type StatementData,
} from "@/components/StatementActions";

/**
 * Branded account ledger for one customer: the Previous Balance row,
 * then every charge and active payment in date order with a running
 * balance (lib/ledger.ts — the same figures as the dashboard totals).
 * The same data feeds the Download PDF / Share buttons
 * (StatementActions), so preview and PDF can never disagree.
 */
export default async function StatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { customers, records, payments } = await loadAll();
  const customer = customers.find((c) => c.id === id);
  if (!customer) notFound();

  const myRecords = records.filter((r) => r.customer_id === id);
  const ledger: StatementData = buildLedger(
    customer,
    myRecords,
    payments,
    todayPKT(),
  );
  const hasEntries = ledger.rows.length > 1;

  return (
    <div>
      <p>
        <Link href="/customers">&larr; Back to customers</Link>
      </p>
      <h1>Account ledger</h1>

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
        {(customer.phone || customer.cnic_passport) && (
          <div style={{ marginTop: 12 }}>
            {customer.phone && (
              <div className="note">Phone: {customer.phone}</div>
            )}
            {customer.cnic_passport && (
              <div className="note">
                CNIC / Passport: {customer.cnic_passport}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          background: "#1e234d",
          color: "#ffffff",
          fontWeight: 700,
          fontSize: 15,
          padding: "10px 12px",
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        Account Ledger
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "10px 24px",
            margin: 0,
          }}
        >
          <div>
            <dt className="note">Account Code</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>
              {ledger.accountCode}
            </dd>
          </div>
          <div>
            <dt className="note">Account Title</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>
              {ledger.accountTitle}
            </dd>
          </div>
          <div>
            <dt className="note">Balance</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>
              {formatPKR(ledger.balance)}
            </dd>
          </div>
          <div>
            <dt className="note">Period</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>
              {formatDate(ledger.periodFrom)} &ndash;{" "}
              {formatDate(ledger.periodTo)}
            </dd>
          </div>
          <div>
            <dt className="note">Print Date</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>
              {formatDate(ledger.printDate)}
            </dd>
          </div>
          <div>
            <dt className="note">Currency</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>
              {ledger.currency}
            </dd>
          </div>
        </dl>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Trans.#</th>
              <th>Particulars</th>
              <th>Inv/Ref</th>
              <th className="num">Rate</th>
              <th className="num">Debit</th>
              <th className="num">Credit</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {ledger.rows.map((r, i) => (
              <tr key={i}>
                <td>{formatDate(r.date)}</td>
                <td>{r.type}</td>
                <td>{r.transNo}</td>
                <td>{r.particulars}</td>
                <td>{r.invRef || "—"}</td>
                <td className="num">{r.rate}</td>
                <td className="num">{formatPKR(r.debit)}</td>
                <td className="num">{formatPKR(r.credit)}</td>
                <td className="num">{formatPKR(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={6}>
                <strong>Total</strong>
              </td>
              <td className="num">
                <strong>{formatPKR(ledger.totalDebit)}</strong>
              </td>
              <td className="num">
                <strong>{formatPKR(ledger.totalCredit)}</strong>
              </td>
              <td className="num">
                <strong>{formatPKR(ledger.balance)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!hasEntries && (
        <p className="note" style={{ marginTop: 12 }}>
          No records for this customer yet.
        </p>
      )}

      <section className="section">
        <StatementActions data={ledger} />
      </section>
    </div>
  );
}
