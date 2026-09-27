"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Option<T extends string> {
  value: T;
  label: string;
}

/** A single-value select over a plain option list. */
export function SelectField<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  /** Accessible name; the visible text is the selected option. */
  label: string;
  className?: string;
}) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <Select
      value={value}
      items={items}
      onValueChange={(next) => {
        if (next !== null) onChange(next as T);
      }}
    >
      <SelectTrigger aria-label={label} className={cn("h-9 bg-card", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
