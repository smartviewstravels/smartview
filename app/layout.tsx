import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { signOutAction } from "@/app/actions/auth";
import MobileNav from "@/components/MobileNav";
import TopNav from "@/components/TopNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart View Travel",
  description: "Finance records for Smart View Travel: tickets, Umrah, tours, expenses and profit & loss.",
  metadataBase: new URL("https://smartview-ebon.vercel.app"),
  icons: { icon: "/logo.png" },
  openGraph: {
    title: "Smart View Travel",
    description: "Finance records for Smart View Travel: tickets, Umrah, tours, expenses and profit & loss.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Smart View Travel",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Smart View Travel",
    description: "Finance records for Smart View Travel: tickets, Umrah, tours, expenses and profit & loss.",
    images: ["/opengraph-image.png"],
  },
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
  { href: "/chat", label: "AI Chatbot" },
  { href: "/tickets", label: "Ticket" },
  { href: "/umrah", label: "Umrah" },
  { href: "/combined", label: "Umrah + Ticket" },
  { href: "/tours", label: "Tours" },
  { href: "/expenses", label: "Expenses" },
  { href: "/profit-loss", label: "Profit & Loss" },
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

  // The desktop nav is a client component (TopNav) that reads the
  // pathname with usePathname, so its active pill follows client-side
  // navigation instantly. The header pathname below is only for the
  // login guard above, not for the nav highlight.
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <MobileNav links={NAV_LINKS} />
            <Link href="/" className="brand">
              <span className="brand-logo">
                <Image
                  src="/logo.png"
                  alt="Smart View Travel logo"
                  width={32}
                  height={32}
                />
              </span>
              Smart View Travel
            </Link>
            <TopNav links={NAV_LINKS} />
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
