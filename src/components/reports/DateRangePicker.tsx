import { useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const presets = [
  { key: "this_month", get: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { key: "last_month", get: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { key: "last_3", get: () => ({ from: startOfMonth(subMonths(new Date(), 2)), to: new Date() }) },
  { key: "last_6", get: () => ({ from: startOfMonth(subMonths(new Date(), 5)), to: new Date() }) },
  { key: "last_12", get: () => ({ from: startOfMonth(subMonths(new Date(), 11)), to: new Date() }) },
  { key: "last_90", get: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
];

const presetLabels: Record<string, Record<string, string>> = {
  this_month: { en: "This Month", ur: "اس مہینے" },
  last_month: { en: "Last Month", ur: "پچھلا مہینہ" },
  last_3: { en: "3 Months", ur: "3 مہینے" },
  last_6: { en: "6 Months", ur: "6 مہینے" },
  last_12: { en: "12 Months", ur: "12 مہینے" },
  last_90: { en: "90 Days", ur: "90 دن" },
};

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const { t, language } = useLanguage();
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Popover open={fromOpen} onOpenChange={setFromOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal", !value.from && "text-muted-foreground")}>
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {format(value.from, "dd MMM yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value.from}
              onSelect={(d) => { if (d) { onChange({ from: d, to: value.to < d ? d : value.to }); setFromOpen(false); } }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <span className="text-muted-foreground text-sm">→</span>
        <Popover open={toOpen} onOpenChange={setToOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal", !value.to && "text-muted-foreground")}>
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {format(value.to, "dd MMM yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value.to}
              onSelect={(d) => { if (d) { onChange({ from: value.from > d ? d : value.from, to: d }); setToOpen(false); } }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <Button key={p.key} variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange(p.get())}>
            {presetLabels[p.key]?.[language] || p.key}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function useDefaultDateRange(): DateRange {
  return { from: startOfMonth(new Date()), to: new Date() };
}
