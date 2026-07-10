import { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface WizardShellProps {
  step: number;
  totalSteps: number;
  title: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  className?: string;
}

/**
 * theme-and-design-system.md Section 4 — shared shell for every multi-field
 * form (registration, requirement creation, etc). Steps hold 2-4 fields each;
 * callers own field state and validation, this just renders the frame.
 */
export function WizardShell({
  step,
  totalSteps,
  title,
  children,
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Next",
  className,
}: WizardShellProps) {
  return (
    <div className={cn("mx-auto w-full max-w-lg", className)}>
      <div className="mb-6">
        <p className="mb-2 text-[13px] text-text-secondary">
          Step {step} of {totalSteps}
        </p>
        <div className="h-1.5 w-full rounded-full bg-background-secondary">
          <div
            className="h-1.5 rounded-full bg-accent-primary transition-all"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <h2 className="mb-4 text-[18px] font-semibold text-text-primary">{title}</h2>

      <div className="mb-8 flex flex-col gap-4">{children}</div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={!onBack || step === 1}
        >
          Back
        </Button>
        {onNext && (
          <Button type="button" onClick={onNext} disabled={nextDisabled}>
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
