import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full rounded-md border border-border-subtle bg-background-primary px-3 py-2 text-[15px] text-text-primary focus:border-accent-primary focus:outline-none",
          className,
        )}
        {...props}
      />
    );
  },
);
Select.displayName = "Select";
