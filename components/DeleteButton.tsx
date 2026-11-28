"use client";

import { useActionState, useState } from "react";
import {
  deleteCustomer,
  deleteExpense,
  deleteRecord,
  deleteVendor,
} from "@/app/actions/finance";

type FormState = { ok: boolean; error?: string };

export type DeleteKind = "record" | "expense" | "customer" | "vendor";

const ID_FIELD: Record<DeleteKind, string> = {
  record: "record_id",
  expense: "expense_id",
  customer: "customer_id",
  vendor: "vendor_id",
};

const NOUN: Record<DeleteKind, string> = {
  record: "record",
  expense: "expense",
  customer: "customer",
  vendor: "vendor",
};

function submitDelete(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const kind = String(formData.get("kind") ?? "") as DeleteKind;
  const action =
    kind === "record"
      ? deleteRecord
      : kind === "expense"
        ? deleteExpense
        : kind === "vendor"
          ? deleteVendor
          : deleteCustomer;
  return action(formData);
}

interface DeleteButtonProps {
  kind: DeleteKind;
  id: string;
  /** Where to go after a delete from the record detail page. */
  returnTo?: string;
}

/**
 * Delete button for one row (record, expense, customer or vendor). Clicking
 * "Delete" reveals an inline confirm (no prompt()), matching
 * VoidPaymentForm. Guard errors from the store (record has payments,
 * customer has records, vendor has records) show inline and nothing is
 * deleted.
 */
export default function DeleteButton({ kind, id, returnTo }: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    submitDelete,
    { ok: false },
  );

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn btn-small btn-danger"
        onClick={() => setConfirming(true)}
      >
        Delete
      </button>
    );
  }

  return (
    <form action={formAction} style={{ display: "inline-block" }}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name={ID_FIELD[kind]} value={id} />
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      {state.error && (
        <p className="error" style={{ marginBottom: 6 }}>
          {state.error}
        </p>
      )}
      <p style={{ margin: "0 0 6px" }}>Delete this {NOUN[kind]}?</p>
      <button type="submit" className="btn btn-small btn-danger" disabled={pending}>
        {pending ? "Deleting..." : "Yes, delete"}
      </button>{" "}
      <button
        type="button"
        className="btn btn-small"
        onClick={() => setConfirming(false)}
      >
        Cancel
      </button>
    </form>
  );
}
