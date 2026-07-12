import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "warning" | "error" | "info" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-status-success-bg text-status-success border-status-success-border",
  warning: "bg-status-warning-bg text-status-warning border-status-warning-border",
  error: "bg-status-error-bg text-status-error border-status-error-border",
  info: "bg-status-info-bg text-status-info border-status-info-border",
  neutral: "bg-status-neutral-bg text-status-neutral border-status-neutral-border",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/**
 * Colored-and-bordered status pill (theme-and-design-system.md Section 3's
 * status tokens) — the single place any raw status string should render
 * through, so "Approved"/"Active"/"Won" etc. always look the same wherever
 * they appear. Pair with statusTone()/statusLabel() from
 * src/lib/status-badge.ts for the common enum values.
 */
export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
