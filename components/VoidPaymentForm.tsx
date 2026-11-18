"use client";

import { useActionState, useState } from "react";
import { voidPayment } from "@/app/actions/finance";

type FormState = { ok: boolean; error?: string };

async function submitVoid(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return voidPayment(formData);
}

interface VoidPaymentFormProps {
  paymentId: string;
}

/**
 * Void button per active payment. Clicking "Void" reveals an inline reason
 * input (no prompt()). The payment is kept as a voided row, not deleted.
 */
export default function VoidPaymentForm({ paymentId }: VoidPaymentFormProps) {
  const [showReason, setShowReason] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    submitVoid,
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
      <input type="hidden" name="payment_id" value={paymentId} />
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
