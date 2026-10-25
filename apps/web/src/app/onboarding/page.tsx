"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  CreditCard,
  Eye,
  GraduationCap,
  Landmark,
  Lock,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@nera/ui";
import { OnboardingChrome } from "../../components/onboarding/OnboardingChrome";
import { NeraScene } from "../../components/onboarding/NeraScene";
import { Chip, FieldLabel, OptionCard, ToggleCard } from "../../components/onboarding/controls";
import {
  GOAL_META,
  INCOME_RANGE_LABELS,
  INCOME_SOURCE_LABELS,
  PAYMENT_METHOD_LABELS,
  STATUS_LABELS,
  useOnboardingHydrated,
  useOnboardingStore,
  type FinancialStatus,
  type IncomeRange,
  type IncomeSource,
  type OnboardingGoal,
  type PaymentMethod,
} from "../../context/OnboardingStore";

const GOAL_ICONS: Record<OnboardingGoal, LucideIcon> = {
  spending: Wallet,
  insight: Eye,
  saving: Target,
  security: ShieldAlert,
};

const GOAL_ORDER: OnboardingGoal[] = ["spending", "insight", "saving", "security"];
const STATUS_ORDER: FinancialStatus[] = ["mahasiswa", "pelajar", "karyawan", "wirausaha", "lainnya"];
const SOURCE_ORDER: IncomeSource[] = ["orang_tua", "beasiswa", "gaji", "usaha", "lainnya"];
const RANGE_ORDER: IncomeRange[] = ["lt1", "1to2", "2to3", "3to5", "gt5"];
const PAYMENT_ORDER: PaymentMethod[] = ["qris", "transfer", "ewallet", "debit", "tunai"];

const PAYMENT_ICONS: Record<PaymentMethod, LucideIcon> = {
  qris: QrCode,
  transfer: Landmark,
  ewallet: Smartphone,
  debit: CreditCard,
  tunai: Banknote,
};

const STEP_TOTAL = 5;

