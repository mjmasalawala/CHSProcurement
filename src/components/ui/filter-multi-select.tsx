"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MultiSelectDropdown } from "./multi-select";

// URL-param-driven multi-select filter — same idiom as FilterSelect, but
// stores the chosen values as one comma-separated query param instead of a
// single value.
export function FilterMultiSelect({
  paramName,
  options,
  placeholder,
  className,
}: {
  paramName: string;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get(paramName);
  const selected = raw ? raw.split(",").filter(Boolean) : [];

  function handleChange(next: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length > 0) params.set(paramName, next.join(","));
    else params.delete(paramName);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <MultiSelectDropdown
      options={options.map((o) => ({ id: o.value, label: o.label }))}
      selected={selected}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
}
