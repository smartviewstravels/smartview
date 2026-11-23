"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavLinkItem } from "./MobileNav";

// Desktop top navigation. This must be a client component: the active
// pill has to follow client-side navigation instantly, and a server
// layout is NOT re-rendered when the user clicks a link (its state is
// preserved across navigations), so reading the pathname from request
// headers in the layout left the pill stuck on the previous page
// (e.g. "Ticket" stayed highlighted after opening Umrah). usePathname
// re-renders this nav on every route change instead.
export default function TopNav({ links }: { links: NavLinkItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="topnav" aria-label="Main">
      {links.map((link) => (
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
  );
}
