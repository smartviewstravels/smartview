import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { loadAll } from "@/components/data";
import { recordPending, sumActivePayments } from "@/lib/calc";
import { formatDate, formatPKR } from "@/lib/format";
import { FINANCE_TYPE_LABELS } from "@/lib/types";
import { updateDueDate } from "@/app/actions/finance";
import DeleteButton from "@/components/DeleteButton";
import EditRecordForm from "@/components/EditRecordForm";
import PaymentForm from "@/components/PaymentForm";
import VendorPaymentForm from "@/components/VendorPaymentForm";
import VoidPaymentForm from "@/components/VoidPaymentForm";


/** Plain form action wrapper: updateDueDate returns a result object, which
 *  a <form action> cannot accept directly, so discard it here. */
async function saveDueDate(formData: FormData): Promise<void> {
  "use server";
  await updateDueDate(formData);
}

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const store = getStore();
  const record = await store.getRecord(id);
  if (!record) notFound();

  const customer = await store.getCustomer(record.customer_id);
  const customers = await store.listCustomers();
  const payments = await store.listPayments(record.id);
  const received = sumActivePayments(payments);
  const pending = recordPending(record, payments);
  // Vendor figures come from loadAll(), whose records carry the vendor
  // join (vendor, vendorPaid, vendorPending, vendorProfit).
  const { records: allRecords, vendors, vendorPayments } = await loadAll();
  const enriched = allRecords.find((r) => r.id === id);
  const vendor = enriched?.vendor ?? null;
  const myVendorPayments = vendorPayments
    .filter((p) => p.finance_record_id === id)
    .slice()
    .sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1));
  const listPath =
    record.type === "combined"
      ? "/combined"
      : record.type === "tour"
        ? "/tours"
        : record.type === "umrah"
          ? "/umrah"
          : "/tickets";

  return (
    <div>
      <p>
        <Link href={`/${record.type === "combined" ? "combined" : record.type === "tour" ? "tours" : record.type === "umrah" ? "umrah" : "tickets"}`}>
          Back to {FINANCE_TYPE_LABELS[record.type]}
        </Link>
      </p>

      <h1>
        {customer?.name ?? "Unknown customer"} — {FINANCE_TYPE_LABELS[record.type]}
      </h1>

      <div className="stat-grid">
        <div className="card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{formatPKR(record.total_amount)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Received</div>
          <div className="stat-value">{formatPKR(received)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Pending</div>
          <div className="stat-value">{formatPKR(pending)}</div>
        </div>
      </div>

      <section className="section">
        <h2>Record details</h2>
        <div className="card">
          <p>
            <strong>Customer:</strong> {customer?.name ?? "Unknown customer"}
            {customer?.phone ? ` — ${customer.phone}` : ""}
            {customer?.cnic_passport ? ` — CNIC/Passport: ${customer.cnic_passport}` : ""}
            {customer && (
              <>
                {" — "}
                <Link href={`/customers/${customer.id}/statement`}>
                  View statement
                </Link>
              </>
            )}
          </p>
          <p>
            <strong>Service:</strong> {FINANCE_TYPE_LABELS[record.type]}
          </p>
          {record.type === "tour" && (
            <p>
              <strong>Tour / city:</strong> {record.tour_name ?? "—"}
            </p>
          )}
          {record.type === "combined" && (
            <p>
              <strong>Umrah amount:</strong> {formatPKR(record.umrah_amount ?? 0)}
              <br />
              <strong>Ticket amount:</strong> {formatPKR(record.ticket_amount ?? 0)}
              <br />
              <strong>Combined total:</strong> {formatPKR(record.total_amount)}
            </p>
          )}
          <p>
            <strong>Status:</strong>{" "}
            <span
              className={
                record.status === "paid" ? "badge badge-paid" : "badge badge-open"
              }
            >
              {record.status === "paid" ? "Paid" : "Open"}
            </span>
          </p>
          <p>
            <strong>Next payment date:</strong> {formatDate(record.next_payment_date)}
          </p>

          <form action={saveDueDate} style={{ marginTop: 12 }}>
            <input type="hidden" name="finance_record_id" value={record.id} />
            <div className="field" style={{ maxWidth: 280 }}>
              <label htmlFor="next_payment_date">Change next payment date</label>
              <input
                id="next_payment_date"
                name="next_payment_date"
                type="date"
                defaultValue={record.next_payment_date ?? ""}
              />
            </div>
            <button type="submit" className="btn">
              Save due date
            </button>
            <p className="note" style={{ marginTop: 6 }}>
              Leave the date empty to clear it.
            </p>
          </form>

          <div style={{ marginTop: 16 }}>
            <EditRecordForm
              record={record}
              customers={customers}
              vendors={vendors}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Add payment</h2>
        <div className="card">
          <PaymentForm recordId={record.id} pending={pending} />
        </div>
      </section>

      {vendor && (
        <section className="section">
          <h2>Vendor</h2>
          <div className="card">
            <p>
              <strong>Vendor:</strong>{" "}
              <Link href={`/vendors/${vendor.id}`}>{vendor.name}</Link>
              {vendor.company_name ? ` — ${vendor.company_name}` : ""}
              {vendor.phone ? ` — ${vendor.phone}` : ""}
            </p>
            <p>
              <strong>Vendor reference:</strong>{" "}
              {record.vendor_reference ?? "—"}
            </p>
            <p>
              <strong>Vendor cost:</strong>{" "}
              {record.vendor_cost == null
                ? "—"
                : formatPKR(record.vendor_cost)}
            </p>
            <p>
              <strong>Paid to vendor:</strong>{" "}
              {formatPKR(enriched?.vendorPaid ?? 0)}
            </p>
            <p>
              <strong>Still owed to vendor:</strong>{" "}
              {formatPKR(enriched?.vendorPending ?? 0)}
            </p>
            <p>
              <strong>Profit on this record:</strong>{" "}
              {enriched?.vendorProfit == null
                ? "—"
                : formatPKR(enriched.vendorProfit)}
            </p>
            <p className="note">
              Sale total minus vendor cost. Vendor payments count as an
              expense in Profit &amp; Loss.
            </p>
          </div>
        </section>
      )}

      {vendor && record.vendor_cost != null && (
        <section className="section">
          <h2>Pay vendor</h2>
          <div className="card">
            <VendorPaymentForm
              recordId={record.id}
              vendorId={vendor.id}
              pending={enriched?.vendorPending ?? 0}
            />
          </div>
        </section>
      )}

      {vendor && (
        <section className="section">
          <h2>Vendor payment history</h2>
          {myVendorPayments.length === 0 ? (
            <p>No vendor payments yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="num">Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Note</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {myVendorPayments.map((p) => (
                    <tr
                      key={p.id}
                      className={p.status === "voided" ? "voided" : undefined}
                    >
                      <td>{formatDate(p.payment_date)}</td>
                      <td className="num">{formatPKR(p.amount)}</td>
                      <td>{p.method ?? "—"}</td>
                      <td>{p.reference ?? "—"}</td>
                      <td>{p.note ?? "—"}</td>
                      <td>
                        {p.status === "voided"
                          ? `Voided${p.void_reason ? ` — ${p.void_reason}` : ""}`
                          : "Active"}
                      </td>
                      <td>
                        {p.status === "active" && (
                          <VoidPaymentForm paymentId={p.id} kind="vendor" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="section">
        <h2>Payment history</h2>
        {payments.length === 0 ? (
          <p>No payments yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Note</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={p.status === "voided" ? "voided" : undefined}>
                    <td>{formatDate(p.payment_date)}</td>
                    <td className="num">{formatPKR(p.amount)}</td>
                    <td>{p.method ?? "—"}</td>
                    <td>{p.reference ?? "—"}</td>
                    <td>{p.note ?? "—"}</td>
                    <td>
                      {p.status === "voided"
                        ? `Voided${p.void_reason ? ` — ${p.void_reason}` : ""}`
                        : "Active"}
                    </td>
                    <td>
                      {p.status === "active" && (
                        <VoidPaymentForm paymentId={p.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>Delete record</h2>
        <div className="card">
          <p>
            Deletes this record permanently. A record with received
            payments cannot be deleted — void its payments first.
          </p>
          <DeleteButton kind="record" id={record.id} returnTo={listPath} />
        </div>
      </section>
    </div>
  );
}
