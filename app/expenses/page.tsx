import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { formatDate, formatPKR } from "@/lib/format";
import DeleteButton from "@/components/DeleteButton";
import EditExpenseForm from "@/components/EditExpenseForm";
import ExpenseForm from "@/components/ExpenseForm";


export default async function ExpensesPage() {
  await requireAdmin();
  const store = getStore();
  const expenses = await store.listExpenses();
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <h1>Expenses</h1>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <div className="card accent-rose">
          <div className="stat-label">Total Expenses (All Time)</div>
          <div className="stat-value">{formatPKR(total)}</div>
        </div>
        <div className="card accent-blue">
          <div className="stat-label">Number of expenses</div>
          <div className="stat-value">{expenses.length}</div>
        </div>
      </div>

      <section className="section">
        <h2>Add expense</h2>
        <div className="card">
          <ExpenseForm />
        </div>
      </section>

      <section className="section">
        <h2>All expenses</h2>
        {expenses.length === 0 ? (
          <p>No expenses yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th className="num">Amount</th>
                  <th>Description</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.expense_date)}</td>
                    <td>{e.name}</td>
                    <td>{e.category}</td>
                    <td className="num">{formatPKR(e.amount)}</td>
                    <td>{e.description ?? "—"}</td>
                    <td>
                      <EditExpenseForm expense={e} />{" "}
                      <DeleteButton kind="expense" id={e.id} />
                    </td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={3}>Total</td>
                  <td className="num">{formatPKR(total)}</td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
