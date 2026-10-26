"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@nera/ui";
import { Check, Copy, Inbox, LogOut, Mail, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, Unplug } from "lucide-react";
import { TopAppBar } from "../../../components/common/TopAppBar";
import { NeraOrb } from "../../../components/mascot/NeraOrb";
import { MoneyInsightsCard } from "../../../components/insights/MoneyInsightsCard";
import { SpendingCharts } from "../../../components/insights/SpendingCharts";
import { TransactionSheet, type TransactionEdit } from "../../../components/insights/TransactionSheet";
import { ConsentCard } from "../../../components/consent/ConsentCard";
import { isCountedSpend, useEmailSpendingStore } from "../../../lib/emailSpending";
import { PeriodFilter, periodRange } from "../../../components/insights/PeriodFilter";
import { inPeriod, presetPeriod, type Period } from "../../../lib/period";
import type { NeraMood } from "../../../components/mascot/moods";
import {
  CATEGORY_LABEL,
  NotSignedIn,
  authApi,
  emailApi,
  type EmailStatus,
  type EmailTransaction,
  type SyncSummary,
} from "../../../lib/emailImport";

const PAGE_SIZE = 20;
/** The API holds receipts this large for review (REVIEW_ABOVE in apps/api/src/email/ingest.ts). */
const LARGE_AMOUNT = 25_000_000;

type View = "insight" | "list" | "settings";
const VIEWS: { id: View; label: string }[] = [
  { id: "insight", label: "Insight" },
  { id: "list", label: "Transaksi" },
  { id: "settings", label: "Pengaturan" },
];

const formatRupiah = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const BACKFILL_LABEL: Record<number, string> = { 180: "6 bulan", 365: "1 tahun", 3650: "semua" };

const CHANNEL_LABEL: Record<EmailTransaction["channel"], string> = { gmail: "Gmail", forward: "Forward", demo: "Contoh" };

function summaryText(s: SyncSummary) {
  if (s.imported === 0) return `Tidak ada transaksi baru dari ${s.scanned} email.`;
  return `Nera menemukan ${s.imported} transaksi baru dari ${s.scanned} email.`;
}

