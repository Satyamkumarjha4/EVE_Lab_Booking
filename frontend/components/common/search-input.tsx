"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Search box that keeps its own text and reports it after a short pause, so each keystroke
 * doesn't rewrite the URL. Remount it (change `key`) to reset it from outside.
 */
export function SearchInput({
  defaultValue,
  onSearch,
  placeholder,
  className,
}: {
  defaultValue: string;
  onSearch: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const onSearchRef = useRef(onSearch);

  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  useEffect(() => {
    if (value === defaultValue) return;
    const timer = setTimeout(() => onSearchRef.current(value), 250);
    return () => clearTimeout(timer);
  }, [value, defaultValue]);

  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-9 bg-card pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            onSearch("");
          }}
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
