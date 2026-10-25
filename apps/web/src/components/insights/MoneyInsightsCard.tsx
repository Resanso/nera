"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
import { NeraOrb } from "../mascot/NeraOrb";
import { emailApi, type MoneyInsights } from "../../lib/emailImport";
import type { Period } from "../../lib/period";

const rp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Math.round(n));

const BAR_COLORS = ["#FFB900", "#E58E00", "#76520E", "#C9A15A", "#E9DCC2", "#B8A88A"];

/**
 * "Ke mana uangku bulan ini?": where this month's outside-BNI money went, from email
 * receipts. The explanation comes from the AI when configured, otherwise from rules;
 * either way only aggregates leave the server.
 */
export function MoneyInsightsCard({ refreshKey, period }: { refreshKey?: number; period?: Period }) {
  const [data, setData] = useState<MoneyInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    emailApi
      .insights(period && period.key !== "this_month" ? period : undefined)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [refreshKey, period?.from.getTime(), period?.to.getTime()]);

  const diff = data && data.lastMonthSamePeriod ? (data.total - data.lastMonthSamePeriod) / data.lastMonthSamePeriod : null;
  const mood = loading ? "thinking" : !data || data.total === 0 ? "wave" : diff !== null && diff > 0.2 ? "alert" : "happy";

  return (
    <section id="insights" className="rounded-[24px] bg-white p-5">
      <div className="flex items-center gap-3">
        <NeraOrb mood={mood} size={56} trackPointer={false} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[#2F240E]">Ke mana uangku {(period?.label ?? "bulan ini").toLowerCase()}?</h3>
          <p className="text-[11px] text-[#736B60]">
            {loading ? "Nera sedang menghitung…" : data?.generatedBy === "ai" ? "Dianalisis AI dari ringkasan, tanpa isi email" : "Analisis otomatis Nera (tanpa AI)"}
          </p>
          {data && !data.aiAllowed && (
            <a href="#consent" className="text-[11px] font-semibold text-[#76520E] underline underline-offset-2">
              Aktifkan bantuan AI untuk analisis lebih personal
            </a>
          )}
        </div>
        <button type="button" onClick={load} aria-label="Hitung ulang" className="rounded-full p-2 text-[#76520E] hover:bg-[#FFF3D6]">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-[#A92F2F]">{error}</p>}

      {data && !loading && (
        <>
          <p className="mt-4 text-[13px] font-semibold leading-relaxed text-[#2F240E]">{data.narrative.summary}</p>

          {data.byCategory.length > 0 && (
            <>
              <div className="mt-4 flex h-2.5 w-full gap-[3px] overflow-hidden rounded-full" role="img" aria-label="Porsi per kategori">
                {data.byCategory.map((c, i) => (
                  <div key={c.category} style={{ width: `${c.share * 100}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                ))}
              </div>
              <ul className="mt-3 space-y-1.5">
                {data.byCategory.slice(0, 5).map((c, i) => (
                  <li key={c.category} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                    <span className="flex-1 text-[#2F240E]">{c.label}</span>
                    <span className="text-[#736B60]">{Math.round(c.share * 100)}%</span>
                    <span className="w-24 text-right font-semibold tabular-nums text-[#2F240E]">{rp(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {data.narrative.insights.length > 0 && (
            <ul className="mt-4 space-y-2">
              {data.narrative.insights.map((t) => (
                <li key={t} className="flex gap-2 text-xs leading-relaxed text-[#2F240E]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFB900]" />
                  {t}
                </li>
              ))}
            </ul>
          )}

          {data.narrative.tips.length > 0 && (
            <div className="mt-4 rounded-[16px] bg-[#FFF8E6] p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#76520E]">Saran Nera</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-[#2F240E]">
                {data.narrative.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>
          )}

          {data.total > 0 && (
            <Link
              href="/recovery?ask=kemana-uangku"
              className="mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-[14px] bg-[#FFB900] text-sm font-semibold text-[#352500] hover:bg-[#E6A700]"
            >
              <MessageCircle size={16} />
              Konsultasi lebih lanjut dengan Nera
            </Link>
          )}
        </>
      )}
    </section>
  );
}
