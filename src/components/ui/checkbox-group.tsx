import { cn } from "@/lib/utils";

interface CheckboxGroupProps {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
  // Once this many are selected, unselected options disable rather than
  // silently doing nothing on click — e.g. vendor service areas, capped at 5.
  max?: number;
}

export function CheckboxGroup({ options, selected, onChange, className, max }: CheckboxGroupProps) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
      return;
    }
    if (max && selected.length >= max) return;
    onChange([...selected, id]);
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        const disabled = !isSelected && !!max && selected.length >= max;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => toggle(option.id)}
            aria-pressed={isSelected}
            disabled={disabled}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
              isSelected
                ? "border-accent-primary bg-accent-primary text-white shadow-xs"
                : disabled
                  ? "cursor-not-allowed border-border-subtle bg-background-secondary text-text-tertiary"
                  : "border-border-strong bg-background-primary text-text-primary hover:bg-background-secondary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
