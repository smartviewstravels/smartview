// Rule-based, READ-ONLY chatbot (guide §6–§7, module 07).
// No external AI API, no key, no cost. Answers come ONLY from the snapshot
// passed in (live figures computed from source records). It never invents
// numbers, and it REFUSES any create / edit / delete / void request —
// no action is ever taken through the chatbot.

import { formatPKR } from "./format";

export interface ChatSnapshot {
  totalPending: number;
  totalReceived: number;
  totalExpenses: number;
  profit: number;
  receivedToday: number;
  expensesToday: number;
  remindersOverdue: number;
  remindersDueSoon: number;
  /** DD-MM-YYYY label for "today". */
  todayLabel: string;
}

export interface ChatAnswer {
  answer: string;
  refused: boolean;
}

const ROMAN_URDU_HINTS = [
  "kitni",
  "kitne",
  "kitna",
  "hain",
  "hai",
  "aaj",
  "batao",
  "bata",
  "kya",
  "mera",
  "mere",
  "mujhe",
  "karo",
  "chahiye",
  "baki",
  "baqi",
  "kharcha",
  "munafa",
  "faida",
  "wasool",
  "udhaar",
];

function isRomanUrdu(q: string): boolean {
  return ROMAN_URDU_HINTS.some((w) => q.includes(w));
}

function hasAny(q: string, words: string[]): boolean {
  return words.some((w) => q.includes(w));
}

/** Mutation verbs / nouns that must always be refused. Checked FIRST. */
const MUTATION_VERBS = [
  "delete",
  "remove",
  "void",
  "cancel",
  "create",
  "add",
  "new",
  "insert",
  "edit",
  "update",
  "change",
  "correct",
  "refund",
  "delete karo",
  "remove karo",
  "void karo",
  "cancel karo",
  "add karo",
  "create karo",
  "edit karo",
  "update karo",
  "change karo",
  "naya",
  "nayee",
  "nayi",
  "banao",
  "daalo",
  "likho",
  "hatao",
  "mitao",
];

const MUTATION_NOUNS = [
  "payment",
  "record",
  "expense",
  "customer",
  "kharcha",
  "payment ko",
  "record ko",
];

