"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  FinancialStateData,
  Transaction,
  SmartNudge,
  WealthTier,
  DebtSnowballItem,
  AnomalyAlert,
  RecoveryMilestone,
  PersonaId,
  EmergencyTopUpRequest,
  BudgetPocket,
  DEFAULT_MOCK_STATE,
  INITIAL_BUDGET_POCKETS,
  INITIAL_WEALTH_TIERS,
  INITIAL_RECOVERY_MILESTONES,
  DEMO_PERSONA_SCENARIOS,
  evaluateFinancialState,
  calculateDebtSnowball,
  detectPredatoryTransfers,
} from "@nera/core";

/** What happened inside one budget pocket, for its history. */
export type PocketActivity = {
  id: string;
  pocketId: string;
  kind: "topup" | "spend" | "withdraw";
  amount: number;
  /** what the money was spent on ("Makan siang kantin") */
  title?: string;
  at: string;
};

const activity = (pocketId: string, kind: PocketActivity["kind"], amount: number, title?: string): PocketActivity => ({
  id: `pa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  pocketId,
  kind,
  amount,
  ...(title && { title }),
  at: new Date().toISOString(),
});

export interface FinancialStoreState extends FinancialStateData {
  transactions: Transaction[];
  nudges: SmartNudge[];
  wealthTiers: WealthTier[];
  activeDebts: DebtSnowballItem[];
  anomalyAlerts: AnomalyAlert[];
  recoveryMilestones: RecoveryMilestone[];
  coolingOffTargetTime: number | null; // epoch timestamp
  isSweepModalOpen: boolean;
  isParentPaired: boolean;
  emergencyTopUpRequests: EmergencyTopUpRequest[];
  budgetPockets: BudgetPocket[];
  /** newest first; kept on this device like the pockets themselves */
  pocketActivity: PocketActivity[];

  // Actions
  recalculateState: () => void;
  setAllowanceSplit: (allowance: number, pocketPct: number) => void;
  addTransaction: (tx: Omit<Transaction, "id" | "timestamp">) => void;
  executeEndOfMonthSweep: () => void;
  startCoolingOff: (hours?: number) => void;
  clearCoolingOff: () => void;
  setSweepModalOpen: (open: boolean) => void;
  addDebtItem: (debt: Omit<DebtSnowballItem, "id" | "payoffPriority">) => void;
  payOffDebt: (debtId: string) => void;
  depositToLifeGoals: (amount: number) => void;
  resolveNudge: (nudgeId: string) => void;
  detectAnomalies: () => void;
  acknowledgeAnomaly: (alertId: string) => void;
  updateRecoveryMilestones: () => void;
  resetToDefault: () => void;
  applyPersonaDemoScenario: (personaId: PersonaId) => void;
  completeParentPairing: () => void;
  resolveEmergencyTopUp: (id: string, action: "approved" | "dismissed") => void;
  createBudgetPocket: (
    pocket: Omit<BudgetPocket, "id" | "balance" | "spentThisMonth" | "createdAt">,
    initialAmount?: number
  ) => void;
  moveToBudgetPocket: (pocketId: string, amount: number) => void;
  withdrawFromBudgetPocket: (pocketId: string, amount: number) => void;
  spendFromBudgetPocket: (pocketId: string, amount: number, title: string) => void;
  deleteBudgetPocket: (pocketId: string) => void;
  setBudgetPocketTarget: (pocketId: string, targetAmount: number) => void;
}

const POCKET_TX_CATEGORY: Record<BudgetPocket["icon"], Transaction["category"]> = {
  food: "food",
  transport: "transport",
  education: "education",
  fun: "other",
  shopping: "other",
  health: "other",
  travel: "other",
  gadget: "other",
  gift: "other",
  home: "other",
  utility: "other",
};

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "tx_1",
    title: "Uang Saku Bulanan dari Ayah",
    category: "allowance",
    amount: 2000000,
    type: "income",
    timestamp: "2026-08-01T08:00:00Z",
    source: "TRANSFER",
  },
  {
    id: "tx_2",
    title: "Smart Allowance Split (80% Pocket)",
    category: "saving",
    amount: 1600000,
    type: "expense",
    timestamp: "2026-08-01T08:05:00Z",
    source: "AUTO_DEBET",
  },
  {
    id: "tx_3",
    title: "Smart Allowance Split (20% BNI Life Goals)",
    category: "saving",
    amount: 400000,
    type: "expense",
    timestamp: "2026-08-01T08:05:00Z",
    source: "AUTO_DEBET",
  },
  {
    id: "tx_4",
    title: "Makan Siang Kantin Tel-U",
    category: "food",
    amount: 25000,
    type: "expense",
    timestamp: "2026-08-18T12:30:00Z",
    source: "QRIS_BNI",
  },
  {
    id: "tx_5",
    title: "Kopi Tuku via QRIS",
    category: "food",
    amount: 29000,
    type: "expense",
    timestamp: "2026-08-17T15:20:00Z",
    source: "QRIS_BNI",
  },
  {
    id: "tx_6",
    title: "Ojek Online ke Kampus",
    category: "transport",
    amount: 15000,
    type: "expense",
    timestamp: "2026-08-17T07:30:00Z",
    source: "QRIS_BNI",
  },
  {
    id: "tx_7",
    title: "Fotokopi Materi Kuliah",
    category: "education",
    amount: 12000,
    type: "expense",
    timestamp: "2026-08-16T10:15:00Z",
    source: "QRIS_BNI",
  },
  {
    id: "tx_8",
    title: "Makan Malam Warteg",
    category: "food",
    amount: 18000,
    type: "expense",
    timestamp: "2026-08-16T19:00:00Z",
    source: "QRIS_BNI",
  },
];

const INITIAL_NUDGES: SmartNudge[] = [
  {
    id: "nudge_kos",
    title: "Tagihan Kos Jatuh Tempo",
    description: "Kos Griya Asri jatuh tempo dalam 3 hari. Saldomu cukup — bayar sekarang agar runway tetap aman.",
    category: "BILL_KOS",
    amount: 500000,
    dueDate: "2026-08-23",
    actionText: "Bayar via BNI",
    priority: "high",
  },
  {
    id: "nudge_ukt",
    title: "Tagihan UKT Semester Ganjil",
    description: "Jatuh tempo dalam 12 hari. Dapatkan cashback 5% bila bayar dengan BNI Mobile/wondr.",
    category: "BILL_UKT",
    amount: 3500000,
    dueDate: "2026-08-31",
    actionText: "Bayar via wondr",
    priority: "high",
  },
  {
    id: "nudge_sweep",
    title: "End-of-Month Smart Sweep",
    description: "Sisa saldo harian dapat disapu otomatis ke BNI Life Goals agar tidak boros di akhir bulan.",
    category: "SWEEP_LEFTOVER",
    amount: 45000,
    actionText: "Sapu Saldo Sekarang",
    priority: "medium",
  },
];

// Reason text is derived from the same default mock numbers used elsewhere in
// this file (dailyPocket/runwayDays), not an unrelated hardcoded string.
const INITIAL_EMERGENCY_TOPUP_REQUESTS: EmergencyTopUpRequest[] = [
  {
    id: "topup_1",
    reasonText: `Saldo Daily Pocket Budi tersisa Rp${DEFAULT_MOCK_STATE.dailyPocket.toLocaleString("id-ID")} dengan estimasi runway ${DEFAULT_MOCK_STATE.runwayDays} hari. Pengeluaran buku kuliah minggu ini di atas rata-rata.`,
    suggestedAmount: 150000,
    requestedAt: "2026-08-19T10:00:00Z",
    status: "pending",
  },
];

export const useFinancialStore = create<FinancialStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_MOCK_STATE,
      transactions: INITIAL_TRANSACTIONS,
      nudges: INITIAL_NUDGES,
      wealthTiers: INITIAL_WEALTH_TIERS,
      activeDebts: [],
      anomalyAlerts: [],
      recoveryMilestones: INITIAL_RECOVERY_MILESTONES,
      coolingOffTargetTime: null,
      isSweepModalOpen: false,
      isParentPaired: false,
      emergencyTopUpRequests: INITIAL_EMERGENCY_TOPUP_REQUESTS,
      pocketActivity: [],
      budgetPockets: INITIAL_BUDGET_POCKETS,

      recalculateState: () => {
        const state = get();
        const evalResult = evaluateFinancialState({
          monthlyAllowance: state.monthlyAllowance,
          dailyPocket: state.dailyPocket,
          dailyBudgetSafe: state.dailyBudgetSafe,
          totalMonthlyInstallments: state.totalMonthlyInstallments,
          activeLoanSourcesCount: state.activeLoanSources.length,
        });

        set({
          score: evalResult.score,
          state: evalResult.state,
          runwayDays: evalResult.runwayDays,
        });

        // Auto-update recovery milestones
        get().updateRecoveryMilestones();
      },

      setAllowanceSplit: (allowance: number, pocketPct: number) => {
        const pocketAmount = (allowance * pocketPct) / 100;
        const lockAmount = allowance - pocketAmount;
        const safeDaily = Math.round(pocketAmount / 30);

        set((s) => ({
          monthlyAllowance: allowance,
          dailyPocket: pocketAmount,
          lockPocket: s.lockPocket + lockAmount,
          dailyBudgetSafe: safeDaily,
        }));

        get().recalculateState();
      },

      addTransaction: (tx) => {
        const newTx: Transaction = {
          ...tx,
          id: `tx_${Date.now()}`,
          timestamp: new Date().toISOString(),
        };

        set((s) => {
          const updatedPocket =
            tx.type === "expense"
              ? Math.max(0, s.dailyPocket - tx.amount)
              : s.dailyPocket + tx.amount;

          return {
            transactions: [newTx, ...s.transactions],
            dailyPocket: updatedPocket,
          };
        });

        get().recalculateState();
        // Auto-scan for anomalies on new income transactions
        if (tx.type === "income") {
          get().detectAnomalies();
        }
      },

      executeEndOfMonthSweep: () => {
        const { dailyPocket } = get();
        if (dailyPocket <= 0) return;

        set((s) => ({
          lockPocket: s.lockPocket + s.dailyPocket,
          dailyPocket: 0,
          isSweepModalOpen: false,
          transactions: [
            {
              id: `tx_sweep_${Date.now()}`,
              title: "End-of-Month Auto Sweep to Life Goals",
              category: "saving",
              amount: s.dailyPocket,
              type: "expense",
              timestamp: new Date().toISOString(),
              source: "AUTO_DEBET",
            },
            ...s.transactions,
          ],
        }));

        get().recalculateState();
      },

      startCoolingOff: (hours = 24) => {
        const target = Date.now() + hours * 60 * 60 * 1000;
        set({ coolingOffTargetTime: target });
      },

      clearCoolingOff: () => {
        set({ coolingOffTargetTime: null });
      },

      setSweepModalOpen: (open: boolean) => {
        set({ isSweepModalOpen: open });
      },

      addDebtItem: (debt) => {
        const newDebt: DebtSnowballItem = {
          ...debt,
          id: `debt_${Date.now()}`,
          payoffPriority: 1,
        };

        const updatedList = [...get().activeDebts, newDebt];
        const snowball = calculateDebtSnowball(updatedList);

        set((s) => ({
          activeDebts: snowball.items,
          totalMonthlyInstallments: snowball.totalMonthlyBurn,
          loanCount: snowball.items.length,
          activeLoanSources: Array.from(new Set(snowball.items.map((d) => d.platformName))),
        }));

        get().recalculateState();
      },

      payOffDebt: (debtId: string) => {
        const remaining = get().activeDebts.filter((d) => d.id !== debtId);
        const snowball = calculateDebtSnowball(remaining);

        set({
          activeDebts: snowball.items,
          totalMonthlyInstallments: snowball.totalMonthlyBurn,
          loanCount: snowball.items.length,
          activeLoanSources: Array.from(new Set(snowball.items.map((d) => d.platformName))),
        });

        get().recalculateState();
      },

      depositToLifeGoals: (amount: number) => {
        set((s) => {
          const newLock = s.lockPocket + amount;
          const updatedTiers = s.wealthTiers.map((tier) => {
            if (tier.tier === 1) {
              const current = newLock;
              const progress = Math.min(100, Math.round((current / tier.targetAmount) * 100));
              return {
                ...tier,
                currentAmount: current,
                progressPercent: progress,
                isCompleted: progress >= 100,
              };
            }
            return tier;
          });

          return {
            lockPocket: newLock,
            dailyPocket: Math.max(0, s.dailyPocket - amount),
            wealthTiers: updatedTiers,
          };
        });

        get().recalculateState();
      },

      resolveNudge: (nudgeId: string) => {
        set((s) => ({
          nudges: s.nudges.filter((n) => n.id !== nudgeId),
        }));
      },

      detectAnomalies: () => {
        const { transactions, monthlyAllowance } = get();
        const alerts = detectPredatoryTransfers(transactions, monthlyAllowance);
        set({ anomalyAlerts: alerts });
      },

      acknowledgeAnomaly: (alertId: string) => {
        set((s) => ({
          anomalyAlerts: s.anomalyAlerts.map((a) =>
            a.id === alertId ? { ...a, isAcknowledged: true } : a
          ),
        }));
      },

      updateRecoveryMilestones: () => {
        const s = get();
        const dtiPercent = s.monthlyAllowance > 0
          ? (s.totalMonthlyInstallments / s.monthlyAllowance) * 100
          : 0;

        set({
          recoveryMilestones: s.recoveryMilestones.map((m) => {
            if (m.id === "rm_1" && s.activeDebts.length > 0) {
              return { ...m, isCompleted: true, completedAt: new Date().toISOString() };
            }
            if (m.id === "rm_3" && s.activeDebts.length < (s.loanCount || 1)) {
              return { ...m, isCompleted: true, completedAt: new Date().toISOString() };
            }
            if (m.id === "rm_4" && dtiPercent < 40) {
              return { ...m, isCompleted: true, completedAt: new Date().toISOString() };
            }
            if (m.id === "rm_5" && s.state === "AMAN") {
              return { ...m, isCompleted: true, completedAt: new Date().toISOString() };
            }
            return m;
          }),
        });
      },

      applyPersonaDemoScenario: (personaId: PersonaId) => {
        const scenario = DEMO_PERSONA_SCENARIOS[personaId];
        if (!scenario) return;

        set({
          monthlyAllowance: scenario.monthlyAllowance,
          dailyPocket: scenario.dailyPocket,
          lockPocket: scenario.lockPocket,
          dailyBudgetSafe: scenario.dailyBudgetSafe,
          totalMonthlyInstallments: scenario.totalMonthlyInstallments,
          loanCount: scenario.loanCount,
          activeLoanSources: scenario.activeLoanSources,
          safeConsecutiveMonths: scenario.safeConsecutiveMonths,
          transactions: scenario.transactions,
          nudges: scenario.nudges,
          activeDebts: scenario.activeDebts,
          anomalyAlerts: [],
          recoveryMilestones: INITIAL_RECOVERY_MILESTONES,
          coolingOffTargetTime: null,
          isSweepModalOpen: false,
        });

        // Score/state and the matched persona are re-derived by the existing
        // state machine + classifier from the numbers set above — never set directly.
        get().recalculateState();
      },

      completeParentPairing: () => {
        set({ isParentPaired: true });
      },

      resolveEmergencyTopUp: (id: string, action: "approved" | "dismissed") => {
        const request = get().emergencyTopUpRequests.find((r) => r.id === id);
        if (!request) return;

        set((s) => ({
          emergencyTopUpRequests: s.emergencyTopUpRequests.map((r) =>
            r.id === id ? { ...r, status: action } : r
          ),
          dailyPocket:
            action === "approved" ? s.dailyPocket + request.suggestedAmount : s.dailyPocket,
        }));

        if (action === "approved") {
          get().recalculateState();
        }
      },

      // Dana kantong diambil dari dan dikembalikan ke Daily Pocket (Kantong Utama),
      // jadi runway ikut menyesuaikan lewat recalculateState.
      createBudgetPocket: (pocket, initialAmount = 0) => {
        const amount = Math.min(Math.max(0, initialAmount), get().dailyPocket);
        const newPocket: BudgetPocket = {
          ...pocket,
          id: `pocket_${Date.now()}`,
          balance: amount,
          spentThisMonth: 0,
          createdAt: new Date().toISOString(),
        };

        set((s) => ({
          budgetPockets: [...s.budgetPockets, newPocket],
          dailyPocket: s.dailyPocket - amount,
          pocketActivity: amount > 0 ? [activity(newPocket.id, "topup", amount), ...s.pocketActivity] : s.pocketActivity,
        }));

        if (amount > 0) get().recalculateState();
      },

      moveToBudgetPocket: (pocketId: string, amount: number) => {
        const s = get();
        if (amount <= 0 || amount > s.dailyPocket) return;
        if (!s.budgetPockets.some((p) => p.id === pocketId)) return;

        set({
          budgetPockets: s.budgetPockets.map((p) =>
            p.id === pocketId ? { ...p, balance: p.balance + amount } : p
          ),
          dailyPocket: s.dailyPocket - amount,
          pocketActivity: [activity(pocketId, "topup", amount), ...s.pocketActivity],
        });

        get().recalculateState();
      },

      withdrawFromBudgetPocket: (pocketId: string, amount: number) => {
        const s = get();
        const pocket = s.budgetPockets.find((p) => p.id === pocketId);
        if (!pocket || amount <= 0 || amount > pocket.balance) return;

        set({
          budgetPockets: s.budgetPockets.map((p) =>
            p.id === pocketId ? { ...p, balance: p.balance - amount } : p
          ),
          dailyPocket: s.dailyPocket + amount,
          pocketActivity: [activity(pocketId, "withdraw", amount), ...s.pocketActivity],
        });

        get().recalculateState();
      },

      spendFromBudgetPocket: (pocketId: string, amount: number, title: string) => {
        const s = get();
        const pocket = s.budgetPockets.find((p) => p.id === pocketId);
        if (!pocket || pocket.kind !== "spending" || amount <= 0 || amount > pocket.balance) return;

        set({
          budgetPockets: s.budgetPockets.map((p) =>
            p.id === pocketId
              ? { ...p, balance: p.balance - amount, spentThisMonth: p.spentThisMonth + amount }
              : p
          ),
          transactions: [
            {
              id: `tx_${Date.now()}`,
              title: `${title} · Kantong ${pocket.name}`,
              category: POCKET_TX_CATEGORY[pocket.icon],
              amount,
              type: "expense",
              timestamp: new Date().toISOString(),
              source: "QRIS_BNI",
            },
            ...s.transactions,
          ],
          pocketActivity: [activity(pocketId, "spend", amount, title), ...s.pocketActivity],
        });
      },

      deleteBudgetPocket: (pocketId: string) => {
        const pocket = get().budgetPockets.find((p) => p.id === pocketId);
        if (!pocket) return;

        set((s) => ({
          budgetPockets: s.budgetPockets.filter((p) => p.id !== pocketId),
          dailyPocket: s.dailyPocket + pocket.balance,
          pocketActivity: s.pocketActivity.filter((a) => a.pocketId !== pocketId),
        }));

        if (pocket.balance > 0) get().recalculateState();
      },

      // only the budget/target changes; no money moves
      setBudgetPocketTarget: (pocketId: string, targetAmount: number) => {
        set((s) => ({
          budgetPockets: s.budgetPockets.map((p) => (p.id === pocketId ? { ...p, targetAmount: Math.max(0, targetAmount) } : p)),
        }));
      },

      resetToDefault: () => {
        set({
          ...DEFAULT_MOCK_STATE,
          transactions: INITIAL_TRANSACTIONS,
          nudges: INITIAL_NUDGES,
          wealthTiers: INITIAL_WEALTH_TIERS,
          activeDebts: [],
          anomalyAlerts: [],
          recoveryMilestones: INITIAL_RECOVERY_MILESTONES,
          coolingOffTargetTime: null,
          isSweepModalOpen: false,
          isParentPaired: false,
          emergencyTopUpRequests: INITIAL_EMERGENCY_TOPUP_REQUESTS,
          budgetPockets: INITIAL_BUDGET_POCKETS,
          pocketActivity: [],
        });
      },
    }),
    {
      name: "nera-financial-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
