"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavLinkItem {
  href: string;
  label: string;
}

// Mobile navigation: a hamburger button in the topbar that opens a
// slide-in sidebar with the same links as the desktop topbar
// (Dashboard, Ticket, Umrah, Umrah + Ticket, Tours, Expenses,
// Profit & Loss, AI Chatbot, Customers). The button is hidden on
// desktop by CSS; the sidebar only renders while open.
export default function MobileNav({ links }: { links: NavLinkItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <button
        type="button"
        className="menu-btn"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "✕" : "☰"}
      </button>
      {open && (
        <>
          <div
            className="mobile-overlay"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="mobile-sidebar" aria-label="Menu">
            <div className="mobile-sidebar-head">
              <span className="brand">
                <span className="brand-logo">
                  <Image
                    src="/logo.png"
                    alt="Smart View Travel logo"
                    width={32}
                    height={32}
                  />
                </span>
                Smart View Travel
              </span>
              <button
                type="button"
                className="menu-btn"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            <nav aria-label="Mobile">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActive(link.href) ? "active" : undefined}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
