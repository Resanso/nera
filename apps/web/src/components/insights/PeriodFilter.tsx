"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "../ui/calendar";
import { PERIOD_PRESETS, customPeriod, dateInputValue, presetPeriod, type Period } from "../../lib/period";

const fmt = (d: Date, withYear = false) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", ...(withYear && { year: "numeric" }) }).format(d);

/** "1 Okt – 26 Okt 2026"; the end is clipped to today and shown inclusive. */
export function periodRange(p: Period): string {
  const end = new Date(Math.min(p.to.getTime(), Date.now() + 1) - 1);
  if (p.key === "all") return `Sampai ${fmt(end, true)}`;
  const sameYear = p.from.getFullYear() === end.getFullYear();
  return `${fmt(p.from, !sameYear)} – ${fmt(end, true)}`;
}

/**
 * Mobile period picker: one compact trigger, choices in a bottom sheet (the pattern
 * used by e-wallet and bank transaction histories). Presets show their date range;
 * a custom range opens a calendar view inside the same sheet.
 */
export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E9E5DD] bg-white pl-2.5 pr-2 text-[12px] font-semibold text-[#2F240E] transition-colors hover:bg-[#FFF8E6] active:scale-[0.98]"
      >
        <CalendarDays size={14} className="text-[#A36A00]" />
        {value.key === "custom" ? "Rentang tanggal" : value.label}
        <ChevronDown size={14} className="text-[#A89F90]" />
      </button>
      {open && <PeriodSheet value={value} onClose={() => setOpen(false)} onChange={(p) => (onChange(p), setOpen(false))} />}
    </>
  );
}

function PeriodSheet({ value, onChange, onClose }: { value: Period; onChange: (p: Period) => void; onClose: () => void }) {
  const [target, setTarget] = useState<Element | null>(null);
  const [view, setView] = useState<"presets" | "range">(value.key === "custom" ? "range" : "presets");
  const today = new Date();
  const [range, setRange] = useState<DateRange | undefined>(() =>
    value.key === "custom" ? { from: value.from, to: new Date(value.to.getTime() - 1) } : undefined,
  );
  const custom = range?.from ? customPeriod(dateInputValue(range.from), dateInputValue(range.to ?? range.from)) : null;

  useEffect(() => {
    setTarget(document.querySelector("[data-mobile-frame]") ?? document.body);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!target) return null;

  return createPortal(
    <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-label="Pilih periode">
      <button type="button" aria-label="Tutup" onClick={onClose} className="animate-overlay-in absolute inset-0 h-full w-full bg-[#2F240E]/45 backdrop-blur-[2px]" />
      <div className="animate-sheet-in pointer-events-none absolute inset-x-0 bottom-0 top-12 flex flex-col justify-end px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto max-h-full overflow-y-auto rounded-[26px] bg-white p-3 shadow-[0_-12px_40px_rgba(47,36,14,0.28)]">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#D8D3C9]" />
          <div className="flex items-center gap-1 px-2 pb-2">
            {view === "range" && (
              <button type="button" onClick={() => setView("presets")} aria-label="Kembali" className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full text-[#736B60] hover:bg-[#F7F5F0]">
                <ChevronLeft size={20} />
              </button>
            )}
            <p className="flex-1 text-[15px] font-bold text-[#2F240E]">{view === "range" ? "Rentang tanggal" : "Pilih periode"}</p>
            <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full text-[#736B60] hover:bg-[#F7F5F0]">
              <X size={18} />
            </button>
          </div>

          {view === "presets" ? (
            <ul role="radiogroup" aria-label="Periode">
              {PERIOD_PRESETS.map((preset) => {
                const p = presetPeriod(preset.key);
                const selected = value.key === preset.key;
                return (
                  <li key={preset.key}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChange(p)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${selected ? "bg-[#FFF8E6]" : "hover:bg-[#F7F5F0]"}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-[#2F240E]">{preset.label}</span>
                        <span className="block text-[11px] text-[#736B60]">{periodRange(p)}</span>
                      </span>
                      {selected && <Check size={18} className="shrink-0 text-[#A36A00]" />}
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  role="radio"
                  aria-checked={value.key === "custom"}
                  onClick={() => setView("range")}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${value.key === "custom" ? "bg-[#FFF8E6]" : "hover:bg-[#F7F5F0]"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-[#2F240E]">Rentang tanggal</span>
                    <span className="block text-[11px] text-[#736B60]">{value.key === "custom" ? periodRange(value) : "Pilih tanggal sendiri"}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-[#A89F90]" />
                </button>
              </li>
            </ul>
          ) : (
            <div className="px-1">
              <div className="mb-3 grid grid-cols-2 gap-2">
                <RangeEnd label="Dari" date={range?.from} />
                <RangeEnd label="Sampai" date={range?.to ?? range?.from} />
              </div>
              <Calendar
                mode="range"
                selected={range}
                onSelect={setRange}
                defaultMonth={range?.from ?? today}
                disabled={{ after: today }}
                endMonth={today}
                fixedWeeks
              />
              <button
                type="button"
                disabled={!custom}
                onClick={() => custom && onChange(custom)}
                className="mt-3 h-11 w-full rounded-[14px] bg-[#FFB900] text-sm font-semibold text-[#352500] hover:bg-[#E6A700] disabled:opacity-40"
              >
                {custom ? `Terapkan · ${periodRange(custom)}` : "Pilih tanggal awal"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    target,
  );
}

function RangeEnd({ label, date }: { label: string; date?: Date }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${date ? "border-[#FFB900] bg-[#FFF8E6]" : "border-[#E9E5DD]"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#736B60]">{label}</p>
      <p className="text-[13px] font-semibold text-[#2F240E]">{date ? fmt(date, true) : "–"}</p>
    </div>
  );
}
