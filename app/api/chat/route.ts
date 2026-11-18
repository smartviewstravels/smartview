// Chat API — POST { question } -> { answer, refused }.
// Read-only: builds a snapshot from LIVE records and calls the rule-based
// chatbot in lib/chatbot.ts. It never writes anything. Requires a session
// (401 when logged out).

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { computeTotals, getReminders, withTotals } from "@/lib/calc";
import { answerQuestion, type ChatSnapshot } from "@/lib/chatbot";
import { formatDate, todayPKT } from "@/lib/format";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let question = "";
  try {
    const body = (await request.json()) as { question?: unknown };
    if (typeof body.question === "string") question = body.question;
  } catch {
    return NextResponse.json(
      { error: "Send JSON like { \"question\": \"...\" }." },
      { status: 400 },
    );
  }

  const store = getStore();
  const [records, customers, payments, expenses] = await Promise.all([
    store.listRecords(),
    store.listCustomers(),
    store.listPayments(),
    store.listExpenses(),
  ]);

  // withTotals types its customer map loosely ({ name } & Record);
  // Customer satisfies it at runtime — cast at the boundary (lib is frozen).
  const customersById = new Map(
    customers.map(
      (c) => [c.id, c as unknown as { name: string } & Record<string, unknown>],
    ),
  );
  const paymentsByRecord = new Map<string, typeof payments>();
  for (const p of payments) {
    const list = paymentsByRecord.get(p.finance_record_id) ?? [];
    list.push(p);
    paymentsByRecord.set(p.finance_record_id, list);
  }
  const recordsWithTotals = withTotals(records, customersById, paymentsByRecord);

  const totalsAll = computeTotals(recordsWithTotals, payments, expenses, "all");
  const totalsToday = computeTotals(recordsWithTotals, payments, expenses, "today");
  const reminders = getReminders(recordsWithTotals);

  const snapshot: ChatSnapshot = {
    totalPending: totalsAll.totalPending,
    totalReceived: totalsAll.totalReceived,
    totalExpenses: totalsAll.totalExpenses,
    profit: totalsAll.profit,
    receivedToday: totalsToday.totalReceived,
    expensesToday: totalsToday.totalExpenses,
    remindersOverdue: reminders.filter((r) => r.overdue).length,
    remindersDueSoon: reminders.filter((r) => !r.overdue).length,
    todayLabel: formatDate(todayPKT()),
  };

  return NextResponse.json(answerQuestion(question, snapshot));
}
