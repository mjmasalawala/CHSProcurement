"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

/**
 * Shared nav list for the Society/Vendor/Admin workspace shells (see
 * WorkspaceShell) — same markup whether it's rendered in the desktop sidebar
 * or the mobile drawer, highlighting the active section against the current
 * route.
 */
export function WorkspaceNav({ items, basePath }: { items: NavItem[]; basePath: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const isActive = item.href === basePath ? pathname === basePath : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-[14px] font-semibold transition-colors",
              isActive
                ? "bg-accent-subtle text-accent-primary"
                : "text-text-secondary hover:bg-background-tertiary hover:text-text-primary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
