"use client";

import { useState } from "react";
import { createVendor, updateVendor } from "@/app/actions/finance";
import type { Vendor } from "@/lib/types";

interface VendorFormProps {
  /** When given, the modal edits this vendor; otherwise it adds a new one. */
  vendor?: Vendor;
}

/**
 * "Add vendor" button + modal, or "Edit" button + modal for one vendor,
 * mirroring EditCustomerForm. Name is required; company name and phone
 * are optional.
 */
export default function VendorForm({ vendor }: VendorFormProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const editing = vendor !== undefined;

  async function handleSubmit(formData: FormData): Promise<void> {
    setPending(true);
    setError(null);
    const result = editing
      ? await updateVendor(formData)
      : await createVendor(formData);
    setPending(false);
    if (result.ok) setOpen(false);
    else setError(result.error ?? "Could not save the vendor.");
  }

  const idSuffix = vendor?.id ?? "new";

  return (
    <>
      <button
        type="button"
        className={editing ? "btn btn-small" : "btn btn-primary"}
        onClick={() => setOpen(true)}
      >
        {editing ? "Edit" : "Add vendor"}
      </button>

      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <div className="modal-head">
              <h2>{editing ? "Edit vendor" : "Add vendor"}</h2>
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
              {vendor && (
                <input type="hidden" name="vendor_id" value={vendor.id} />
              )}

              <div className="field">
                <label htmlFor={`vendor-name-${idSuffix}`}>
                  Vendor name
                </label>
                <input
                  id={`vendor-name-${idSuffix}`}
                  name="name"
                  type="text"
                  required
                  defaultValue={vendor?.name ?? ""}
                  placeholder="Vendor full name"
                />
              </div>

              <div className="form-row">
                <div className="field">
                  <label htmlFor={`vendor-company-${idSuffix}`}>
                    Company name (optional)
                  </label>
                  <input
                    id={`vendor-company-${idSuffix}`}
                    name="company_name"
                    type="text"
                    defaultValue={vendor?.company_name ?? ""}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`vendor-phone-${idSuffix}`}>
                    Phone (optional)
                  </label>
                  <input
                    id={`vendor-phone-${idSuffix}`}
                    name="phone"
                    type="tel"
                    defaultValue={vendor?.phone ?? ""}
                    placeholder="03xx-xxxxxxx"
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending
                  ? "Saving..."
                  : editing
                    ? "Save changes"
                    : "Save vendor"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
