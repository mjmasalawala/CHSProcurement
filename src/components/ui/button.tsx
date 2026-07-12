import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-primary text-white shadow-xs hover:bg-accent-primary-hover disabled:opacity-40 disabled:shadow-none",
  secondary:
    "bg-background-primary text-text-primary border border-border-strong shadow-xs hover:bg-background-secondary disabled:opacity-40 disabled:shadow-none",
  ghost: "bg-transparent text-text-primary hover:bg-background-tertiary disabled:opacity-40",
  danger:
    "bg-status-error text-white shadow-xs hover:opacity-90 disabled:opacity-40 disabled:shadow-none",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "rounded-lg px-4 py-2 text-[15px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/30 disabled:cursor-not-allowed",
          variantClasses[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
