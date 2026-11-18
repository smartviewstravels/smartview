// Seed script — clearly-fake DEMO data only, local JSON store only.
//   npm run seed            seeds data/db.json (refuses if already seeded)
//   npm run seed -- --force  wipes data/db.json first, then seeds
//
// Creates the local demo admin (admin@demo.local / demo1234 — local mode
// only, never used when Supabase is configured), 5 demo customers, one
// record per type (ticket / umrah / combined / tour) with payments, and
// 4 demo expenses. No real people, no real money. Dependency-free plain node.

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes, randomUUID, scryptSync } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "db.json");

const DEMO_EMAIL = "admin@demo.local";
const DEMO_PASSWORD = "demo1234";

function todayPKT() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function emptyDb() {
  return {
    customers: [],
    finance_records: [],
    payments: [],
    expenses: [],
    profiles: [],
    local_admin: null,
    sessions: [],
  };
}

async function readDb() {
  try {
    return { ...emptyDb(), ...JSON.parse(await fs.readFile(DB_PATH, "utf-8")) };
  } catch {
    return emptyDb();
  }
}

const now = () => new Date().toISOString();

function customer(name, phone) {
  return { id: randomUUID(), name, phone, cnic_passport: "00000-0000000-0", created_at: now(), updated_at: now() };
}

function record(customer_id, type, fields) {
  return {
    id: randomUUID(),
    customer_id,
    type,
    tour_name: null,
    total_amount: 0,
    umrah_amount: null,
    ticket_amount: null,
    next_payment_date: null,
    status: "open",
    created_at: now(),
    updated_at: now(),
    ...fields,
  };
}

function payment(finance_record_id, amount, payment_date, method = "Cash") {
  return {
    id: randomUUID(),
    finance_record_id,
    amount,
    payment_date,
    method,
    reference: null,
    note: null,
    status: "active",
    void_reason: null,
    voided_at: null,
    created_at: now(),
  };
}

function expense(name, amount, expense_date, category) {
  return {
    id: randomUUID(),
    name,
    amount,
    expense_date,
    category,
    description: "Demo expense — not real.",
    created_at: now(),
  };
}

async function main() {
  const force = process.argv.includes("--force");
  const existing = await readDb();
  const alreadySeeded =
    existing.local_admin ||
    existing.customers.length > 0 ||
    existing.finance_records.length > 0 ||
    existing.payments.length > 0 ||
    existing.expenses.length > 0;
  if (alreadySeeded && !force) {
    console.error(
      "data/db.json already has data. Refusing to seed twice.\n" +
        "Run `npm run seed -- --force` to wipe it and re-seed.",
    );
    process.exit(1);
  }

  const today = todayPKT();
  const salt = randomBytes(16).toString("hex");

  const db = emptyDb();
  db.local_admin = {
    email: DEMO_EMAIL,
    password_hash: scryptSync(DEMO_PASSWORD, salt, 64).toString("hex"),
    salt,
  };

  const [ahmed, bilal, sana, usman, hina] = [
    customer("Demo Customer Ahmed", "0300-0000001"),
    customer("Demo Customer Bilal", "0300-0000002"),
    customer("Demo Customer Sana", "0300-0000003"),
    customer("Demo Customer Usman", "0300-0000004"),
    customer("Demo Customer Hina", "0300-0000005"),
  ];
  db.customers.push(ahmed, bilal, sana, usman, hina);

  const ticket = record(ahmed.id, "ticket", {
    total_amount: 100000,
    next_payment_date: addDays(today, 3), // due soon -> in reminders
  });
  const umrah = record(bilal.id, "umrah", {
    total_amount: 250000,
    next_payment_date: addDays(today, -2), // overdue -> in reminders
  });
  const combined = record(sana.id, "combined", {
    total_amount: 100000,
    umrah_amount: 80000,
    ticket_amount: 20000,
    next_payment_date: addDays(today, 5),
  });
  const tour = record(usman.id, "tour", {
    tour_name: "Demo Tour Lahore",
    total_amount: 150000,
    next_payment_date: addDays(today, 10), // outside the 7-day window
  });
  db.finance_records.push(ticket, umrah, combined, tour);

  db.payments.push(
    payment(ticket.id, 40000, today, "Cash"),
    payment(umrah.id, 100000, addDays(today, -2), "Bank Transfer"),
    payment(combined.id, 25000, today, "Cash"),
    payment(tour.id, 50000, addDays(today, -1), "Bank Transfer"),
  );

  db.expenses.push(
    expense("Demo Office Rent", 5000, today, "Office"),
    expense("Demo Transport", 2000, today, "Transport"),
    expense("Demo Marketing", 3000, addDays(today, -1), "Marketing"),
    expense("Demo Staff Tea", 1500, addDays(today, -1), "Staff"),
  );

  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");

  console.log("Seeded demo data into data/db.json:");
  console.log(`  admin: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (local mode only)`);
  console.log(`  customers: ${db.customers.length}`);
  console.log(`  records: ${db.finance_records.length} (ticket, umrah, combined, tour)`);
  console.log(`  payments: ${db.payments.length}`);
  console.log(`  expenses: ${db.expenses.length}`);
  console.log("Demo figures: ticket received 40,000 / pending 60,000; combined received 25,000 / pending 75,000.");
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
