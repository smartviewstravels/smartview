import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { loadAll } from "@/components/data";
import { formatPKR } from "@/lib/format";
import DeleteButton from "@/components/DeleteButton";
import VendorForm from "@/components/VendorForm";

export default async function VendorsPage() {
  await requireAdmin();
  const { vendors, records, vendorPayments } = await loadAll();

  const totalsByVendor = new Map<
    string,
    { cost: number; paid: number; records: number }
  >();
  for (const r of records) {
    if (!r.vendor_id) continue;
    const entry = totalsByVendor.get(r.vendor_id) ?? {
      cost: 0,
      paid: 0,
      records: 0,
    };
    entry.cost += r.vendor_cost ?? 0;
    entry.records += 1;
    totalsByVendor.set(r.vendor_id, entry);
  }
  for (const p of vendorPayments) {
    if (p.status !== "active") continue;
    const entry = totalsByVendor.get(p.vendor_id) ?? {
      cost: 0,
      paid: 0,
      records: 0,
    };
    entry.paid += p.amount;
    totalsByVendor.set(p.vendor_id, entry);
  }
  return (
    <div>
      <h1>Vendors</h1>
      <p className="note" style={{ marginBottom: 16 }}>
        {vendors.length} vendor{vendors.length === 1 ? "" : "s"}. Vendors are
        the suppliers the business buys tickets and packages from. Add a
        vendor here, then link it to a record from the Ticket, Umrah,
        Umrah + Ticket or Tours pages.
      </p>

      <div className="toolbar">
        <VendorForm />
      </div>

      {vendors.length === 0 ? (
        <p>No vendors yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Phone</th>
                <th className="num">Total cost</th>
                <th className="num">Total paid</th>
                <th className="num">Total pending</th>
                <th className="num">Records</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => {
                const totals = totalsByVendor.get(v.id) ?? {
                  cost: 0,
                  paid: 0,
                  records: 0,
                };
                const pending = Math.max(0, totals.cost - totals.paid);
                return (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/vendors/${v.id}`}>{v.name}</Link>
                    </td>
                    <td>{v.company_name ?? "—"}</td>
                    <td>{v.phone ?? "—"}</td>
                    <td className="num">{formatPKR(totals.cost)}</td>
                    <td className="num">{formatPKR(totals.paid)}</td>
                    <td className="num">{formatPKR(pending)}</td>
                    <td className="num">{totals.records}</td>
                    <td>
                      <VendorForm vendor={v} />{" "}
                      <DeleteButton kind="vendor" id={v.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
