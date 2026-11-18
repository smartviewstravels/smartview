// Single-admin session handling.
//
// Supabase mode (env configured): the session cookie holds the Supabase
// access token; it is verified with Supabase Auth on every read.
// Local mode (no env): the cookie holds a random token stored in the local
// JSON db (data/db.json), issued after checking the demo admin credentials
// seeded by `npm run seed` (admin@demo.local — clearly fake, local only).
//
// Cookie handling uses Next 16's async cookies() API.

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import {
  isSupabaseConfigured,
  readLocalDb,
  writeLocalDb,
} from "./store";

export const SESSION_COOKIE = "tt_session";

export interface Session {
  userId: string;
  email: string;
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  if (isSupabaseConfigured()) {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return null;
    return { userId: data.user.id, email: data.user.email ?? "" };
  }

  const db = await readLocalDb();
  const found = db.sessions.find((s) => s.token === token);
  if (!found) return null;
  return {
    userId: "local-admin",
    email: db.local_admin?.email ?? "admin@demo.local",
  };
}

/** Redirect to /login when there is no session. Use at the top of pages. */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function passwordsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    secure: process.env.NODE_ENV === "production",
  });
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password)
    return { ok: false, error: "Email and password are required." };

  if (isSupabaseConfigured()) {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await sb.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error || !data.session)
      return { ok: false, error: "Wrong email or password." };
    await setSessionCookie(data.session.access_token);
    return { ok: true };
  }

  // Local demo mode.
  const db = await readLocalDb();
  const admin = db.local_admin;
  if (!admin || admin.email !== cleanEmail)
    return { ok: false, error: "Wrong email or password." };
  const hash = hashPassword(password, admin.salt);
  if (!passwordsEqual(hash, admin.password_hash))
    return { ok: false, error: "Wrong email or password." };
  const token = randomUUID();
  db.sessions.push({ token, created_at: new Date().toISOString() });
  await writeLocalDb(db);
  await setSessionCookie(token);
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && !isSupabaseConfigured()) {
    const db = await readLocalDb();
    db.sessions = db.sessions.filter((s) => s.token !== token);
    await writeLocalDb(db);
  }
  (await cookies()).delete(SESSION_COOKIE);
}
