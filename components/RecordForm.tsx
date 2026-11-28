"use client";

import { useState } from "react";
import { createRecord } from "@/app/actions/finance";
import type { Customer, FinanceType, Vendor } from "@/lib/types";
import { FINANCE_TYPE_LABELS } from "@/lib/types";
import { todayPKT } from "@/lib/format";

interface RecordFormProps {
  type: FinanceType;
  customers: Customer[];
  vendors: Vendor[];
}

/**
 * "Add record" form in a modal on the same page (house style: one entity's
 * whole lifecycle on one route). Customer is an existing customer (select)
 * or a new one (name + optional phone / CNIC). Combined records take an
 * Umrah amount and a Ticket amount; the total shown is their sum.
 */
export default function RecordForm({ type, customers, vendors }: RecordFormProps) {
  const [open, setOpen] = useState(false);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    customers.length > 0 ? "existing" : "new",
  );
  const [umrahAmount, setUmrahAmount] = useState("");
  const [ticketAmount, setTicketAmount] = useState("");
  // Vendor is optional: clearing the vendor clears its reference and cost.
  const [vendorId, setVendorId] = useState("");
  const [vendorReference, setVendorReference] = useState("");
  const [vendorCost, setVendorCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Plain client-side submit: no useEffect, so the modal closes here on
  // success and the error stays visible on failure.
  async function handleSubmit(formData: FormData): Promise<void> {
    setPending(true);
    setError(null);
    const result = await createRecord(formData);
    setPending(false);
    if (result.ok) {
      setOpen(false);
      setVendorId("");
      setVendorReference("");
      setVendorCost("");
    } else setError(result.error ?? "Could not save the record.");
  }

  const combinedTotal =
    (Number(umrahAmount) || 0) + (Number(ticketAmount) || 0);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setOpen(true)}
      >
        Add record
      </button>

      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <div className="modal-head">
              <h2>Add {FINANCE_TYPE_LABELS[type]} record</h2>
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
              <input type="hidden" name="type" value={type} />

              <div className="field">
                <label htmlFor="customer-mode">Customer</label>
                <select
                  id="customer-mode"
                  value={customerMode}
                  onChange={(e) =>
                    setCustomerMode(e.target.value as "existing" | "new")
                  }
                >
                  <option value="existing">Existing customer</option>
                  <option value="new">New customer</option>
                </select>
              </div>

              {customerMode === "existing" ? (
                <div className="field">
                  <label htmlFor="customer_id">Select customer</label>
                  <select id="customer_id" name="customer_id" required>
                    <option value="">Select a customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.phone ? ` — ${c.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="new_customer_name">Customer name</label>
                    <input
                      id="new_customer_name"
                      name="new_customer_name"
                      type="text"
                      required
                      placeholder="Customer full name"
                    />
                  </div>
                  <div className="form-row">
                    <div className="field">
                      <label htmlFor="new_customer_phone">Phone (optional)</label>
                      <input
                        id="new_customer_phone"
                        name="new_customer_phone"
                        type="tel"
                        placeholder="03xx-xxxxxxx"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="new_customer_cnic">
                        CNIC / Passport (optional)
                      </label>
                      <input
                        id="new_customer_cnic"
                        name="new_customer_cnic"
                        type="text"
                      />
                    </div>
                  </div>
                </>
              )}

              {type === "tour" && (
                <div className="field">
                  <label htmlFor="tour_name">Tour / city name</label>
                  <input
                    id="tour_name"
                    name="tour_name"
                    type="text"
                    required
                    placeholder="e.g. Lahore Tour"
                  />
                </div>
              )}

              {type === "combined" ? (
                <>
                  <div className="form-row">
                    <div className="field">
                      <label htmlFor="umrah_amount">Umrah amount (PKR)</label>
                      <input
                        id="umrah_amount"
                        name="umrah_amount"
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={umrahAmount}
                        onChange={(e) => setUmrahAmount(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="ticket_amount">Ticket amount (PKR)</label>
                      <input
                        id="ticket_amount"
                        name="ticket_amount"
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={ticketAmount}
                        onChange={(e) => setTicketAmount(e.target.value)}
                        placeholder="0"
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
                  <label htmlFor="total_amount">Total amount (PKR)</label>
                  <input
                    id="total_amount"
                    name="total_amount"
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="0"
                  />
                </div>
              )}

              <div className="field">
                <label htmlFor="next_payment_date">
                  Next payment date (optional)
                </label>
                <input
                  id="next_payment_date"
                  name="next_payment_date"
                  type="date"
                  defaultValue={todayPKT()}
                />
              </div>

              <div className="field">
                <label htmlFor="vendor_id">Vendor (optional)</label>
                <select
                  id="vendor_id"
                  name="vendor_id"
                  value={vendorId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setVendorId(next);
                    if (!next) {
                      setVendorReference("");
                      setVendorCost("");
                    }
                  }}
                >
                  <option value="">No vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.company_name ? ` — ${v.company_name}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {vendorId && (
                <>
                  <div className="form-row">
                    <div className="field">
                      <label htmlFor="vendor_reference">
                        Vendor reference number (optional)
                      </label>
                      <input
                        id="vendor_reference"
                        name="vendor_reference"
                        type="text"
                        value={vendorReference}
                        onChange={(e) => setVendorReference(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="vendor_cost">
                        Vendor purchase cost (PKR)
                      </label>
                      <input
                        id="vendor_cost"
                        name="vendor_cost"
                        type="number"
                        min="0"
                        step="1"
                        value={vendorCost}
                        onChange={(e) => setVendorCost(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <p className="note" style={{ marginBottom: 12 }}>
                    What the business pays the vendor for this ticket or
                    package. The vendor is paid from the record page.
                  </p>
                </>
              )}

              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Saving..." : "Save record"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
