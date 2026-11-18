import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div style={{ maxWidth: 400, margin: "60px auto 0 auto" }}>
      <div className="card">
        <h1 style={{ textAlign: "center" }}>TT Travel &amp; Tour Finance</h1>
        <p className="note" style={{ marginBottom: 16, textAlign: "center" }}>
          Sign in to continue.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
