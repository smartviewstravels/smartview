import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { signOutAction } from "@/app/actions/auth";
import MobileNav from "@/components/MobileNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "TT Travel & Tour Finance",
  description: "Finance records for TT Travel & Tour: tickets, Umrah, tours, expenses and profit & loss.",
};

// Every page in this app reads the session cookie (requireAdmin /
// getSession), so no route can prerender instantly. With cacheComponents
// enabled, `instant = false` marks the app as allowed to block on that
// session check instead of failing the prerender. (The old
// `dynamic = "force-dynamic"` segment config is not compatible with
// cacheComponents and must not be used.)
export const instant = false;

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/tickets", label: "Ticket" },
  { href: "/umrah", label: "Umrah" },
  { href: "/combined", label: "Umrah + Ticket" },
  { href: "/tours", label: "Tours" },
  { href: "/expenses", label: "Expenses" },
  { href: "/profit-loss", label: "Profit & Loss" },
  { href: "/chat", label: "AI Chatbot" },
  { href: "/customers", label: "Customers" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  if (!session) {
    // Guard: every page except /login needs a session. The pathname is read
    // from the request headers when Next provides it (client navigation sends
    // `next-url`); when it is not available, the page itself enforces the
    // guard with requireAdmin(), and /login renders without a session.
    const hdrs = await headers();
    const pathname =
      hdrs.get("x-pathname") ?? hdrs.get("next-url") ?? hdrs.get("x-invoke-path") ?? "";
    const cleanPath = pathname.split("?")[0];
    if (cleanPath && cleanPath !== "/login" && !cleanPath.startsWith("/login/")) {
      redirect("/login");
    }
    return (
      <html lang="en">
        <body>
          <main className="page">{children}</main>
        </body>
      </html>
    );
  }

  // Active nav pill, from the same request headers used for the login
  // guard above. Falls back to no active link when no pathname header
  // is present (e.g. client navigation without next-url).
  const hdrs = await headers();
  const currentPath = (
    hdrs.get("x-pathname") ?? hdrs.get("next-url") ?? hdrs.get("x-invoke-path") ?? ""
  ).split("?")[0];
  const isActive = (href: string) =>
    href === "/"
      ? currentPath === "/"
      : currentPath === href || currentPath.startsWith(href + "/");

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <MobileNav links={NAV_LINKS} />
            <Link href="/" className="brand">
              TT Travel &amp; Tour Finance
            </Link>
            <nav className="topnav" aria-label="Main">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActive(link.href) ? "active" : undefined}
                  aria-current={isActive(link.href) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="topbar-right">
              <form action={signOutAction}>
                <button type="submit" className="btn btn-small btn-header">
                  Logout
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
