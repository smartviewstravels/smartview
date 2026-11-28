import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { loadAll } from "@/components/data";
import { formatDate, formatNumber, todayPKT } from "@/lib/format";
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
 *
 * Layout matches the sample account ledger: logo top-left, business
 * name + tagline top-right, a light shaded bordered "Account Ledger"
 * title bar, the meta block (account on the left, period/print
 * date/currency right-aligned on the right), and a fully bordered
 * nine-column table with a shaded bold header. Numbers are plain
 * with thousand separators — "PKR" appears only in the meta block.
 */

const LIGHT_SHADE = "#D9E2F3";
const CELL_BORDER = "1px solid #9db1d1";
const NAVY_TEXT = "#1e234d";

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

  const th = (align: "left" | "center" | "right"): React.CSSProperties => ({
    background: LIGHT_SHADE,
    color: NAVY_TEXT,
    fontWeight: 700,
    border: CELL_BORDER,
    textAlign: align,
    padding: "8px 10px",
    whiteSpace: "nowrap",
  });
  const td = (align: "left" | "center" | "right"): React.CSSProperties => ({
    border: CELL_BORDER,
    textAlign: align,
    padding: "8px 10px",
    verticalAlign: "top",
    overflowWrap: "break-word",
  });

  return (
    <div>
      <p>
        <Link href="/customers">&larr; Back to customers</Link>
      </p>

      {/* Header: logo top-left, business name + tagline top-right. */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 12,
        }}
      >
        <Image
          src="/logo.png"
          alt="Smart View Travel logo"
          width={56}
          height={56}
          style={{ borderRadius: "50%" }}
        />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: NAVY_TEXT }}>
            Smart View Travel
          </div>
          <div style={{ color: "#c9a227", fontSize: 13 }}>
            Your Journey Our Passion
          </div>
        </div>
      </div>

      {/* Title bar: bordered, light shaded, bold centered. */}
      <div
        style={{
          border: CELL_BORDER,
          background: LIGHT_SHADE,
          color: NAVY_TEXT,
          fontWeight: 700,
          fontSize: 15,
          textAlign: "center",
          padding: "8px 12px",
          marginBottom: 16,
        }}
      >
        Account Ledger
      </div>

      {/* Meta block: account on the left, period/print/currency right. */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ marginBottom: 6 }}>
            <strong>Account Code:</strong> {ledger.accountCode}
          </div>
          <div
            style={{
              marginBottom: 6,
              overflowWrap: "break-word",
              wordBreak: "break-word",
            }}
          >
            <strong>Account Title:</strong> {ledger.accountTitle}
          </div>
          <div>
            <strong>Balance:</strong>{" "}
            <strong>{formatNumber(ledger.balance)}</strong>
          </div>
        </div>
        <div style={{ textAlign: "right", flex: "0 1 auto" }}>
          <div style={{ marginBottom: 6 }}>
            <strong>Period:</strong> {formatDate(ledger.periodFrom)} &ndash;{" "}
            {formatDate(ledger.periodTo)}
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong>Print Date:</strong> {formatDate(ledger.printDate)}
          </div>
          <div>
            <strong>Currency:</strong> {ledger.currency}
          </div>
        </div>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th style={th("center")}>Date</th>
              <th style={th("center")}>Type</th>
              <th style={th("center")}>Trans.#</th>
              <th style={{ ...th("left"), whiteSpace: "normal" }}>
                Particulars
              </th>
              <th style={th("left")}>Inv/Ref</th>
              <th style={th("right")}>Rate</th>
              <th style={th("right")}>Debit</th>
              <th style={th("right")}>Credit</th>
              <th style={th("right")}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {ledger.rows.map((r, i) => (
              <tr key={i}>
                <td style={{ ...td("center"), whiteSpace: "nowrap" }}>
                  {formatDate(r.date)}
                </td>
                <td style={td("center")}>{r.type}</td>
                <td style={td("center")}>{r.transNo}</td>
                <td style={td("left")}>{r.particulars}</td>
                <td style={td("left")}>{r.invRef || "—"}</td>
                <td style={td("right")}>{r.rate}</td>
                <td style={td("right")}>{formatNumber(r.debit)}</td>
                <td style={td("right")}>{formatNumber(r.credit)}</td>
                <td style={td("right")}>{formatNumber(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={6}
                style={{
                  ...td("left"),
                  fontWeight: 700,
                  background: LIGHT_SHADE,
                }}
              >
                Total
              </td>
              <td
                style={{ ...td("right"), fontWeight: 700, background: LIGHT_SHADE }}
              >
                {formatNumber(ledger.totalDebit)}
              </td>
              <td
                style={{ ...td("right"), fontWeight: 700, background: LIGHT_SHADE }}
              >
                {formatNumber(ledger.totalCredit)}
              </td>
              <td
                style={{ ...td("right"), fontWeight: 700, background: LIGHT_SHADE }}
              >
                {formatNumber(ledger.balance)}
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
