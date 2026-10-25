"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type OnboardingGoal = "spending" | "insight" | "saving" | "security";

export type FinancialStatus = "mahasiswa" | "pelajar" | "karyawan" | "wirausaha" | "lainnya";

export type IncomeSource = "orang_tua" | "beasiswa" | "gaji" | "usaha" | "lainnya";

export type IncomeRange = "lt1" | "1to2" | "2to3" | "3to5" | "gt5";

export type PaymentMethod = "qris" | "transfer" | "ewallet" | "debit" | "tunai";

export interface OnboardingConsent {
  transactionAnalysis: boolean;
  bankConnection: boolean;
}

export const GOAL_META: Record<
  OnboardingGoal,
  {
    label: string;
    description: string;
    recommendation: string;
    href: string;
    tone: "yellow" | "mint" | "sky" | "peach";
  }
> = {
  spending: {
    label: "Atur pengeluaran",
    description: "Buat budget harian dan pisahkan uang ke kantong.",
    recommendation: "Catat 3 pengeluaran pertamamu minggu ini.",
    href: "/pockets",
    tone: "yellow",
  },
  insight: {
    label: "Pahami kondisi keuangan",
    description: "Lihat runway, skor, dan insight yang mudah dicerna.",
    recommendation: "Buka Beranda dan cek runway pertamamu.",
    href: "/risk-check",
    tone: "mint",
  },
  saving: {
    label: "Bangun tabungan",
    description: "Sisihkan sedikit demi sedikit untuk target impianmu.",
    recommendation: "Buat kantong tabungan pertamamu hari ini.",
    href: "/pockets",
    tone: "sky",
  },
  security: {
    label: "Jaga keamanan finansial",
    description: "Deteksi transaksi berisiko dan hindari jebakan pinjol.",
    recommendation: "Aktifkan deteksi transaksi dan cek skor keamanan.",
    href: "/risk-check",
    tone: "peach",
  },
};

export const STATUS_LABELS: Record<FinancialStatus, string> = {
  mahasiswa: "Mahasiswa",
  pelajar: "Pelajar",
  karyawan: "Karyawan",
  wirausaha: "Wirausaha",
  lainnya: "Lainnya",
};

export const INCOME_SOURCE_LABELS: Record<IncomeSource, string> = {
  orang_tua: "Orang tua",
  beasiswa: "Beasiswa",
  gaji: "Gaji",
  usaha: "Usaha",
  lainnya: "Lainnya",
};

export const INCOME_RANGE_LABELS: Record<IncomeRange, string> = {
  lt1: "< Rp1 juta",
  "1to2": "Rp1–2 juta",
  "2to3": "Rp2–3 juta",
  "3to5": "Rp3–5 juta",
  gt5: "> Rp5 juta",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  qris: "QRIS",
  transfer: "Transfer bank",
  ewallet: "E-wallet",
  debit: "Kartu debit",
  tunai: "Tunai",
};

interface OnboardingState {
  completed: boolean;
  completedAt: string | null;
  goal: OnboardingGoal | null;
  status: FinancialStatus | null;
  incomeSources: IncomeSource[];
  incomeRange: IncomeRange | null;
  paymentMethods: PaymentMethod[];
  consent: OnboardingConsent;
  lastStep: number;

  setGoal: (goal: OnboardingGoal) => void;
  setStatus: (status: FinancialStatus) => void;
  toggleIncomeSource: (source: IncomeSource) => void;
  setIncomeRange: (range: IncomeRange) => void;
  togglePaymentMethod: (method: PaymentMethod) => void;
  setConsent: (key: keyof OnboardingConsent, value: boolean) => void;
  setLastStep: (step: number) => void;
  complete: () => void;
  reset: () => void;
}

const INITIAL_CONSENT: OnboardingConsent = {
  transactionAnalysis: false,
  bankConnection: false,
};

const INITIAL_STATE = {
  completed: false,
  completedAt: null,
  goal: null,
  status: null,
  incomeSources: [],
  incomeRange: null,
  paymentMethods: [],
  consent: INITIAL_CONSENT,
  lastStep: 0,
} satisfies Omit<
  OnboardingState,
  | "setGoal"
  | "setStatus"
  | "toggleIncomeSource"
  | "setIncomeRange"
  | "togglePaymentMethod"
  | "setConsent"
  | "setLastStep"
  | "complete"
  | "reset"
>;

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setGoal: (goal) => set({ goal }),

      setStatus: (status) => set({ status }),

      toggleIncomeSource: (source) =>
        set((state) => ({
          incomeSources: state.incomeSources.includes(source)
            ? state.incomeSources.filter((item) => item !== source)
            : [...state.incomeSources, source],
        })),

      setIncomeRange: (incomeRange) => set({ incomeRange }),

      togglePaymentMethod: (method) =>
        set((state) => ({
          paymentMethods: state.paymentMethods.includes(method)
            ? state.paymentMethods.filter((item) => item !== method)
            : [...state.paymentMethods, method],
        })),

      setConsent: (key, value) =>
        set((state) => ({
          consent: { ...state.consent, [key]: value },
        })),

      setLastStep: (lastStep) => set({ lastStep }),

      complete: () =>
        set({
          completed: true,
          completedAt: new Date().toISOString(),
          lastStep: 0,
        }),

      reset: () => set({ ...INITIAL_STATE, consent: { ...INITIAL_CONSENT } }),
    }),
    {
      name: "nera-onboarding",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

/**
 * Zustand persist merehidrasi dari localStorage setelah mount. Hook ini
 * memastikan gate/onboarding tidak mengambil keputusan sebelum data siap,
 * sehingga tidak ada redirect palsu atau hydration mismatch.
 */
export const useOnboardingHydrated = () => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persistApi = useOnboardingStore.persist;

    if (persistApi.hasHydrated()) {
      setHydrated(true);
      return;
    }

    return persistApi.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
};
