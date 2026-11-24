"use client";

import { useState } from "react";
import { updateRecord } from "@/app/actions/finance";
import type { Customer, FinanceRecord } from "@/lib/types";
import { FINANCE_TYPE_LABELS } from "@/lib/types";

interface EditRecordFormProps {
  record: FinanceRecord;
  customers: Customer[];
}

/**
 * "Edit" button + modal for one record, mirroring RecordForm. Prefilled
 * from the record. The total cannot be lowered below what was already
 * received — the server action refuses that with a plain message.
 */
export default function EditRecordForm({
  record,
  customers,
}: EditRecordFormProps) {
  const [open, setOpen] = useState(false);
  const [umrahAmount, setUmrahAmount] = useState(
    String(record.umrah_amount ?? 0),
  );
  const [ticketAmount, setTicketAmount] = useState(
    String(record.ticket_amount ?? 0),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData): Promise<void> {
    setPending(true);
    setError(null);
    const result = await updateRecord(formData);
    setPending(false);
    if (result.ok) setOpen(false);
    else setError(result.error ?? "Could not save the record.");
  }

  const combinedTotal =
    (Number(umrahAmount) || 0) + (Number(ticketAmount) || 0);

  return (
    <>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => setOpen(true)}
      >
        Edit
      </button>

      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <div className="modal-head">
              <h2>Edit {FINANCE_TYPE_LABELS[record.type]} record</h2>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            {error && <p className="error">{error}</p>}

            <form action={handleSubmit}>
              <input type="hidden" name="record_id" value={record.id} />

              <div className="field">
                <label htmlFor={`edit-customer-${record.id}`}>Customer</label>
                <select
                  id={`edit-customer-${record.id}`}
                  name="customer_id"
                  required
                  defaultValue={record.customer_id}
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` — ${c.phone}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {record.type === "tour" && (
                <div className="field">
                  <label htmlFor={`edit-tour-${record.id}`}>
                    Tour / city name
                  </label>
                  <input
                    id={`edit-tour-${record.id}`}
                    name="tour_name"
                    type="text"
                    required
                    defaultValue={record.tour_name ?? ""}
                  />
                </div>
              )}

              {record.type === "combined" ? (
                <>
                  <div className="form-row">
                    <div className="field">
                      <label htmlFor={`edit-umrah-${record.id}`}>
                        Umrah amount (PKR)
                      </label>
                      <input
                        id={`edit-umrah-${record.id}`}
                        name="umrah_amount"
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={umrahAmount}
                        onChange={(e) => setUmrahAmount(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`edit-ticket-${record.id}`}>
                        Ticket amount (PKR)
                      </label>
                      <input
                        id={`edit-ticket-${record.id}`}
                        name="ticket_amount"
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={ticketAmount}
                        onChange={(e) => setTicketAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="note" style={{ marginBottom: 12 }}>
                    Total: PKR {combinedTotal.toLocaleString("en-PK")} (Umrah +
                    Ticket)
                  </p>
                </>
              ) : (
                <div className="field">
                  <label htmlFor={`edit-total-${record.id}`}>
                    Total amount (PKR)
                  </label>
                  <input
                    id={`edit-total-${record.id}`}
                    name="total_amount"
                    type="number"
                    min="0"
                    step="1"
                    required
                    defaultValue={record.total_amount}
                  />
                </div>
              )}

              <div className="field">
                <label htmlFor={`edit-due-${record.id}`}>
                  Next payment date (optional)
                </label>
                <input
                  id={`edit-due-${record.id}`}
                  name="next_payment_date"
                  type="date"
                  defaultValue={record.next_payment_date ?? ""}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Saving..." : "Save changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