export default function OnboardingPage() {
  const router = useRouter();
  const hydrated = useOnboardingHydrated();

  const completed = useOnboardingStore((s) => s.completed);
  const lastStep = useOnboardingStore((s) => s.lastStep);
  const goal = useOnboardingStore((s) => s.goal);
  const status = useOnboardingStore((s) => s.status);
  const incomeSources = useOnboardingStore((s) => s.incomeSources);
  const incomeRange = useOnboardingStore((s) => s.incomeRange);
  const paymentMethods = useOnboardingStore((s) => s.paymentMethods);
  const consent = useOnboardingStore((s) => s.consent);

  const setGoal = useOnboardingStore((s) => s.setGoal);
  const setStatus = useOnboardingStore((s) => s.setStatus);
  const toggleIncomeSource = useOnboardingStore((s) => s.toggleIncomeSource);
  const setIncomeRange = useOnboardingStore((s) => s.setIncomeRange);
  const togglePaymentMethod = useOnboardingStore((s) => s.togglePaymentMethod);
  const setConsent = useOnboardingStore((s) => s.setConsent);
  const setLastStep = useOnboardingStore((s) => s.setLastStep);
  const complete = useOnboardingStore((s) => s.complete);
  const reset = useOnboardingStore((s) => s.reset);

  const [step, setStep] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || initialized) return;

    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    setNextPath(next && next.startsWith("/") ? next : null);

    if (params.get("replay") === "1") {
      reset();
      setStep(0);
    } else if (completed) {
      setStep(goal ? STEP_TOTAL - 1 : 1);
    } else {
      setStep(Math.min(Math.max(lastStep, 0), STEP_TOTAL - 1));
    }

    setInitialized(true);
  }, [hydrated, initialized, completed, goal, lastStep, reset]);

  const goToStep = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), STEP_TOTAL - 1);
    setStep(clamped);
    setLastStep(clamped);
  };

  const finish = () => {
    complete();
    router.replace(nextPath ?? "/");
  };

  const canContinue =
    step === 0 ? true : step === 1 ? Boolean(goal) : step === 2 ? Boolean(status && incomeRange) : true;

  const handleNext = () => {
    if (step >= STEP_TOTAL - 1) {
      finish();
      return;
    }
    goToStep(step + 1);
  };

  if (!hydrated || !initialized) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#FFFBF0] py-24">
        <div className="flex flex-col items-center gap-3">
          <Sparkles size={22} className="animate-pulse text-[#A36A00]" />
          <p className="text-xs text-[#817B70]">Menyiapkan rencanamu…</p>
        </div>
      </div>
    );
  }

  const goalMeta = goal ? GOAL_META[goal] : null;

  return (
    <OnboardingChrome
      step={step}
      totalSteps={STEP_TOTAL}
      eyebrow={
        step === 0
          ? "Selamat datang di Nera"
          : step === 1
            ? "Langkah 1 dari 3"
            : step === 2
              ? "Langkah 2 dari 3"
              : step === 3
                ? "Langkah 3 dari 3"
                : "Rencana siap"
      }
      title={
        step === 0
          ? "Kenalan dulu, yuk."
          : step === 1
            ? "Apa yang paling kamu butuhkan sekarang?"
            : step === 2
              ? "Kenalan sedikit lagi soal kondisimu."
              : step === 3
                ? "Kamu yang pegang kendali."
                : "Rencanamu sudah jadi."
      }
      subtitle={
        step === 0
          ? "Nera bantu kamu memahami dan mengatur uang tanpa merasa dihakimi."
          : step === 1
            ? "Pilih satu fokus. Nera akan menyusun rencana yang paling relevan untukmu."
            : step === 2
              ? "Jawabanmu hanya dipakai untuk menyesuaikan insight dan rekomendasi."
              : step === 3
                ? "Nera hanya membaca data yang kamu izinkan, dan kamu bisa mengubahnya kapan saja."
                : "Ini titik awalmu. Kamu bisa mengubah rencana kapan pun dari Beranda."
      }
      onBack={step > 0 && step < STEP_TOTAL - 1 ? () => goToStep(step - 1) : undefined}
      onSkip={step === 0 ? finish : undefined}
      skipLabel="Lewati dulu"
      footer={
        <div className="space-y-2">
          <Button variant="primary" size="lg" fullWidth onClick={handleNext} disabled={!canContinue}>
            <span className="inline-flex items-center gap-2">
              {step >= STEP_TOTAL - 1 ? "Masuk ke Beranda" : "Lanjut"}
              <ArrowRight size={18} strokeWidth={2.4} />
            </span>
          </Button>
          {step === STEP_TOTAL - 1 ? (
            <button
              type="button"
              onClick={() => goToStep(1)}
              className="w-full rounded-xl py-2 text-center text-xs font-semibold text-[#817B70] transition-colors hover:text-[#5B410C]"
            >
              Ubah rencana
            </button>
          ) : step === 0 ? (
            <p className="text-center text-[10px] leading-relaxed text-[#A79F92]">
              Dengan melanjutkan, kamu menyetujui pemrosesan data sesuai{" "}
              <a href="/privacy" className="underline underline-offset-2">
                kebijakan privasi Nera
              </a>
              . Impor email dan bantuan AI diminta terpisah.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              className="w-full rounded-xl py-2 text-center text-xs font-semibold text-[#817B70] transition-colors hover:text-[#5B410C]"
            >
              Kembali
            </button>
          )}
        </div>
      }
    >
      {step === 0 && (
        <div className="space-y-5">
          <NeraScene
            variant="welcome"
            message="Hai, aku Nera! Aku bantu kamu tahu uangmu cukup sampai kapan, ke mana perginya, dan apa langkah aman berikutnya."
            caption="Cukup 1 menit, tanpa ribet dan tanpa menghakimi."
          />

          <div className="space-y-2">
            {[
              { icon: Eye, title: "Lihat kondisi finansial", desc: "Runway, skor, dan insight dalam bahasa manusia." },
              { icon: Wallet, title: "Atur uang ke kantong", desc: "Budget harian dan tabungan terpisah otomatis." },
              { icon: ShieldCheck, title: "Hindari jebakan", desc: "Deteksi transaksi berisiko dan pinjol sebelum terlambat." },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-[16px] border border-[#F0E6D2] bg-white/70 px-3.5 py-3"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-[#FFF0BD] text-[#6D4C00]">
                  <Icon size={16} strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-[#2F240E]">{title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#817B70]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <NeraScene
            variant="goal"
            message={
              goal
                ? `Oke, fokus kita ${GOAL_META[goal].label.toLowerCase()}. Aku siapkan langkah kecil yang realistis.`
                : "Nggak perlu sempurna. Pilih satu hal yang paling ingin kamu rapikan dulu."
            }
            compact
          />

          <div className="space-y-2.5">
            {GOAL_ORDER.map((id) => (
              <OptionCard
                key={id}
                icon={GOAL_ICONS[id]}
                title={GOAL_META[id].label}
                description={GOAL_META[id].description}
                tone={GOAL_META[id].tone}
                selected={goal === id}
                onClick={() => setGoal(id)}
              />
            ))}
          </div>

          {goalMeta && (
            <div className="rounded-[16px] bg-[#FFF3D6]/70 px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#A36A00]">Rekomendasi awal</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#5B410C]">{goalMeta.recommendation}</p>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="space-y-2.5">
            <FieldLabel>Status kamu</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((id) => (
                <Chip
                  key={id}
                  label={STATUS_LABELS[id]}
                  selected={status === id}
                  onClick={() => setStatus(id)}
                  icon={id === "mahasiswa" ? GraduationCap : undefined}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <FieldLabel optional>Dari mana pemasukanmu?</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {SOURCE_ORDER.map((id) => (
                <Chip
                  key={id}
                  label={INCOME_SOURCE_LABELS[id]}
                  selected={incomeSources.includes(id)}
                  onClick={() => toggleIncomeSource(id)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <FieldLabel>Rentang pemasukan per bulan</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {RANGE_ORDER.map((id) => (
                <Chip
                  key={id}
                  label={INCOME_RANGE_LABELS[id]}
                  selected={incomeRange === id}
                  onClick={() => setIncomeRange(id)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <FieldLabel optional>Biasanya bayar pakai apa?</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_ORDER.map((id) => (
                <Chip
                  key={id}
                  label={PAYMENT_METHOD_LABELS[id]}
                  selected={paymentMethods.includes(id)}
                  onClick={() => togglePaymentMethod(id)}
                  icon={PAYMENT_ICONS[id]}
                />
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-[14px] bg-[#F7F5F0] px-3 py-2.5">
            <Lock size={13} className="mt-0.5 shrink-0 text-[#817B70]" />
            <p className="text-[10px] leading-relaxed text-[#817B70]">
              Data ini tidak dibagikan ke pihak lain dan tidak memengaruhi skor kreditmu.
            </p>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <NeraScene
            variant="consent"
            message="Aku cuma butuh izinmu untuk membaca pola transaksi. Tanpa izin, aku tetap bisa bantu dengan catatan manual."
            compact
          />

          <div className="space-y-2.5">
            <ToggleCard
              title="Analisis transaksi otomatis"
              description="Nera membaca kategori dan nominal transaksi untuk menghitung runway, skor, dan insight harian."
              icon={Eye}
              badge="Disarankan"
              checked={consent.transactionAnalysis}
              onChange={(value) => setConsent("transactionAnalysis", value)}
            />
            <ToggleCard
              title="Hubungkan rekening BNI"
              description="Sinkronkan saldo dan mutasi secara otomatis. Bisa diputuskan kapan saja dari Pengaturan."
              icon={Landmark}
              checked={consent.bankConnection}
              onChange={(value) => setConsent("bankConnection", value)}
            />
          </div>

          <div className="rounded-[18px] border border-[#E8F0E9] bg-[#F4FCF8] p-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#277449]" />
              <p className="text-[12px] font-bold text-[#1F5E3C]">Komitmen privasi Nera</p>
            </div>
            <ul className="mt-2 space-y-1.5">
              {[
                "Data hanya dipakai untuk analisis finansial pribadimu.",
                "Tidak dijual ke pihak ketiga atau perusahaan pinjol.",
                "Kamu bisa mencabut izin dan menghapus data kapan saja.",
              ].map((item) => (
                <li key={item} className="flex gap-1.5 text-[11px] leading-relaxed text-[#3F6B54]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#58B98D]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-[10px] leading-relaxed text-[#A79F92]">
            Kamu bisa mengubah pilihan ini nanti di Pengaturan › Privasi.
          </p>
        </div>
      )}

      {step === 4 && goalMeta && (
        <div className="space-y-4">
          <NeraScene
            variant="ready"
            message={`Mantap! Rencana ${goalMeta.label.toLowerCase()} kamu sudah aktif. Aku akan ingatkan dengan langkah kecil, bukan ceramah.`}
            compact
          />

          <div className="rounded-[20px] border border-[#F0E6D2] bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#A36A00]">Rencana Nera</p>
              <span className="rounded-full bg-[#DDF0E6] px-2 py-0.5 text-[9px] font-bold text-[#277449]">Aktif</span>
            </div>

            <div className="mt-3 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#FFF0BD] text-[#6D4C00]">
                {React.createElement(GOAL_ICONS[goal as OnboardingGoal], { size: 19, strokeWidth: 2.2 })}
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-bold leading-tight text-[#2F240E]">{goalMeta.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#817B70]">{goalMeta.recommendation}</p>
              </div>
            </div>

            <div className="mt-3 space-y-2 border-t border-[#F2ECDF] pt-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#817B70]">Status</span>
                <span className="font-semibold text-[#2F240E]">{status ? STATUS_LABELS[status] : "Belum diisi"}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#817B70]">Pemasukan</span>
                <span className="font-semibold text-[#2F240E]">
                  {incomeRange ? INCOME_RANGE_LABELS[incomeRange] : "Belum diisi"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#817B70]">Analisis transaksi</span>
                <span className={consent.transactionAnalysis ? "font-semibold text-[#277449]" : "font-semibold text-[#817B70]"}>
                  {consent.transactionAnalysis ? "Aktif" : "Nanti saja"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[18px] bg-[#2F240E] px-4 py-3.5 text-white">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFB900]">Langkah pertamamu</p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/85">{goalMeta.recommendation}</p>
          </div>
        </div>
      )}
    </OnboardingChrome>
  );
}
