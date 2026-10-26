"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, CalendarDays, X } from "lucide-react";
import type { BudgetPocket, BudgetPocketIcon, BudgetPocketTone } from "@nera/core";
import { NeraOrb } from "../mascot/NeraOrb";
import { dueLabel, planProfile, type ProfileDraft, type ProfilePlan } from "../../lib/pocketProfile";

const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;

const STARTERS = ["Diajak teman AYCE 200rb hari Sabtu", "Nonton konser 350rb bulan depan", "Kado ultah teman 150rb lusa"];

const VERDICT = {
  ringan: { label: "Ringan", className: "bg-[#E3F3E9] text-[#277449]" },
  pas: { label: "Pas", className: "bg-[#FFF3D6] text-[#76520E]" },
  berat: { label: "Berat", className: "bg-[#FBEDED] text-[#A92F2F]" },
} as const;

type Msg = { role: "user" | "assistant"; content: string; draft?: ProfileDraft | null };

type Money = { main: number; pockets: BudgetPocket[]; dailyBudgetSafe: number; monthlyAllowance: number; balancesKnown: boolean };

/**
 * "Rencana dadakan": the user tells Nera about something coming up, Nera reads what, how
 * much and when, and proposes a pocket for it with a plan that adds up. Changing the plan is
 * just another message ("jadi 250rb", "acaranya Jumat").
 */
