"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarIcon, ChevronRightIcon, XIcon } from "@nera/ui/icons";
import { Calendar } from "../ui/calendar";
import { nextIncome } from "../../lib/period";

const fmt = (d: Date) => d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

/**
 * When the monthly income arrives: the user picks the next date it comes on Nera's calendar
 * (in a bottom sheet over the form) and the day of the month is kept, so it repeats.
 */
export function IncomeDayPicker({ value, onChange }: { value: number | null; onChange: (day: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const next = value ? nextIncome(value).date : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex w-full items-center gap-2.5 rounded-xl border border-[#E9E5DD] px-3 py-2.5 text-left transition-colors hover:border-[#C9C2B6]"
      >
        <CalendarIcon size={18} className="shrink-0 text-[#A36A00]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-[#736B60]">Biasanya masuk</span>
          <span className="block text-[14px] font-semibold tabular-nums text-[#2F240E]">
            {value && next ? `Tiap tanggal ${value} · berikutnya ${fmt(next)}` : "Pilih tanggal"}
          </span>
        </span>
        <ChevronRightIcon size={18} className="shrink-0 text-[#A89F90]" />
      </button>
      {open && (
        <IncomeDaySheet
          value={value}
          next={next}
          onClose={() => setOpen(false)}
          onChange={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function IncomeDaySheet({
  value,
  next,
  onChange,
  onClose,
}: {
  value: number | null;
  next?: Date;
  onChange: (day: number | null) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<Element | null>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    setTarget(document.querySelector("[data-mobile-frame]") ?? document.body);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!target) return null;

  // above the Saldo sheet it is opened from (z-50)
  return createPortal(
    <div className="absolute inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Tanggal pemasukan">
      <button type="button" aria-label="Tutup" onClick={onClose} className="animate-overlay-in absolute inset-0 h-full w-full bg-[#2F240E]/45 backdrop-blur-[2px]" />
      <div className="animate-sheet-in pointer-events-none absolute inset-x-0 bottom-0 top-12 flex flex-col justify-end px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto max-h-full overflow-y-auto overscroll-contain rounded-[26px] bg-white p-3 shadow-[0_-12px_40px_rgba(47,36,14,0.28)]">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#D8D3C9]" />
          <div className="flex items-center gap-1 px-2 pb-1">
            <p className="flex-1 text-[15px] font-bold text-[#2F240E]">Kapan pemasukan masuk?</p>
            <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full text-[#736B60] hover:bg-[#F7F5F0]">
              <XIcon size={18} />
            </button>
          </div>
          <p className="px-2 pb-3 text-[12px] text-[#736B60]">Pilih tanggal masuk berikutnya. Nera mengulanginya tiap bulan.</p>
          <div className="px-1">
            <Calendar
              mode="single"
              selected={next}
              onSelect={(d) => d && onChange(d.getDate())}
              defaultMonth={next ?? today}
              startMonth={today}
              endMonth={new Date(today.getFullYear(), today.getMonth() + 1, 1)}
              disabled={{ before: today }}
              fixedWeeks
              classNames={{ selected: "[&>button]:bg-[#FFB900] [&>button]:font-bold [&>button]:text-[#352500] [&>button]:hover:bg-[#FFB900]" }}
            />
          </div>
          {value !== null && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="mt-2 h-11 w-full rounded-[14px] text-[13px] font-semibold text-[#736B60] hover:bg-[#F7F5F0]"
            >
              Belum tahu tanggalnya
            </button>
          )}
        </div>
      </div>
    </div>,
    target,
  );
}
