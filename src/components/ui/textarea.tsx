import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-md border border-border-subtle bg-background-primary px-3 py-2 text-[15px] text-text-primary placeholder:text-text-secondary focus:border-accent-primary focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
