"use client";

import { useState } from "react";
import { updateCustomer } from "@/app/actions/finance";
import type { Customer } from "@/lib/types";

/** "Edit" button + modal for one customer, prefilled from the customer. */
export default function EditCustomerForm({
  customer,
}: {
  customer: Customer;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData): Promise<void> {
    setPending(true);
    setError(null);
    const result = await updateCustomer(formData);
    setPending(false);
    if (result.ok) setOpen(false);
    else setError(result.error ?? "Could not save the customer.");
  }

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
              <h2>Edit customer</h2>
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
              <input type="hidden" name="customer_id" value={customer.id} />

              <div className="field">
                <label htmlFor={`edit-cust-name-${customer.id}`}>
                  Customer name
                </label>
                <input
                  id={`edit-cust-name-${customer.id}`}
                  name="name"
                  type="text"
                  required
                  defaultValue={customer.name}
                />
              </div>

              <div className="form-row">
                <div className="field">
                  <label htmlFor={`edit-cust-phone-${customer.id}`}>
                    Phone (optional)
                  </label>
                  <input
                    id={`edit-cust-phone-${customer.id}`}
                    name="phone"
                    type="tel"
                    defaultValue={customer.phone ?? ""}
                    placeholder="03xx-xxxxxxx"
                  />
                </div>
                <div className="field">
                  <label htmlFor={`edit-cust-cnic-${customer.id}`}>
                    CNIC / Passport (optional)
                  </label>
                  <input
                    id={`edit-cust-cnic-${customer.id}`}
                    name="cnic_passport"
                    type="text"
                    defaultValue={customer.cnic_passport ?? ""}
                  />
                </div>
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
