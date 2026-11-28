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

function pkr(n: number): string {
  return `PKR ${Math.round(n).toLocaleString("en-PK")}`;
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
 * Landscape A4: nine columns (three of them money columns with
 * "PKR 1,234,567" values) cannot fit legibly in portrait at a readable
 * font size, while landscape leaves room for Particulars to breathe.
 */
async function buildPdf(data: StatementData): Promise<{
  blob: Blob;
  filename: string;
}> {
  const logo = await logoDataUrl();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header: logo + business name + tagline.
  doc.addImage(logo, "PNG", 14, 10, 24, 24);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Smart View Travel", 42, 18);
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Your Journey Our Passion", 42, 25);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Date: ${formatDate(data.printDate)}`, pageWidth - 14, 18, {
    align: "right",
  });

  // Navy divider.
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(14, 38, pageWidth - 14, 38);

  // Shaded title bar.
  doc.setFillColor(...NAVY);
  doc.rect(14, 42, pageWidth - 28, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Account Ledger", 17, 48.5);

  // Meta block: two columns of label/value pairs.
  const metaTop = 60;
  const metaLeft: [string, string][] = [
    ["Account Code", data.accountCode],
    ["Account Title", data.accountTitle],
    ["Balance", pkr(data.balance)],
  ];
  const metaRight: [string, string][] = [
    [
      "Period",
      `${formatDate(data.periodFrom)} – ${formatDate(data.periodTo)}`,
    ],
    ["Print Date", formatDate(data.printDate)],
    ["Currency", data.currency],
  ];
  const metaRow = (pair: [string, string], x: number, y: number): void => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(`${pair[0]}:`, x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(pair[1], x + 32, y);
  };
  metaLeft.forEach((pair, i) => metaRow(pair, 14, metaTop + i * 6));
  metaRight.forEach((pair, i) => metaRow(pair, 155, metaTop + i * 6));

  // Ledger table.
  autoTable(doc, {
    startY: metaTop + 22,
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
        { content: "Totals", colSpan: 6 },
        pkr(data.totalDebit),
        pkr(data.totalCredit),
        pkr(data.balance),
      ],
    ],
    showFoot: "lastPage",
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
    footStyles: {
      fillColor: [239, 246, 255],
      textColor: NAVY,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 30 },
      2: { cellWidth: 20 },
      3: { cellWidth: 62 },
      4: { cellWidth: 24 },
      5: { cellWidth: 16, halign: "right" },
      6: { cellWidth: 31, halign: "right" },
      7: { cellWidth: 31, halign: "right" },
      8: { cellWidth: 31, halign: "right" },
    },
    styles: { fontSize: 9 },
  });

  // Footer.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Generated by Smart View Travel — Your Journey Our Passion",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" },
  );

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
