import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { loadAll } from "@/components/data";
import { formatDate, formatPKR } from "@/lib/format";
import { FINANCE_TYPE_LABELS } from "@/lib/types";
import DeleteButton from "@/components/DeleteButton";
import VendorForm from "@/components/VendorForm";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { vendors, records } = await loadAll();
  const vendor = vendors.find((v) => v.id === id);
  if (!vendor) notFound();

  const myRecords = records.filter((r) => r.vendor_id === id);
  const totalCost = myRecords.reduce((s, r) => s + (r.vendor_cost ?? 0), 0);
  const totalPaid = myRecords.reduce((s, r) => s + r.vendorPaid, 0);
  const totalPending = myRecords.reduce((s, r) => s + r.vendorPending, 0);

  return (
    <div>
      <p>
        <Link href="/vendors">&larr; Back to vendors</Link>
      </p>

      <h1>{vendor.name}</h1>
      <p className="note" style={{ marginBottom: 16 }}>
        {vendor.company_name ?? "No company name"}
        {vendor.phone ? ` — ${vendor.phone}` : ""}
      </p>

      <div className="stat-grid">
        <div className="card">
          <div className="stat-label">Total cost</div>
          <div className="stat-value">{formatPKR(totalCost)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Total paid</div>
          <div className="stat-value">{formatPKR(totalPaid)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Total pending</div>
          <div className="stat-value">{formatPKR(totalPending)}</div>
          <div className="note">
            Still owed to this vendor. Pay it from each record.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <VendorForm vendor={vendor} />{" "}
        <DeleteButton kind="vendor" id={vendor.id} returnTo="/vendors" />
      </div>

      <section className="section">
        <h2>Records bought from this vendor</h2>
        {myRecords.length === 0 ? (
          <p>No records linked to this vendor yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th className="num">Sale total</th>
                  <th className="num">Vendor cost</th>
                  <th className="num">Paid</th>
                  <th className="num">Pending</th>
                  <th className="num">Profit</th>
                </tr>
              </thead>
              <tbody>
                {myRecords.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.created_at)}</td>
                    <td>
                      <Link href={`/records/${r.id}`}>
                        {r.customer?.name ?? "Unknown customer"}
                      </Link>
                    </td>
                    <td>{FINANCE_TYPE_LABELS[r.type]}</td>
                    <td className="num">{formatPKR(r.total_amount)}</td>
                    <td className="num">{formatPKR(r.vendor_cost ?? 0)}</td>
                    <td className="num">{formatPKR(r.vendorPaid)}</td>
                    <td className="num">{formatPKR(r.vendorPending)}</td>
                    <td className="num">
                      {r.vendorProfit == null
                        ? "—"
                        : formatPKR(r.vendorProfit)}
                    </td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>Total ({myRecords.length} record
                    {myRecords.length === 1 ? "" : "s"})
                  </td>
                  <td></td>
                  <td></td>
                  <td className="num">
                    {formatPKR(
                      myRecords.reduce((s, r) => s + r.total_amount, 0),
                    )}
                  </td>
                  <td className="num">{formatPKR(totalCost)}</td>
                  <td className="num">{formatPKR(totalPaid)}</td>
                  <td className="num">{formatPKR(totalPending)}</td>
                  <td className="num">
                    {formatPKR(
                      myRecords.reduce(
                        (s, r) => s + (r.vendorProfit ?? 0),
                        0,
                      ),
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
