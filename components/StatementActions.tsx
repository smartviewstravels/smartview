"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "@/lib/format";
import type { LedgerData, LedgerRow } from "@/lib/ledger";

/**
 * One shared data shape for the statement preview and the PDF:
 * the ledger built by lib/ledger.ts. Both render from this same
 * object, so they can never disagree.
 */
export type StatementRow = LedgerRow;
export type StatementData = LedgerData;

const NAVY: [number, number, number] = [30, 35, 77];
const GOLD: [number, number, number] = [201, 162, 39];
/** Pale blue-grey shading of the sample ledger (title bar + table head). */
const LIGHT: [number, number, number] = [217, 226, 243];
const GRID: [number, number, number] = [157, 177, 209];

/** Plain number with thousand separators, no currency prefix —
 *  "PKR" appears only in the meta block (Currency: PKR). */
function pkr(n: number): string {
  return Math.round(n).toLocaleString("en-PK");
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function logoDataUrl(): Promise<string> {
  const res = await fetch("/logo.png");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not load the logo."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Builds the branded account-ledger PDF. Shared by Download and Share.
 * Landscape A4: nine columns (three of them money columns) cannot fit
 * legibly in portrait at a readable font size, while landscape leaves
 * room for Particulars to breathe. Layout matches the sample ledger:
 * logo top-left, business name + tagline top-right, a light shaded
 * bordered "Account Ledger" title bar, the meta block (account on the
 * left, period/print date/currency right-aligned on the right), and a
 * fully bordered nine-column table with a shaded bold header.
 */
async function buildPdf(data: StatementData): Promise<{
  blob: Blob;
  filename: string;
}> {
  const logo = await logoDataUrl();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header: logo top-left, business name + tagline top-right.
  doc.addImage(logo, "PNG", 14, 10, 24, 24);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Smart View Travel", pageWidth - 14, 18, { align: "right" });
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Your Journey Our Passion", pageWidth - 14, 25, {
    align: "right",
  });

  // Title bar: bordered, light shaded, bold centered dark text.
  // (No divider above it: the sample has none, and the title bar
  // sits far enough below the header that nothing can overlap.)
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...GRID);
  doc.setLineWidth(0.4);
  doc.rect(14, 42, pageWidth - 28, 9, "FD");
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Account Ledger", pageWidth / 2, 48.5, { align: "center" });

  // Meta block: account on the left, period/print/currency right.
  const metaTop = 60;
  const rightEdge = pageWidth - 14;
  // Left column: the Account Title value is wrapped to a 105mm bound
  // so even a very long name can never reach the right column; the
  // y cursor advances by the wrapped line count.
  let leftY = metaTop;
  const metaLeft: [string, string, boolean][] = [
    ["Account Code", data.accountCode, false],
    ["Account Title", data.accountTitle, false],
    ["Balance", pkr(data.balance), true],
  ];
  for (const [label, value, boldValue] of metaLeft) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(`${label}:`, 14, leftY);
    const lines = doc.splitTextToSize(value, 105);
    doc.setFont("helvetica", boldValue ? "bold" : "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(lines, 46, leftY);
    leftY += lines.length * 5 + 1;
  }
  // Right column: each pair right-aligned against the page edge.
  const metaRight: [string, string][] = [
    [
      "Period",
      `${formatDate(data.periodFrom)} – ${formatDate(data.periodTo)}`,
    ],
    ["Print Date", formatDate(data.printDate)],
    ["Currency", data.currency],
  ];
  metaRight.forEach(([label, value], i) => {
    const y = metaTop + i * 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const valueWidth = doc.getTextWidth(value);
    doc.text(value, rightEdge, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(`${label}:`, rightEdge - valueWidth - 2, y, {
      align: "right",
    });
  });

  // Ledger table.
  autoTable(doc, {
    startY: Math.max(leftY + 4, metaTop + 22),
    head: [
      [
        "Date",
        "Type",
        "Trans.#",
        "Particulars",
        "Inv/Ref",
        "Rate",
        "Debit",
        "Credit",
        "Balance",
      ],
    ],
    body: data.rows.map((r) => [
      formatDate(r.date),
      r.type,
      r.transNo,
      r.particulars,
      r.invRef || "—",
      r.rate,
      pkr(r.debit),
      pkr(r.credit),
      pkr(r.balance),
    ]),
    foot: [
      [
        { content: "Total", colSpan: 6 },
        pkr(data.totalDebit),
        pkr(data.totalCredit),
        pkr(data.balance),
      ],
    ],
    showFoot: "lastPage",
    theme: "grid",
    headStyles: {
      fillColor: LIGHT,
      textColor: NAVY,
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: LIGHT,
      textColor: NAVY,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 24, halign: "center" },
      1: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 62 },
      4: { cellWidth: 24 },
      5: { cellWidth: 16, halign: "right" },
      6: { cellWidth: 31, halign: "right" },
      7: { cellWidth: 31, halign: "right" },
      8: { cellWidth: 31, halign: "right" },
    },
    styles: { fontSize: 9, lineColor: GRID, lineWidth: 0.1 },
    // columnStyles.halign reaches body cells only, so the header row
    // gets its alignment here, per column, to match the preview:
    // Date/Type/Trans.# centered, Particulars and Inv/Ref left,
    // Rate/Debit/Credit/Balance right.
    didParseCell: (data) => {
      if (data.section !== "head") return;
      const halign: Record<number, "left" | "center" | "right"> = {
        0: "center",
        1: "center",
        2: "center",
        3: "left",
        4: "left",
        5: "right",
        6: "right",
        7: "right",
        8: "right",
      };
      data.cell.styles.halign = halign[data.column.index] ?? "left";
    },
  });

  const filename = `Smart-View-Statement-${slug(data.accountTitle)}-${data.printDate}.pdf`;
  return { blob: doc.output("blob"), filename };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download + Share actions for a customer statement. Share uses the Web
 * Share API with the PDF file when the browser supports it (mobile);
 * otherwise it falls back to downloading.
 */
export default function StatementActions({ data }: { data: StatementData }) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function download(): Promise<void> {
    setBusy("download");
    setNote(null);
    try {
      const { blob, filename } = await buildPdf(data);
      downloadBlob(blob, filename);
    } catch {
      setNote("Could not build the PDF. Please try again.");
    }
    setBusy(null);
  }

  async function share(): Promise<void> {
    setBusy("share");
    setNote(null);
    try {
      const { blob, filename } = await buildPdf(data);
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Smart View Travel — Account Ledger",
          text: `Account ledger for ${data.accountTitle}`,
        });
      } else {
        downloadBlob(blob, filename);
        setNote(
          "Sharing is not supported on this browser — the PDF was downloaded instead.",
        );
      }
    } catch {
      setNote("Could not share the PDF. Try downloading it instead.");
    }
    setBusy(null);
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => void download()}
        disabled={busy !== null}
      >
        {busy === "download" ? "Building PDF..." : "Download PDF"}
      </button>{" "}
      <button
        type="button"
        className="btn"
        onClick={() => void share()}
        disabled={busy !== null}
      >
        {busy === "share" ? "Preparing..." : "Share"}
      </button>
      {note && (
        <p className="note" style={{ marginTop: 8 }}>
          {note}
        </p>
      )}
    </div>
  );
}
