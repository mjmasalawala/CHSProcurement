"use client";

import { useEffect, useState } from "react";
import { WorkspaceNav } from "./workspace-nav";

interface NavItem {
  href: string;
  label: string;
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden>
      <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Shared shell for the Society/Vendor/Admin portals — desktop keeps the
 * static left sidebar; below md the nav collapses behind a hamburger button
 * that opens a slide-out drawer (mobile-friendliness pass, 2026-08-05),
 * replacing the old wrapping-pill-row mobile nav.
 */
export function WorkspaceShell({
  title,
  subtitle,
  basePath,
  items,
  children,
}: {
  title: string;
  subtitle?: string;
  basePath: string;
  items: NavItem[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 md:flex-row md:gap-10">
      <aside className="flex shrink-0 flex-col gap-5 md:w-56">
        <div className="flex items-center justify-between gap-3 md:block">
          <div>
            <p className="text-[16px] font-bold tracking-tight text-text-primary">{title}</p>
            {subtitle && <p className="text-[13px] font-medium text-text-secondary">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-strong text-text-primary md:hidden"
          >
            <MenuIcon />
          </button>
        </div>

        <div className="hidden border-r border-border-subtle pr-4 md:block">
          <WorkspaceNav basePath={basePath} items={items} />
        </div>
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-5 overflow-y-auto bg-background-primary p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-bold tracking-tight text-text-primary">{title}</p>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-background-tertiary"
              >
                <span aria-hidden className="text-[20px] leading-none">
                  ×
                </span>
              </button>
            </div>
            <div onClick={() => setDrawerOpen(false)}>
              <WorkspaceNav basePath={basePath} items={items} />
            </div>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
