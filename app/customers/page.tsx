import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { loadAll } from "@/components/data";
import DeleteButton from "@/components/DeleteButton";
import EditCustomerForm from "@/components/EditCustomerForm";
import { FINANCE_TYPE_LABELS, type FinanceType } from "@/lib/types";


export default async function CustomersPage() {
  await requireAdmin();
  const { customers, records } = await loadAll();

  const countByCustomer = new Map<string, { total: number; byType: Record<FinanceType, number> }>();
  for (const r of records) {
    const entry =
      countByCustomer.get(r.customer_id) ??
      { total: 0, byType: { ticket: 0, umrah: 0, combined: 0, tour: 0 } };
    entry.total += 1;
    entry.byType[r.type] += 1;
    countByCustomer.set(r.customer_id, entry);
  }

  return (
    <div>
      <h1>Customers</h1>
      <p className="note" style={{ marginBottom: 16 }}>
        {customers.length} customer{customers.length === 1 ? "" : "s"}.
        New customers are added from the Ticket, Umrah, Umrah + Ticket or
        Tours pages.
      </p>

      {customers.length === 0 ? (
        <p>No customers yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>CNIC / Passport</th>
                <th className="num">Records</th>
                <th>Records by module</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const counts = countByCustomer.get(c.id);
                const breakdown = counts
                  ? (Object.keys(counts.byType) as FinanceType[])
                      .filter((t) => counts.byType[t] > 0)
                      .map(
                        (t) => `${FINANCE_TYPE_LABELS[t]}: ${counts.byType[t]}`,
                      )
                      .join(", ")
                  : "";
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.phone ?? "—"}</td>
                    <td>{c.cnic_passport ?? "—"}</td>
                    <td className="num">{counts?.total ?? 0}</td>
                    <td>{breakdown || "—"}</td>
                    <td>
                      <Link href={`/tickets?q=${encodeURIComponent(c.name)}`}>
                        View records
                      </Link>{" "}
                      <Link href={`/customers/${c.id}/statement`}>
                        Statement
                      </Link>{" "}
                      <EditCustomerForm customer={c} />{" "}
                      <DeleteButton kind="customer" id={c.id} />
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
