"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { PERIOD_PRESETS, customPeriod, dateInputValue, presetPeriod, type Period } from "../../lib/period";

/** Preset chips plus a custom date range; applies to stats, insights and the transaction list. */
export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const [showCustom, setShowCustom] = useState(value.key === "custom");
  const [from, setFrom] = useState(dateInputValue(value.from));
  const [to, setTo] = useState(dateInputValue(new Date(value.to.getTime() - 1)));
  const custom = customPeriod(from, to);

  return (
    <div className="rounded-[20px] bg-white p-3">
      <div className="flex flex-wrap gap-1.5">
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setShowCustom(false);
              onChange(presetPeriod(p.key));
            }}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
              value.key === p.key ? "bg-[#2F240E] text-white" : "bg-[#F7F7F7] text-[#2F240E]"
            }`}
          >
            {p.short}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          aria-expanded={showCustom}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
            value.key === "custom" ? "bg-[#2F240E] text-white" : "bg-[#F7F7F7] text-[#2F240E]"
          }`}
        >
          <CalendarRange size={13} />
          Tanggal
        </button>
      </div>

      {showCustom && (
        <div className="mt-2.5 flex flex-wrap items-end gap-2">
          <label className="flex-1 text-[10px] font-semibold text-[#736B60]">
            Dari
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-[#E9E5DD] bg-white px-2.5 py-1.5 text-xs text-[#2F240E]"
            />
          </label>
          <label className="flex-1 text-[10px] font-semibold text-[#736B60]">
            Sampai
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-[#E9E5DD] bg-white px-2.5 py-1.5 text-xs text-[#2F240E]"
            />
          </label>
          <button
            type="button"
            disabled={!custom}
            onClick={() => custom && onChange(custom)}
            className="h-[34px] rounded-xl bg-[#FFB900] px-3 text-xs font-semibold text-[#352500] disabled:opacity-40"
          >
            Terapkan
          </button>
        </div>
      )}
    </div>
  );
}
