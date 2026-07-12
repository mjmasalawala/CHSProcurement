"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

/**
 * Shared nav for the Society/Vendor/Admin workspace shells — highlights the
 * active section against the current route. Renders as a left sidebar list
 * on md+ screens and a horizontal pill row on mobile (Office Bearers approve
 * from a phone — theme-and-design-system.md Section 5), sharing the same
 * active-state logic either way.
 */
export function WorkspaceNav({
  items,
  basePath,
  orientation = "horizontal",
}: {
  items: NavItem[];
  basePath: string;
  orientation?: "horizontal" | "vertical";
}) {
  const pathname = usePathname();

  if (orientation === "vertical") {
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

  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => {
        const isActive = item.href === basePath ? pathname === basePath : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              isActive
                ? "bg-accent-primary text-white shadow-xs"
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