export function PocketProfileSheet({
  money,
  icons,
  tones,
  onCreate,
  onClose,
}: {
  money: Money;
  icons: Record<BudgetPocketIcon, React.ElementType>;
  tones: Record<BudgetPocketTone, { card: string; iconWrap: string; icon: string; title: string; muted: string }>;
  onCreate: (plan: ProfilePlan) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<Element | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTarget(document.querySelector("[data-mobile-frame]") ?? document.body);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  if (!target) return null;

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/assistant/pocket-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const body = (await res.json()) as { reply?: string; draft?: ProfileDraft | null; error?: string };
      if (!res.ok || !body.reply) throw new Error(body.error ?? "Nera belum bisa menjawab");
      setMessages([...next, { role: "assistant", content: body.reply, draft: body.draft ?? null }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // only the latest proposal can be taken; earlier ones stay as part of the conversation
  const latestDraftAt = messages.reduce((at, m, i) => (m.draft ? i : at), -1);

  return createPortal(
    <div className="absolute inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Rencana dadakan">
      <button type="button" aria-label="Tutup" onClick={onClose} className="animate-overlay-in absolute inset-0 h-full w-full bg-[#2F240E]/45 backdrop-blur-[2px]" />
      <div className="animate-sheet-in pointer-events-none absolute inset-x-0 bottom-0 top-12 flex flex-col justify-end px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex h-full max-h-full flex-col rounded-[26px] bg-white shadow-[0_-12px_40px_rgba(47,36,14,0.28)]">
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[#D8D3C9]" />
          <div className="flex shrink-0 items-center gap-2.5 border-b border-[#F1EEE8] px-4 pb-3 pt-2">
            <NeraOrb mood="happy" size={36} still trackPointer={false} />
            <div className="min-w-0 flex-1">
              <h2 className="text-[16px] font-bold text-[#2F240E]">Rencana dadakan</h2>
              <p className="truncate text-[11px] text-[#736B60]">Cerita ke Nera, nanti dibuatkan kantongnya</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-9 w-9 items-center justify-center rounded-full text-[#736B60] hover:bg-[#F7F5F0]">
              <X size={18} />
            </button>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
            <Bubble from="nera">
              Ada ajakan mendadak? Ceritakan saja acaranya, butuh berapa, dan kapan. Nera susun kantong supaya uangnya siap tepat waktu.
            </Bubble>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-1.5 pl-1">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-[#E9E5DD] bg-white px-3 py-1.5 text-left text-[12px] font-medium text-[#2F240E] hover:bg-[#FFF8E6]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <Bubble key={i} from="user">
                  {m.content}
                </Bubble>
              ) : (
                <div key={i} className="space-y-2">
                  <Bubble from="nera">{m.content}</Bubble>
                  {m.draft && (
                    <ProfileCard
                      plan={planProfile(m.draft, money)}
                      balancesKnown={money.balancesKnown}
                      icons={icons}
                      tones={tones}
                      active={i === latestDraftAt}
                      onCreate={onCreate}
                    />
                  )}
                </div>
              ),
            )}
            {busy && (
              <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-[#F7F5F0] px-3.5 py-3" aria-label="Nera sedang mengetik">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#A89F90]" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            )}
            {error && <p className="text-[12px] text-[#A92F2F]">{error}. Coba kirim lagi.</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex shrink-0 items-center gap-2 border-t border-[#F1EEE8] p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={latestDraftAt >= 0 ? "Ubah, misal: jadi 250rb" : "Diajak AYCE 200rb hari Sabtu"}
              aria-label="Pesan untuk Nera"
              maxLength={300}
              className="h-11 min-w-0 flex-1 rounded-full bg-[#F1F2F4] px-4 text-[14px] text-[#2F240E] placeholder:text-[#9A938A] focus:bg-white focus:outline-2 focus:outline-[#BA8500]"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              aria-label="Kirim"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFB900] text-[#352500] transition-transform duration-150 hover:bg-[#E6A700] active:scale-[0.96] disabled:opacity-40"
            >
              <ArrowUp size={19} strokeWidth={2.4} />
            </button>
          </form>
        </div>
      </div>
    </div>,
    target,
  );
}

function Bubble({ from, children }: { from: "nera" | "user"; children: React.ReactNode }) {
  return from === "user" ? (
    <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#2F240E] px-3.5 py-2.5 text-[13px] leading-relaxed text-white">{children}</p>
  ) : (
    <p className="w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-[#F7F5F0] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#2F240E]">{children}</p>
  );
}

function ProfileCard({
  plan,
  balancesKnown,
  icons,
  tones,
  active,
  onCreate,
}: {
  plan: ProfilePlan;
  balancesKnown: boolean;
  icons: Record<BudgetPocketIcon, React.ElementType>;
  tones: Record<BudgetPocketTone, { card: string; iconWrap: string; icon: string; title: string; muted: string }>;
  active: boolean;
  onCreate: (plan: ProfilePlan) => void;
}) {
  const { draft } = plan;
  const tone = tones[plan.tone];
  const Icon = icons[draft.icon];
  const due = dueLabel(draft.dueDate);
  const verdict = VERDICT[plan.verdict];
  const share = plan.dailyAllowance > 0 ? Math.round((plan.perDay / plan.dailyAllowance) * 100) : null;

  return (
    <section aria-label={`Usulan kantong ${draft.name}`} className={`rounded-[22px] border border-[#F1EEE8] bg-white p-3 ${active ? "" : "opacity-60"}`}>
      <div className={`flex items-center gap-3 rounded-[16px] p-3 ${tone.card}`}>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] ${tone.iconWrap} ${tone.icon}`}>
          <Icon size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[15px] font-bold ${tone.title}`}>{draft.name}</p>
          <p className={`flex items-center gap-1 text-[11px] ${tone.muted}`}>
            <CalendarDays size={12} />
            {due.date} · {due.relative}
          </p>
        </div>
        <p className={`shrink-0 text-[16px] font-bold tabular-nums ${tone.title}`}>{rp(draft.amount)}</p>
      </div>

      <p className="mt-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#76520E]">Rencana Nera</p>
      <dl className="mt-1.5 space-y-1.5 px-1 text-[12px]">
        {plan.fromPockets.map((s) => (
          <div key={s.pocket.id} className="flex justify-between gap-3">
            <dt className="text-[#736B60]">Sekarang dari {s.pocket.name}</dt>
            <dd className="shrink-0 font-semibold tabular-nums text-[#2F240E]">{rp(s.amount)}</dd>
          </div>
        ))}
        {plan.fromMainNow > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-[#736B60]">Sekarang dari Kantong Utama</dt>
            <dd className="shrink-0 font-semibold tabular-nums text-[#2F240E]">{rp(plan.fromMainNow)}</dd>
          </div>
        )}
        {plan.perDay > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-[#736B60]">
              Sisihkan tiap hari dari Kantong Utama
              <span className="block text-[11px]">selama {plan.daysLeft} hari</span>
            </dt>
            <dd className="shrink-0 text-right font-bold tabular-nums text-[#2F240E]">{rp(plan.perDay)}/hari</dd>
          </div>
        )}
      </dl>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#F7F5F0] px-3 py-2">
        <span className={`mt-px shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${verdict.className}`}>{verdict.label}</span>
        <p className="text-[12px] leading-snug text-[#5C4A1E]">
          {plan.shortfall > 0
            ? `Kantong Utama belum cukup, masih kurang ${rp(plan.shortfall)}. Coba tawar nominalnya atau geser tanggalnya.`
            : plan.daysLeft === 0
              ? "Acaranya hari ini, jadi uangnya langsung dipindah."
              : share !== null
                ? `${share}% dari jatah harianmu ${rp(plan.dailyAllowance)}.${plan.verdict === "berat" ? " Kurangi jajan lain atau minta acaranya diundur." : ""}`
                : "Sisihkan sedikit tiap hari sampai hari-H."}
        </p>
      </div>
      {!balancesKnown && (
        <p className="mt-2 px-1 text-[11px] leading-snug text-[#736B60]">Saldo belum diatur, jadi belum ada yang dipindah dari kantong lain.</p>
      )}

      {active && (
        <button
          type="button"
          onClick={() => onCreate(plan)}
          className="mt-3 h-11 w-full rounded-[14px] bg-[#FFB900] text-[14px] font-bold text-[#352500] transition-transform duration-150 hover:bg-[#E6A700] active:scale-[0.96]"
        >
          Buat kantong ini
        </button>
      )}
    </section>
  );
}
