"use client";

import { useActionState } from "react";
import { signInAction } from "@/app/actions/auth";

type FormState = { ok: boolean; error?: string };

async function submitSignIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return signInAction(formData);
}

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    submitSignIn,
    { ok: false },
  );

  return (
    <form action={formAction}>
      {state.error && <p className="error">{state.error}</p>}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="admin@example.com"
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
