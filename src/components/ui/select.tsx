import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-border-strong bg-background-primary px-3 py-2 text-[15px] text-text-primary transition-shadow duration-150 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/15 disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-text-tertiary",
          className,
        )}
        {...props}
      />
    );
  },
);
Select.displayName = "Select";
