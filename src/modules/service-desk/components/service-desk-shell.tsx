"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navigation = [
  { href: "/", label: "Overview", symbol: "⌂" },
  { href: "/new-ticket", label: "Report an issue", symbol: "＋" },
  { href: "/my-tickets", label: "My tickets", symbol: "◫" },
  { href: "/technician", label: "Technician workspace", symbol: "⌁" },
] as const;

export function ServiceDeskShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <div className="app-shell">
      <aside className={`sidebar${menuOpen ? " is-open" : ""}`} aria-label="Service desk">
        <Link
          className="brand-lockup"
          href="/"
          aria-label="Peter Island Resort and Spa IT Service Desk home"
        >
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            <span className="brand-eyebrow">Peter Island Resort</span>
            <span className="brand-name">IT Service Desk</span>
          </span>
        </Link>

        <nav className="nav-list" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                className={`nav-item${active ? " is-active" : ""}`}
                href={item.href}
                key={item.href}
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-symbol" aria-hidden="true">
                  {item.symbol}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <div className="service-status" aria-label="Service monitoring is not connected">
          <span className="status-light unavailable" aria-hidden="true" />
          <div>
            <strong>Status unavailable</strong>
            <small>Monitoring not connected</small>
          </div>
        </div>
        <div className="profile-card is-unavailable" aria-label="Profile unavailable">
          <span className="avatar" aria-hidden="true">
            —
          </span>
          <span>
            <strong>Profile unavailable</strong>
            <small>Authentication not connected</small>
          </span>
        </div>
      </aside>

      <header className="mobile-header">
        <button
          className="icon-button"
          type="button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ☰
        </button>
        <Link className="mobile-brand" href="/">
          IT Service Desk
        </Link>
        <span className="avatar small" aria-label="Profile unavailable">
          —
        </span>
      </header>

      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <button
        className={`scrim${menuOpen ? " is-visible" : ""}`}
        type="button"
        aria-label="Close navigation"
        onClick={() => setMenuOpen(false)}
      />
    </div>
  );
}
