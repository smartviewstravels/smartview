"use client";

import { useState } from "react";
import VendorPaymentForm from "@/components/VendorPaymentForm";
import { formatDate } from "@/lib/format";
import { FINANCE_TYPE_LABELS, type FinanceType } from "@/lib/types";

export interface PayableVendorRecord {
  id: string;
  customerName: string;
  type: FinanceType;
  /** YYYY-MM-DD */
  date: string;
  /** What the vendor is still owed on this record. */
  pending: number;
}

interface VendorRecordPaymentFormProps {
  vendorId: string;
  /** Only records of this vendor with pending > 0. */
  records: PayableVendorRecord[];
}

/**
 * Pay-vendor picker on the vendor detail page. The manager picks one of
 * this vendor's records that still owes money, then pays it with the same
 * VendorPaymentForm used on the record detail page — same fields, same
 * server action, same overpayment guard.
 */
export default function VendorRecordPaymentForm({
  vendorId,
  records,
}: VendorRecordPaymentFormProps) {
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "");
  // The picked record may stop being payable after a payment (the page
  // re-renders with fresh data), so fall back to the first payable one.
  const selected =
    records.find((r) => r.id === selectedId) ?? records[0] ?? null;

  if (records.length === 0 || !selected) {
    return (
      <p>
        All vendor costs for this vendor are fully paid. Nothing is pending.
      </p>
    );
  }

  return (
    <div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="vendor-pay-record">Record to pay against</label>
        <select
          id="vendor-pay-record"
          value={selected.id}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.customerName} — {FINANCE_TYPE_LABELS[r.type]} —{" "}
              {formatDate(r.date)} — pending {r.pending.toLocaleString("en-PK")}{" "}
              PKR
            </option>
          ))}
        </select>
      </div>
      <VendorPaymentForm
        key={selected.id}
        recordId={selected.id}
        vendorId={vendorId}
        pending={selected.pending}
      />
    </div>
  );
}