export function answerQuestion(
  question: string,
  snap: ChatSnapshot,
): ChatAnswer {
  const q = question.toLowerCase().trim();
  const urdu = isRomanUrdu(q);

  if (!q) {
    return {
      refused: false,
      answer: urdu
        ? "Sawaal likhein — main pending, aaj ki payment, kharchay ya profit bata sakta hoon."
        : "Type a question — I can tell you the pending total, today's payments, expenses or profit.",
    };
  }

  // --- Refusal: any mutation request. No action is ever taken. ---
  if (
    hasAny(q, MUTATION_VERBS) &&
    (hasAny(q, MUTATION_NOUNS) || hasAny(q, ["payment", "record", "expense", "customer"]))
  ) {
    return {
      refused: true,
      answer: urdu
        ? "Main ye nahi kar sakta. Main sirf parh sakta hoon — record banana, badalna ya delete karna mere kaam mein nahi hai. Payment ya expense ke liye uska apna page use karein."
        : "I can't do that. I'm read-only — I cannot create, edit or delete any record. Please use the relevant page to add or change a payment or expense.",
    };
  }

  // --- Greeting ---
  if (hasAny(q, ["hello", "hi", "salam", "assalam", "aoa"])) {
    return {
      refused: false,
      answer: urdu
        ? "Wa Alaikum Assalam. Main aapke finance records se sawaal ke jawab deta hoon — pending, aaj ki payment, kharchay ya profit pooch sakte hain."
        : "Hello. I answer questions from your finance records — ask me about pending payments, today's payments, expenses or profit.",
    };
  }

  // --- Total pending ---
  if (
    hasAny(q, [
      "pending",
      "baqi",
      "baki",
      "remaining",
      "outstanding",
      "udhaar",
      "due",
      "lena hai",
      "lene hain",
    ])
  ) {
    return {
      refused: false,
      answer: urdu
        ? `Total pending payment ${formatPKR(snap.totalPending)} hai (Ticket, Umrah, Umrah + Ticket aur Tours — sab mila kar, aaj tak).`
        : `Total pending payments are ${formatPKR(snap.totalPending)} (Ticket, Umrah, Umrah + Ticket and Tours combined, as of today).`,
    };
  }

  // --- Payments received today ---
  if (
    hasAny(q, ["today", "aaj"]) &&
    hasAny(q, ["payment", "received", "receive", "wasool", "mili", "mile", "aayi", "aaye"])
  ) {
    return {
      refused: false,
      answer: urdu
        ? `Aaj (${snap.todayLabel}) total ${formatPKR(snap.receivedToday)} payment receive hui hai.`
        : `Today (${snap.todayLabel}) total payments received are ${formatPKR(snap.receivedToday)}.`,
    };
  }

  // --- Total expenses ---
  if (hasAny(q, ["expense", "expenses", "kharcha", "kharchay", "kharche"])) {
    const todayPart = hasAny(q, ["today", "aaj"])
      ? urdu
        ? ` Aaj ka kharcha ${formatPKR(snap.expensesToday)} hai.`
        : ` Today's expenses are ${formatPKR(snap.expensesToday)}.`
      : "";
    return {
      refused: false,
      answer: urdu
        ? `Total expenses ${formatPKR(snap.totalExpenses)} hain (All Time).${todayPart}`
        : `Total expenses are ${formatPKR(snap.totalExpenses)} (All Time).${todayPart}`,
    };
  }

  // --- Current profit ---
  if (hasAny(q, ["profit", "munafa", "faida", "loss", "nuqsan"])) {
    const word = snap.profit >= 0
      ? urdu
        ? "profit"
        : "profit"
      : urdu
        ? "loss"
        : "loss";
    return {
      refused: false,
      answer: urdu
        ? `Current ${word} ${formatPKR(Math.abs(snap.profit))} hai — total received ${formatPKR(snap.totalReceived)} minus total expenses ${formatPKR(snap.totalExpenses)}. Pending isme shamil nahi hai.`
        : `Current ${word} is ${formatPKR(Math.abs(snap.profit))} — total received ${formatPKR(snap.totalReceived)} minus total expenses ${formatPKR(snap.totalExpenses)}. Pending is not included.`,
    };
  }

  // --- Total received ---
  if (hasAny(q, ["received", "receive", "wasool", "total payment", "kitni payment"])) {
    return {
      refused: false,
      answer: urdu
        ? `Total received payment ${formatPKR(snap.totalReceived)} hai (All Time).`
        : `Total payments received are ${formatPKR(snap.totalReceived)} (All Time).`,
    };
  }

  // --- Reminders ---
  if (hasAny(q, ["reminder", "reminders", "yaad", "due date", "overdue"])) {
    return {
      refused: false,
      answer: urdu
        ? `${snap.remindersOverdue} record overdue hain aur ${snap.remindersDueSoon} ki payment agle 7 din mein due hai. Poori list Dashboard par dekhein.`
        : `${snap.remindersOverdue} records are overdue and ${snap.remindersDueSoon} are due within the next 7 days. See the full list on the Dashboard.`,
    };
  }

  // --- Fallback: state clearly what is supported. Never invent a figure. ---
  return {
    refused: false,
    answer: urdu
      ? "Main sirf recorded figures bata sakta hoon — masalan: 'Total pending kitni hai?', 'Aaj kitni payment receive hui?', 'Total expenses kitne hain?', 'Current profit kitna hai?'"
      : "I can only answer from recorded figures — for example: 'What are the total pending payments?', 'How much payment was received today?', 'What are the total expenses?', 'What is the current profit?'",
  };
}
