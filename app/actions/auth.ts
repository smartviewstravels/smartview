'use server';

// Auth actions — thin wrappers around lib/auth.ts.
// Sign-in redirects to / on success and returns an error string on failure.

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";

export async function signInAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const email = typeof formData.get("email") === "string" ? (formData.get("email") as string).trim() : "";
  const password =
    typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";
  const result = await signIn(email, password);
  if (!result.ok) return { ok: false, error: result.error ?? "Wrong email or password." };
  // redirect() throws — this only runs on success.
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}
