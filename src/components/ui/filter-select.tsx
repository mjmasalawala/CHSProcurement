"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "./select";

// URL-param-driven filter dropdown — same idiom as SearchInput, but for a
// single-value select instead of debounced text. Changing it replaces one
// query param and leaves every other param (search text, other filters,
// status tab) untouched.
export function FilterSelect({
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
  const value = searchParams.get(paramName) ?? "";

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set(paramName, next);
    else params.delete(paramName);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      aria-label={placeholder}
      className={className}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
