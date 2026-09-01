"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AccessProfile } from "@/server/auth/access";
import { hasPermission } from "@/modules/auth/authorization";

const navigation = [
  { href: "/", label: "Overview", symbol: "⌂" },
  { href: "/new-ticket", label: "Report an issue", symbol: "＋", permission: "ticket.submit" },
  { href: "/my-tickets", label: "My tickets", symbol: "◫", permission: "ticket.read.own" },
  {
    href: "/technician",
    label: "Technician workspace",
    symbol: "⌁",
    permission: "ticket.queue.read",
  },
] as const;

export function ServiceDeskShell({
  children,
  access,
}: Readonly<{ children: React.ReactNode; access: AccessProfile }>) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const authorizationSubject = {
    userId: access.userId,
    organizationId: access.organizationId,
    propertyIds: access.properties.map((property) => property.id),
    departmentIds: access.departmentIds,
    roles: access.roles,
  };

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
          {navigation
            .filter(
              (item) =>
                !("permission" in item) || hasPermission(authorizationSubject, item.permission),
            )
            .map((item) => {
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
        {hasPermission(authorizationSubject, "user.manage") ||
        hasPermission(authorizationSubject, "audit.read") ? (
          <div className="nav-list admin-navigation" aria-label="Administration">
            {hasPermission(authorizationSubject, "user.manage") ? (
              <Link
                className={`nav-item${pathname === "/admin/users/new" ? " is-active" : ""}`}
                href="/admin/users/new"
              >
                <span className="nav-symbol" aria-hidden="true">
                  ⚙
                </span>
                <span>User administration</span>
              </Link>
            ) : null}
            {hasPermission(authorizationSubject, "audit.read") ? (
              <Link
                className={`nav-item${pathname === "/admin/audit" ? " is-active" : ""}`}
                href="/admin/audit"
              >
                <span className="nav-symbol" aria-hidden="true">
                  ≡
                </span>
                <span>Audit trail</span>
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="sidebar-spacer" />
        <div className="service-status" aria-label="Service monitoring is not connected">
          <span className="status-light unavailable" aria-hidden="true" />
          <div>
            <strong>Status unavailable</strong>
            <small>Monitoring not connected</small>
          </div>
        </div>
        <div className="profile-card">
          <span className="avatar" aria-hidden="true">
            {access.displayName
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </span>
          <span>
            <strong>{access.displayName}</strong>
            <small>{access.properties[0]?.name}</small>
          </span>
        </div>
        <form action="/auth/logout" method="post">
          <button className="nav-item sign-out-button" type="submit">
            Sign out
          </button>
        </form>
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
          {access.displayName.charAt(0).toUpperCase()}
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
