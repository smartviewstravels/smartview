"use client";

import { useActionState } from "react";
import { addVendorPayment } from "@/app/actions/finance";
import { formatPKR, todayPKT } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/types";

type FormState = { ok: boolean; error?: string };

async function submitVendorPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return addVendorPayment(formData);
}

interface VendorPaymentFormProps {
  recordId: string;
  vendorId: string;
  /** What the vendor is still owed on this record — the payment cap. */
  pending: number;
}

/**
 * Pay-vendor form on the record detail page, mirroring PaymentForm.
 * Shows the remaining vendor balance so the user knows the max; the
 * server action also refuses any payment above what is still owed.
 */
export default function VendorPaymentForm({
  recordId,
  vendorId,
  pending,
}: VendorPaymentFormProps) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    submitVendorPayment,
    { ok: false },
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="finance_record_id" value={recordId} />
      <input type="hidden" name="vendor_id" value={vendorId} />
      {state.error && <p className="error">{state.error}</p>}
      {state.ok && <p className="success">Vendor payment saved.</p>}
      <p className="note" style={{ marginBottom: 12 }}>
        Remaining vendor balance: {formatPKR(pending)}. A payment cannot be
        more than this amount.
      </p>
      <div className="form-row">
        <div className="field">
          <label htmlFor="vendor-amount">Amount (PKR)</label>
          <input
            id="vendor-amount"
            name="amount"
            type="number"
            min="1"
            max={pending}
            step="1"
            required
            placeholder="0"
          />
        </div>
        <div className="field">
          <label htmlFor="vendor-payment_date">Payment date</label>
          <input
            id="vendor-payment_date"
            name="payment_date"
            type="date"
            defaultValue={todayPKT()}
            required
          />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="vendor-method">Method</label>
          <select id="vendor-method" name="method" defaultValue="Cash">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="vendor-reference">Reference (optional)</label>
          <input id="vendor-reference" name="reference" type="text" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="vendor-note">Note (optional)</label>
        <input id="vendor-note" name="note" type="text" />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={isPending || pending <= 0}
      >
        {isPending ? "Saving..." : "Pay vendor"}
      </button>
      {pending <= 0 && (
        <p className="note" style={{ marginTop: 8 }}>
          This vendor cost is fully paid.
        </p>
      )}
    </form>
  );
}
