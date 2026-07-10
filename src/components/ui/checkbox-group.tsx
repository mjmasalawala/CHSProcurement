import { cn } from "@/lib/utils";

interface CheckboxGroupProps {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

export function CheckboxGroup({ options, selected, onChange, className }: CheckboxGroupProps) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => toggle(option.id)}
            aria-pressed={isSelected}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
              isSelected
                ? "border-accent-primary bg-accent-primary text-white"
                : "border-border-subtle bg-background-primary text-text-primary hover:bg-background-secondary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
