import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div style={{ maxWidth: 400, margin: "60px auto 0 auto" }}>
      <div className="card">
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <Image
            src="/logo.png"
            alt="Smart View Travel logo"
            width={96}
            height={96}
            style={{ borderRadius: "50%" }}
          />
        </div>
        <h1 style={{ textAlign: "center" }}>Smart View Travel</h1>
        <p className="note" style={{ marginBottom: 16, textAlign: "center" }}>
          Sign in to continue.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
