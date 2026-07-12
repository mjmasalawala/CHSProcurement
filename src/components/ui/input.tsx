import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-border-strong bg-background-primary px-3 py-2 text-[15px] text-text-primary placeholder:text-text-tertiary transition-shadow duration-150 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/15 disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-text-tertiary",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
