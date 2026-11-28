"use client";

import { useActionState, useState } from "react";
import { voidPayment, voidVendorPayment } from "@/app/actions/finance";

type FormState = { ok: boolean; error?: string };

async function submitVoid(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return voidPayment(formData);
}

async function submitVendorVoid(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return voidVendorPayment(formData);
}

interface VoidPaymentFormProps {
  paymentId: string;
  /** "payment" voids a client payment; "vendor" voids a vendor payment. */
  kind?: "payment" | "vendor";
}

/**
 * Void button per active payment. Clicking "Void" reveals an inline reason
 * input (no prompt()). The payment is kept as a voided row, not deleted.
 */
export default function VoidPaymentForm({
  paymentId,
  kind = "payment",
}: VoidPaymentFormProps) {
  const [showReason, setShowReason] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    kind === "vendor" ? submitVendorVoid : submitVoid,
    { ok: false },
  );

  if (!showReason) {
    return (
      <button
        type="button"
        className="btn btn-danger"
        onClick={() => setShowReason(true)}
      >
        Void
      </button>
    );
  }

  return (
    <form action={formAction} style={{ minWidth: 220 }}>
      <input
        type="hidden"
        name={kind === "vendor" ? "vendor_payment_id" : "payment_id"}
        value={paymentId}
      />
      {state.error && <p className="error">{state.error}</p>}
      <div className="field" style={{ marginBottom: 6 }}>
        <label htmlFor={`void-reason-${paymentId}`}>Reason for void</label>
        <input
          id={`void-reason-${paymentId}`}
          name="reason"
          type="text"
          required
          placeholder="e.g. entered by mistake"
        />
      </div>
      <button type="submit" className="btn btn-danger" disabled={pending}>
        {pending ? "Voiding..." : "Confirm void"}
      </button>{" "}
      <button
        type="button"
        className="btn btn-small"
        onClick={() => setShowReason(false)}
      >
        Cancel
      </button>
    </form>
  );
}
