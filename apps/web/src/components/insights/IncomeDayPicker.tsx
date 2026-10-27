"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Calendar } from "../ui/calendar";
import { nextIncome } from "../../lib/period";

const fmt = (d: Date) => d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

/**
 * When the monthly income arrives: the user picks the next date it comes on Nera's calendar
 * and the day of the month is kept, so it repeats every month.
 */
export function IncomeDayPicker({ value, onChange }: { value: number | null; onChange: (day: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const next = value ? nextIncome(value).date : undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
          open ? "border-[#76520E]" : "border-[#E9E5DD] hover:border-[#C9C2B6]"
        }`}
      >
        <CalendarDays size={18} className="shrink-0 text-[#A36A00]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-[#736B60]">Biasanya masuk</span>
          <span className="block text-[14px] font-semibold tabular-nums text-[#2F240E]">
            {value && next ? `Tiap tanggal ${value} · berikutnya ${fmt(next)}` : "Pilih tanggal"}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-[#A89F90] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="rounded-[18px] border border-[#E9E5DD] p-3">
          <p className="mb-2 text-[11px] text-[#736B60]">Pilih kapan pemasukan berikutnya masuk. Nera mengulanginya tiap bulan.</p>
          <Calendar
            mode="single"
            selected={next}
            onSelect={(d) => {
              if (!d) return;
              onChange(d.getDate());
              setOpen(false);
            }}
            defaultMonth={next ?? today}
            startMonth={today}
            endMonth={lastMonth}
            disabled={{ before: today }}
            fixedWeeks
            classNames={{ selected: "[&>button]:bg-[#FFB900] [&>button]:font-bold [&>button]:text-[#352500] [&>button]:hover:bg-[#FFB900]" }}
          />
          {value !== null && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="mt-2 h-10 w-full rounded-[12px] text-[13px] font-semibold text-[#736B60] hover:bg-[#F7F5F0]"
            >
              Belum tahu tanggalnya
            </button>
          )}
        </div>
      )}
    </div>
  );
}
