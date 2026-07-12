import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Resolves conflicting Tailwind classes (e.g. a caller passing
 * `border-status-warning-border` to override a component's default
 * `border-border-subtle`) deterministically by property, instead of
 * depending on Tailwind's generated-CSS source order.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