export default function EmailImportPage() {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [txs, setTxs] = useState<EmailTransaction[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [mood, setMood] = useState<NeraMood>("wave");
  // undefined: checking, null: signed out
  const [account, setAccount] = useState<{ email: string } | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    const [s, t] = await Promise.all([emailApi.status(), emailApi.transactions()]);
    setStatus(s);
    setTxs(t);
  }, []);

  /** Runs an action with the mascot thinking, then reacts to the outcome. */
  const run = useCallback(
    async (key: string, action: () => Promise<string | void>) => {
      setBusy(key);
      setMood("thinking");
      setNotice(null);
      try {
        const text = await action();
        await refresh();
        if (text) setNotice({ tone: "ok", text });
        setMood(text?.startsWith("Nera menemukan") ? "celebrate" : "happy");
      } catch (e) {
        if (e instanceof NotSignedIn) setAccount(null);
        setNotice({ tone: "error", text: (e as Error).message });
        setMood("alert");
      } finally {
        setBusy(null);
        setTimeout(() => setMood("idle"), 2600);
      }
    },
    [refresh],
  );

  useEffect(() => {
    authApi
      .me()
      .then(async (me) => {
        setAccount(me);
        await refresh();
        setTimeout(() => setMood("idle"), 2200);
      })
      .catch((e) => {
        if (e instanceof NotSignedIn) return setAccount(null);
        setNotice({ tone: "error", text: "Server Nera tidak bisa dihubungi. Jalankan API (pnpm dev:api) lalu muat ulang." });
        setMood("alert");
      });

    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "error") {
      window.history.replaceState(null, "", window.location.pathname);
      setNotice({ tone: "error", text: "Gagal masuk dengan Google. Coba lagi." });
    }

    // back from Google's consent screen
    const result = params.get("gmail");
    if (!result) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (result === "connected") run("gmail-sync", async () => summaryText(await emailApi.syncGmail()));
    else
      setNotice({
        tone: "error",
        text:
          result === "denied"
            ? "Akses Gmail tidak diberikan."
            : result === "consent"
              ? "Setujui dulu impor email di kartu Persetujuan, lalu hubungkan Gmail."
              : "Gagal menghubungkan Gmail. Coba lagi.",
      });
  }, [refresh, run]);

  // live updates: new receipts arrive in the background (Gmail push, forwarding),
  // so poll while the tab is visible and something is connected
  const seenCount = useRef<number | null>(null);
  const live = Boolean(status?.gmail.connected || status?.forward);
  const backfill = status?.gmail.backfill;
  const backfilling = backfill?.status === "pending" || backfill?.status === "running";
  useEffect(() => {
    if (!live) return;
    const id = setInterval(
      () => {
        if (document.visibilityState !== "visible" || busy) return;
        refresh().catch(() => undefined);
      },
      // faster while older history is being pulled, so progress moves on screen
      backfilling ? 4_000 : 20_000,
    );
    return () => clearInterval(id);
  }, [live, busy, refresh, backfilling]);
  const [backfillDays, setBackfillDays] = useState<180 | 365 | 3650>(365);

  useEffect(() => {
    // the first load sets the baseline; only later arrivals are "new"
    if (!status) return;
    const prev = seenCount.current;
    seenCount.current = txs.length;
    if (prev === null || busy || txs.length <= prev) return;
    setNotice({ tone: "ok", text: `${txs.length - prev} transaksi baru masuk dari email.` });
    setMood("happy");
    const t = setTimeout(() => setMood("idle"), 2600);
    return () => clearTimeout(t);
  }, [txs.length, busy, status]);

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  // one period drives the stats, the analysis and the list
  const [period, setPeriod] = useState<Period>(() => presetPeriod("this_month"));
  const periodTxs = useMemo(() => txs.filter((t) => !t.dismissed && inPeriod(t.occurredAt, period)), [txs, period]);
  const hiddenTxs = useMemo(() => txs.filter((t) => t.dismissed && inPeriod(t.occurredAt, period)), [txs, period]);
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<EmailTransaction | null>(null);

  const saveEdit = (t: EmailTransaction, edit: TransactionEdit) => {
    setEditing(null);
    run(`edit-${t.id}`, async () => {
      const r = await emailApi.editTransaction(t.id, edit);
      // Beranda and Kantong read the shared store
      await useEmailSpendingStore.getState().load(true);
      if ("dismissed" in edit) return `${t.merchant} disembunyikan dan tidak dihitung lagi.`;
      const label = CATEGORY_LABEL[edit.category];
      return r.alsoChanged > 0 ? `${r.alsoChanged + 1} transaksi ${t.merchant} sekarang ${label}.` : `${t.merchant} sekarang ${label}.`;
    });
  };
  const unhide = (t: EmailTransaction) =>
    run(`unhide-${t.id}`, async () => {
      await emailApi.editTransaction(t.id, { dismissed: false });
      await useEmailSpendingStore.getState().load(true);
      return `${t.merchant} ditampilkan lagi.`;
    });
  // a year of receipts is a thousand rows: render a page at a time
  const [shown, setShown] = useState(PAGE_SIZE);
  useEffect(() => setShown(PAGE_SIZE), [period]);
  const periodCounted = periodTxs.filter(isCountedSpend);
  const periodSpend = periodCounted.reduce((sum, t) => sum + t.amount, 0);
  const periodSpends = useMemo(() => periodTxs.filter(isCountedSpend), [periodTxs]);

  // with data the page splits into tabs so charts, the list and the connection
  // settings don't pile up in one long scroll; without data only settings make sense
  const [view, setView] = useState<View>("insight");
  const tab: View = txs.length > 0 ? view : "settings";
  // links like /email#consent (from the chatbot) land on the settings tab
  useEffect(() => {
    if (window.location.hash === "#consent") setView("settings");
  }, []);
  const byId = useMemo(() => new Map(txs.map((t) => [t.id, t])), [txs]);
  const filterQuery = status ? `from:(${status.senders.flatMap((s) => s.domains).join(" OR ")})` : "";

  return (
    <div className="flex min-h-full flex-col bg-[#F7F7F7]">
      <TopAppBar title="Impor dari Email" showBack />

      <main className="flex-1 space-y-5 px-4 pb-10">
        {/* HERO */}
        <div className="-mx-4 rounded-b-[32px] bg-white px-6 pb-6 pt-3">
          <div className="flex items-center gap-4">
            <NeraOrb mood={mood} size={104} />
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-snug text-[#2F240E]">Lengkapi riwayat transaksimu</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[#736B60]">
                Struk GoPay, OVO, Shopee, Grab dan lainnya yang tidak tercatat di BNI.
              </p>
            </div>
          </div>
          {txs.length > 0 && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[#2F240E]">Ringkasan</p>
                <p className="truncate text-[11px] text-[#736B60]">{periodRange(period)}</p>
              </div>
              <PeriodFilter value={period} onChange={setPeriod} />
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="rounded-[19px] bg-[#F7F7F7] p-3.5">
              <p className="text-[11px] text-[#736B60]">Transaksi</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-[#2F240E]">{periodTxs.length}</p>
              <p className="mt-0.5 text-[11px] text-[#736B60]">dari {txs.length} total</p>
            </div>
            <div className="rounded-[19px] bg-[#F7F7F7] p-3.5">
              <p className="text-[11px] text-[#736B60]">Pengeluaran</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-[#2F240E]">{formatRupiah(periodSpend)}</p>
              <p className="mt-0.5 text-[11px] text-[#736B60]">{periodCounted.length} transaksi dihitung</p>
            </div>
          </div>
        </div>

        {txs.length > 0 && (
          <div role="tablist" aria-label="Tampilan" className="grid grid-cols-3 gap-1 rounded-full bg-[#ECEAE5] p-1">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={tab === v.id}
                onClick={() => setView(v.id)}
                className={`h-9 rounded-full text-[13px] font-semibold transition-colors ${
                  tab === v.id ? "bg-white text-[#2F240E] shadow-[0_1px_3px_rgba(47,36,14,0.12)]" : "text-[#736B60] hover:text-[#2F240E]"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {notice && (
          <p
            role="status"
            className={`rounded-2xl px-4 py-3 text-sm font-medium ${
              notice.tone === "ok" ? "bg-[#EAF7E4] text-[#2F6B1F]" : "bg-[#FDECEC] text-[#A92F2F]"
            }`}
          >
            {notice.text}
          </p>
        )}

        {account === null && (
          <section className="rounded-[24px] bg-white p-5 text-center">
            <h3 className="text-sm font-bold text-[#2F240E]">Masuk untuk mengimpor email</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#736B60]">
              Riwayat dari emailmu hanya bisa dilihat olehmu. Masuk dulu dengan akun Google.
            </p>
            <Button className="mt-4" fullWidth onClick={() => (window.location.href = authApi.loginUrl("/email"))}>
              Masuk dengan Google
            </Button>
          </section>
        )}

        {account && (
          <>
            {tab === "insight" && (
              <>
                <MoneyInsightsCard refreshKey={txs.length} period={period} />
                <SpendingCharts txs={periodSpends} period={period} />
              </>
            )}

            {tab === "settings" && (
              <>
                {account && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                    <p className="min-w-0 truncate text-xs text-[#736B60]">
                      Masuk sebagai <b className="text-[#2F240E]">{account.email}</b>
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        await authApi.logout().catch(() => undefined);
                        setAccount(null);
                        setStatus(null);
                        setTxs([]);
                      }}
                      className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#76520E]"
                    >
                      <LogOut size={14} />
                      Keluar
                    </button>
                  </div>
                )}

                {status && (
                  <ConsentCard
                    consent={status.consent}
                    busy={busy?.startsWith("consent") ?? false}
                    onChange={(kind, granted) =>
                      run(`consent-${kind}`, async () => {
                        await emailApi.setConsent(kind, granted);
                        // Beranda, Kantong and the chatbot read consent from the shared store
                        await useEmailSpendingStore.getState().load(true);
                        if (kind === "email_import") return granted ? "Terima kasih. Sekarang kamu bisa menghubungkan Gmail." : "Persetujuan dicabut. Gmail diputus dan data email dihapus.";
                        return granted ? "Bantuan AI aktif." : "Bantuan AI dimatikan. Nera memakai aturan biasa.";
                      })
                    }
                  />
                )}

                {/* PRIVACY */}
                <section className="rounded-[24px] bg-white p-5">
                  <div className="flex items-center gap-2 text-[#2F240E]">
                    <ShieldCheck size={18} className="text-[#76520E]" />
                    <h3 className="text-sm font-bold">Yang dibaca Nera</h3>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#736B60]">
                    Email dari pengirim di bawah, plus email yang Gmail kelompokkan sebagai Pembelian (pengirim lain ditandai
                    &quot;Perlu dicek&quot;). Nera menyimpan nominal, merchant dan tanggal; isi email tidak disimpan.
                    {status?.consent.aiProcessing
                      ? " Bantuan AI aktif: struk yang sulit dibaca dikirim ke AI dengan data pribadi disamarkan."
                      : " Bantuan AI tidak aktif: tidak ada data yang dikirim ke AI."}{" "}
                    Hanya untuk catatan dan saran pribadimu, tidak untuk penilaian kredit atau iklan.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {status?.senders.map((s) => (
                      <span key={s.provider} className="rounded-full bg-[#FFF3D6] px-2.5 py-1 text-[11px] font-semibold text-[#76520E]">
                        {s.provider}
                      </span>
                    ))}
                  </div>
                </section>

                {/* OPTION A: GMAIL */}
                <section className="rounded-[24px] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#FFF3D6] text-[#76520E]">
                        <Mail size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#2F240E]">Hubungkan Gmail</h3>
                        <p className="text-xs text-[#736B60]">
                          {status?.gmail.connected
                            ? `${status.gmail.accounts.length} akun terhubung${status.gmail.lastSyncAt ? ` · sinkron ${formatDate(status.gmail.lastSyncAt)}` : ""}`
                            : "Otomatis, termasuk riwayat 90 hari terakhir"}
                        </p>
                      </div>
                    </div>
                    {status?.gmail.connected && (
                      <span className="rounded-full bg-[#EAF7E4] px-2 py-0.5 text-[11px] font-semibold text-[#2F6B1F]">Aktif</span>
                    )}
                  </div>

                  {/* one row per linked mailbox: bank emails often go to a different address */}
                  {status?.gmail.connected && (
                    <ul className="mt-3 divide-y divide-[#F1EEE8] rounded-[16px] bg-[#F7F7F7] px-3.5">
                      {status.gmail.accounts.map((a) => (
                        <li key={a.account} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold text-[#2F240E]">{a.googleEmail ?? a.account}</span>
                            <span className="block text-[11px] text-[#736B60]">
                              {a.lastSyncAt ? `Sinkron ${formatDate(a.lastSyncAt)}` : "Belum sinkron"}
                            </span>
                          </span>
                          <button
                            type="button"
                            disabled={busy === `gmail-off-${a.account}`}
                            onClick={() =>
                              run(`gmail-off-${a.account}`, async () => (
                                await emailApi.disconnectGmail(a.account), `${a.googleEmail ?? a.account} diputus dan datanya dihapus.`
                              ))
                            }
                            className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-[#A92F2F] hover:bg-white disabled:opacity-50"
                          >
                            <Unplug size={13} />
                            Putuskan
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {status && !status.consent.emailImport && (
                    <p className="mt-3 rounded-xl bg-[#FFF3D6] px-3 py-2 text-xs text-[#76520E]">
                      Setujui impor email di kartu Persetujuan di atas untuk menghubungkan Gmail.
                    </p>
                  )}

                  {status && !status.gmail.configured && (
                    <p className="mt-3 rounded-xl bg-[#F7F7F7] px-3 py-2 text-xs text-[#736B60]">
                      Belum dikonfigurasi di server. Isi GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET dan EMAIL_TOKEN_KEY di API.
                    </p>
                  )}

                  <div className="mt-4 flex gap-2.5">
                    {status?.gmail.connected ? (
                      <>
                        <Button
                          className="flex-1"
                          isLoading={busy === "gmail-sync"}
                          onClick={() => run("gmail-sync", async () => summaryText(await emailApi.syncGmail()))}
                        >
                          <RefreshCw size={16} className="mr-1.5" />
                          Sinkronkan
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!status.consent.emailImport}
                          onClick={() => {
                            setMood("thinking");
                            window.location.href = emailApi.gmailConnectUrl();
                          }}
                        >
                          <Plus size={16} className="mr-1.5" />
                          Tambah akun
                        </Button>
                      </>
                    ) : (
                      <Button
                        fullWidth
                        disabled={!status?.gmail.configured || !status?.consent.emailImport}
                        onClick={() => {
                          setMood("thinking");
                          window.location.href = emailApi.gmailConnectUrl();
                        }}
                      >
                        Hubungkan dengan Google
                      </Button>
                    )}
                  </div>

                  <p className="mt-3 text-[11px] leading-relaxed text-[#736B60]">
                    Email bank masuk ke alamat lain? Tambahkan semua Gmail-mu. Untuk email selain Gmail, pakai alamat penerusan di bawah.
                  </p>

                  {status?.gmail.connected && (
                    <div className="mt-4 rounded-[16px] bg-[#F7F7F7] p-3.5">
                      <p className="text-xs font-bold text-[#2F240E]">Ambil riwayat lebih lama</p>
                      {backfilling ? (
                        <div className="mt-2 flex items-center gap-3">
                          <NeraOrb mood="thinking" size={36} trackPointer={false} />
                          <p className="text-[11px] leading-relaxed text-[#736B60]">
                            Mengambil riwayat {BACKFILL_LABEL[backfill!.days] ?? `${backfill!.days} hari`}… {backfill!.scanned} email diperiksa,{" "}
                            {backfill!.imported} transaksi ditemukan. Boleh tutup halaman ini, Nera lanjut di latar belakang.
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="mt-0.5 text-[11px] text-[#736B60]">
                            {backfill?.status === "done"
                              ? `Selesai: ${backfill.imported} transaksi dari ${BACKFILL_LABEL[backfill.days] ?? `${backfill.days} hari`} terakhir (${backfill.scanned} email diperiksa).`
                              : backfill?.status === "error"
                                ? `Terhenti: ${backfill.error}. Coba mulai lagi, progres sebelumnya tidak hilang.`
                                : "Sinkron rutin hanya 90 hari. Tarik riwayat lebih jauh; bisa makan beberapa menit."}
                          </p>
                          <div className="mt-2.5 flex gap-2">
                            {([180, 365, 3650] as const).map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setBackfillDays(d)}
                                className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-semibold ${
                                  backfillDays === d ? "bg-[#2F240E] text-white" : "bg-white text-[#2F240E]"
                                }`}
                              >
                                {BACKFILL_LABEL[d]}
                              </button>
                            ))}
                          </div>
                          <Button
                            className="mt-2.5"
                            fullWidth
                            size="sm"
                            variant="secondary"
                            isLoading={busy === "backfill"}
                            onClick={() =>
                              run("backfill", async () => {
                                await emailApi.backfillGmail(backfillDays);
                                return `Nera mulai mengambil riwayat ${BACKFILL_LABEL[backfillDays]}. Progresnya muncul di sini.`;
                              })
                            }
                          >
                            Mulai ambil riwayat
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </section>

                {/* OPTION B: FORWARDING ADDRESS */}
                <section className="rounded-[24px] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#FFF3D6] text-[#76520E]">
                        <Inbox size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#2F240E]">Teruskan struk ke Nera</h3>
                        <p className="text-xs text-[#736B60]">Tanpa memberi akses ke inbox. Cocok untuk email apa pun.</p>
                      </div>
                    </div>
                    {status?.forward?.status === "active" && (
                      <span className="rounded-full bg-[#EAF7E4] px-2 py-0.5 text-[11px] font-semibold text-[#2F6B1F]">Aktif</span>
                    )}
                  </div>

                  {!status?.forward ? (
                    <Button
                      className="mt-4"
                      fullWidth
                      variant="secondary"
                      isLoading={busy === "alias"}
                      disabled={!status?.consent.emailImport}
                      onClick={() => run("alias", async () => void (await emailApi.createAlias()))}
                    >
                      Buat alamat penerusan
                    </Button>
                  ) : (
                    <>
                      <div className="mt-4 flex items-center gap-2 rounded-[16px] bg-[#F7F7F7] py-2.5 pl-3.5 pr-2">
                        <p className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold text-[#2F240E]">{status.forward.address}</p>
                        <button
                          type="button"
                          onClick={() => copy("address", status.forward!.address)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#76520E] hover:bg-white"
                          aria-label="Salin alamat"
                        >
                          {copied === "address" ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>

                      <ol className="mt-4 space-y-3 text-[13px] leading-relaxed text-[#2F240E]">
                        <li className="flex gap-3">
                          <Step n={1} done={status.forward.status !== "waiting"} />
                          <span className="min-w-0 flex-1">
                            Di Gmail: <b>Setelan → Penerusan dan POP/IMAP → Tambahkan alamat penerusan</b>, tempel alamat di atas.
                          </span>
                        </li>
                        <li className="flex gap-3">
                          <Step n={2} done={status.forward.status === "active"} />
                          <span className="min-w-0 flex-1">
                            Masukkan kode konfirmasi dari Gmail.{" "}
                            {status.forward.confirmationCode ? (
                              <button
                                type="button"
                                onClick={() => copy("code", status.forward!.confirmationCode!)}
                                className="ml-1 inline-flex items-center gap-1 rounded-lg bg-[#FFF3D6] px-2 py-0.5 font-mono font-bold text-[#76520E]"
                              >
                                {status.forward.confirmationCode}
                                {copied === "code" ? <Check size={13} /> : <Copy size={13} />}
                              </button>
                            ) : (
                              status.forward.status === "waiting" && <span className="text-[#736B60]">Kodenya akan muncul di sini.</span>
                            )}
                          </span>
                        </li>
                        <li className="flex gap-3">
                          <Step n={3} done={status.forward.status === "active"} />
                          <span className="min-w-0 flex-1">
                            Buat filter dengan pencarian ini, lalu pilih <b>Teruskan ke</b> alamat Nera.
                            <button
                              type="button"
                              onClick={() => copy("filter", filterQuery)}
                              className="mt-1.5 flex w-full items-center gap-2 rounded-xl bg-[#F7F7F7] px-3 py-2 text-left font-mono text-[11px] text-[#736B60]"
                            >
                              <span className="min-w-0 flex-1 truncate">{filterQuery}</span>
                              {copied === "filter" ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </span>
                        </li>
                      </ol>

                      <button
                        type="button"
                        onClick={() => run("alias-off", async () => (await emailApi.removeAlias(), "Alamat penerusan dihapus."))}
                        className="mt-4 text-xs font-semibold text-[#A92F2F]"
                      >
                        Hapus alamat ini
                      </button>
                    </>
                  )}
                </section>

                {/* DEMO */}
                <Button
                  variant="outline"
                  fullWidth
                  isLoading={busy === "demo"}
                  onClick={() => run("demo", async () => summaryText(await emailApi.importDemo()))}
                >
                  <Sparkles size={16} className="mr-1.5" />
                  Coba dengan contoh struk
                </Button>

              </>
            )}

            {/* TRANSACTIONS */}
            {tab === "list" && (
              <section className="space-y-3">
                <h3 className="text-[15px] font-bold text-[#2F240E]">
                  Transaksi dari email <span className="font-medium text-[#736B60]">· {period.label.toLowerCase()} ({periodTxs.length})</span>
                </h3>
                {periodTxs.length > 0 && <p className="text-[11px] text-[#736B60]">Ketuk transaksi untuk mengubah kategori atau menyembunyikannya.</p>}
                {periodTxs.length === 0 && <p className="rounded-[20px] bg-white px-4 py-6 text-center text-xs text-[#736B60]">Tidak ada transaksi di periode ini.</p>}
                <ul className="divide-y divide-[#F1EEE8] rounded-[24px] bg-white px-4">
                  {periodTxs.slice(0, shown).map((t) => (
                    <li key={t.id} className="py-3.5">
                      <button
                        type="button"
                        onClick={() => setEditing(t)}
                        aria-label={`Ubah ${t.merchant}`}
                        className="-mx-2 flex w-[calc(100%+1rem)] items-start justify-between gap-3 rounded-xl px-2 py-1 text-left hover:bg-[#FFF8E6]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#2F240E]">{t.merchant}</p>
                          <p className="mt-0.5 text-[11px] text-[#736B60]">
                            {t.provider} · {CATEGORY_LABEL[t.category]} · {formatDate(t.occurredAt)} · {CHANNEL_LABEL[t.channel]}
                          </p>
                        </div>
                        <p className={`shrink-0 text-sm font-bold tabular-nums ${t.countsTowardSpending && !t.needsReview ? "text-[#2F240E]" : "text-[#736B60]"}`}>
                          {t.type === "income" ? "+" : "−"}
                          {formatRupiah(t.amount)}
                        </p>
                      </button>
                      {(t.needsReview || !t.countsTowardSpending) && (
                        <div className="mt-2 flex items-center gap-2">
                          {t.needsReview ? (
                            <>
                              <span className="rounded-full bg-[#FFF3D6] px-2 py-0.5 text-[11px] font-semibold text-[#76520E]">
                                {t.amount >= LARGE_AMOUNT ? "Perlu dicek · nominal sangat besar" : "Perlu dicek"}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  run(`confirm-${t.id}`, async () => {
                                    await emailApi.confirm(t.id);
                                    await useEmailSpendingStore.getState().load(true);
                                  })
                                }
                                className="text-[11px] font-bold text-[#76520E] underline underline-offset-2"
                              >
                                Sudah benar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing(t)}
                                className="text-[11px] font-bold text-[#76520E] underline underline-offset-2"
                              >
                                Ubah
                              </button>
                            </>
                          ) : (
                            <span className="rounded-full bg-[#F1EEE8] px-2 py-0.5 text-[11px] font-semibold text-[#736B60]">
                              {t.duplicateOf
                                ? `Tidak dihitung · sudah ada struk dari ${byId.get(t.duplicateOf)?.provider ?? "merchant"}`
                                : t.type === "income"
                                  ? "Tidak dihitung · uang masuk"
                                  : t.category === "transfer"
                                    ? "Tidak dihitung · transfer"
                                    : t.category === "investment"
                                      ? "Tidak dihitung · investasi"
                                      : "Tidak dihitung · top up"}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {periodTxs.length > shown && (
                  <button
                    type="button"
                    onClick={() => setShown((n) => n + PAGE_SIZE)}
                    className="h-11 w-full rounded-[16px] border border-[#E9E5DD] bg-white text-[13px] font-semibold text-[#2F240E] hover:bg-[#FFF8E6]"
                  >
                    Tampilkan {Math.min(PAGE_SIZE, periodTxs.length - shown)} lagi
                    <span className="font-medium text-[#736B60]"> · {shown} dari {periodTxs.length}</span>
                  </button>
                )}
                {hiddenTxs.length > 0 && (
                  <div className="rounded-[20px] bg-white px-4 py-3">
                    <button
                      type="button"
                      aria-expanded={showHidden}
                      onClick={() => setShowHidden((v) => !v)}
                      className="flex w-full items-center justify-between text-left text-[12px] font-semibold text-[#736B60]"
                    >
                      {hiddenTxs.length} transaksi disembunyikan
                      <span className="text-[#76520E] underline underline-offset-2">{showHidden ? "Tutup" : "Lihat"}</span>
                    </button>
                    {showHidden && (
                      <ul className="mt-2 divide-y divide-[#F1EEE8]">
                        {hiddenTxs.map((t) => (
                          <li key={t.id} className="flex items-center gap-3 py-2.5">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold text-[#736B60] line-through">{t.merchant}</span>
                              <span className="block text-[11px] tabular-nums text-[#736B60]">
                                {formatRupiah(t.amount)} · {formatDate(t.occurredAt)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => unhide(t)}
                              className="shrink-0 text-[11px] font-bold text-[#76520E] underline underline-offset-2"
                            >
                              Tampilkan lagi
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </section>
            )}

            {tab === "settings" && (txs.length > 0 || status?.gmail.connected || status?.forward) && (
              <Button
                variant="ghost"
                fullWidth
                isLoading={busy === "wipe"}
                onClick={() => run("wipe", async () => (await emailApi.deleteAll(), "Semua koneksi email dan datanya sudah dihapus."))}
              >
                <Trash2 size={16} className="mr-1.5" />
                Putuskan & hapus semua data email
              </Button>
            )}
          </>
        )}
      </main>
      {editing && <TransactionSheet tx={editing} all={txs} onClose={() => setEditing(null)} onSave={(edit) => saveEdit(editing, edit)} />}
    </div>
  );
}

function Step({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
        done ? "bg-[#58A83C] text-white" : "bg-[#FFF3D6] text-[#76520E]"
      }`}
    >
      {done ? <Check size={13} /> : n}
    </span>
  );
}
