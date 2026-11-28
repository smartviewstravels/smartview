import Link from "next/link";
import DeleteButton from "@/components/DeleteButton";
import EditRecordForm from "@/components/EditRecordForm";
import RecordForm from "@/components/RecordForm";
import { formatDate, formatPKR } from "@/lib/format";
import type {
  Customer,
  FinanceType,
  RecordWithTotals,
  Vendor,
} from "@/lib/types";
import { FINANCE_TYPE_LABELS } from "@/lib/types";

interface FinanceListProps {
  type: FinanceType;
  title: string;
  customers: Customer[];
  records: RecordWithTotals[];
  vendors: Vendor[];
  q: string;
}

/**
 * Shared list pattern for Ticket / Umrah / Umrah + Ticket / Tours:
 * search by customer name (?q=), table of totals, per-page totals row,
 * "Add record" modal on the same page, each row links to /records/[id].
 */
export default function FinanceList({
  type,
  title,
  customers,
  records,
  vendors,
  q,
}: FinanceListProps) {
  const query = q.trim().toLowerCase();
  const filtered = query
    ? records.filter((r) =>
        r.customer?.name.toLowerCase().includes(query),
      )
    : records;

  const totalAmount = filtered.reduce((s, r) => s + r.total_amount, 0);
  const totalReceived = filtered.reduce((s, r) => s + r.received, 0);
  const totalPending = filtered.reduce((s, r) => s + r.pending, 0);

  return (
    <div>
      <h1>{title}</h1>

      <div className="toolbar">
        <form method="get" className="search" role="search">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by customer name"
            aria-label="Search by customer name"
          />
        </form>
        <RecordForm type={type} customers={customers} vendors={vendors} />
      </div>

      {filtered.length === 0 ? (
        <p className="empty">
          {q ? "No records match this search." : "No records yet."}
        </p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                {type === "tour" && <th>Tour</th>}
                <th className="num">Total</th>
                <th className="num">Received</th>
                <th className="num">Pending</th>
                <th>Next payment date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/records/${r.id}`}>
                      {r.customer?.name ?? "Unknown customer"}
                    </Link>
                    {r.type === "combined" && (
                      <div className="muted">
                        Umrah {formatPKR(r.umrah_amount ?? 0)} + Ticket{" "}
                        {formatPKR(r.ticket_amount ?? 0)}
                      </div>
                    )}
                  </td>
                  {type === "tour" && <td>{r.tour_name ?? "—"}</td>}
                  <td className="num">{formatPKR(r.total_amount)}</td>
                  <td className="num">{formatPKR(r.received)}</td>
                  <td className="num">{formatPKR(r.pending)}</td>
                  <td>{formatDate(r.next_payment_date)}</td>
                  <td>
                    <Link href={`/records/${r.id}`}>View</Link>{" "}
                    <EditRecordForm
                      record={r}
                      customers={customers}
                      vendors={vendors}
                    />{" "}
                    <DeleteButton kind="record" id={r.id} />
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td>
                  Total ({filtered.length} record
                  {filtered.length === 1 ? "" : "s"})
                </td>
                {type === "tour" && <td></td>}
                <td className="num">{formatPKR(totalAmount)}</td>
                <td className="num">{formatPKR(totalReceived)}</td>
                <td className="num">{formatPKR(totalPending)}</td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="note" style={{ marginTop: 12 }}>
        {FINANCE_TYPE_LABELS[type]} records: {filtered.length} shown.
      </p>
    </div>
  );
}
