"use client";

import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/client/components/ui/button";
import { Calendar } from "@/client/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/client/components/ui/popover";

export const DATE_VALUE_FORMAT = "yyyy-MM-dd";

function parseDateValue(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = parse(value, DATE_VALUE_FORMAT, new Date());
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function DatePicker({
  value,
  onChange,
  id,
  placeholder = "Pick a date",
  className,
  disabled,
}: DatePickerProps) {
  const date = parseDateValue(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!date}
          className={cn(
            "justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4" />
          {date ? (
            format(date, "PPP")
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          autoFocus
          onSelect={(next) =>
            onChange(next ? format(next, DATE_VALUE_FORMAT) : "")
          }
        />
      </PopoverContent>
    </Popover>
  );
}
