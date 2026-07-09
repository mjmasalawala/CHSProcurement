import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-md border border-border-subtle bg-background-primary px-3 py-2 text-[15px] text-text-primary placeholder:text-text-secondary focus:border-accent-primary focus:outline-none",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
