import { z } from "zod";

export type FinancialStatus = "AMAN" | "WASPADA" | "KRITIS";

export interface UserProfile {
  id: string;
  userName: string;
  campus: string;
  nim?: string;
  avatarUrl?: string;
  email: string;
  isPairedWithParent: boolean;
  parentName?: string;
  parentPhone?: string;
  pairedAt?: string;
}

export interface FinancialStateData {
  userName: string;
  campus: string;
  score: number;
  state: FinancialStatus;
  monthlyAllowance: number;
  dailyPocket: number;
  lockPocket: number; // BNI Life Goals
  dailyBudgetSafe: number;
  runwayDays: number;
  totalMonthlyInstallments: number;
  loanCount: number;
  activeLoanSources: string[];
  safeConsecutiveMonths: number;
}

export interface Transaction {
  id: string;
  title: string;
  category: "allowance" | "food" | "transport" | "education" | "loan" | "saving" | "other";
  amount: number;
  type: "income" | "expense";
  timestamp: string;
  source: "BNI_TAPLUS" | "QRIS_BNI" | "TRANSFER" | "AUTO_DEBET";
  isNudgeTarget?: boolean;
}

export interface SmartNudge {
  id: string;
  title: string;
  description: string;
  category: "BILL_UKT" | "BILL_KOS" | "SWEEP_LEFTOVER" | "LOAN_RISK" | "WEALTH_TIER";
  amount?: number;
  dueDate?: string;
  actionText: string;
  actionUrl?: string;
  priority: "low" | "medium" | "high";
  isResolved?: boolean;
}

export interface LoanSimulationInput {
  loanAmount: number;
  tenorMonths: number;
  interestRateMonthly: number;
  adminFee: number;
  platformName?: string;
}

export interface LoanSimulationResult {
  monthlyInstallment: number;
  totalRepayment: number;
  totalInterestAndFees: number;
  newMonthlyInstallmentTotal: number;
  newDti: number;
  projectedScore: number;
  projectedState: FinancialStatus;
  monthlyDeficitAmount: number;
  isDangerous: boolean;
  deficitExplanation: string;
  coolingOffRequired: boolean;
  saferAlternatives: SaferAlternative[];
}

export interface SaferAlternative {
  id: string;
  title: string;
  provider: string;
  interestRatePercent: number;
  maxAmount: number;
  description: string;
  badge: string;
  actionUrl?: string;
}

export interface DebtSnowballItem {
  id: string;
  platformName: string;
  outstandingPrincipal: number;
  monthlyInstallment: number;
  interestRateMonthly: number;
  remainingTenorMonths: number;
  payoffPriority: number; // 1 = pay first
}

export interface DebtSnowballPlan {
  items: DebtSnowballItem[];
  totalOutstanding: number;
  totalMonthlyBurn: number;
  estimatedMonthsToClear: number;
  monthlySavingsAfterClear: number;
  recommendedSteps: string[];
}

export interface WealthTier {
  tier: 1 | 2 | 3;
  name: string;
  productName: string;
  targetAmount: number;
  currentAmount: number;
  progressPercent: number;
  isUnlocked: boolean;
  isCompleted: boolean;
  minMonthlyReturnPct?: number;
  description: string;
  badgeText: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "nera" | "system";
  text: string;
  timestamp: string;
  quickReplies?: string[];
  suggestedAction?: {
    label: string;
    path: string;
  };
}

export interface PredatoryPattern {
  id: string;
  platformNameKeywords: string[];
  typicalAmountRange: [number, number];
  typicalInterestMonthly: number;
  riskLabel: string;
}

export interface AnomalyAlert {
  id: string;
  transactionId: string;
  matchedPattern: PredatoryPattern;
  detectedAmount: number;
  detectedSource: string;
  timestamp: string;
  severity: "warning" | "critical";
  isAcknowledged: boolean;
  realDeficitPerMonth: number;
}

export interface RecoveryMilestone {
  id: string;
  label: string;
  description: string;
  isCompleted: boolean;
  completedAt?: string;
  order: number;
}

export type PersonaId =
  | "konsisten_nabung"
  | "pejuang_runway"
  | "anak_rantau"
  | "calon_mapan"
  | "wirausaha_kampus"
  | "pejuang_pemulihan";

export interface PersonaMatch {
  id: PersonaId;
  label: string;
  tagline: string;
  matchReasons: string[];
}

export interface BniOffer {
  id: string;
  personaId: PersonaId;
  productName: string;
  category: "Tabungan" | "Investasi" | "Kartu Kredit" | "Proteksi" | "Pinjaman Resmi" | "Wirausaha";
  benefit: string;
  eligibilityNote: string;
  sourceLabel: string;
  badge: string;
  actionLabel: string;
  actionType: "wondr" | "external";
  actionUrl?: string;
}

export interface EmergencyTopUpRequest {
  id: string;
  reasonText: string;
  suggestedAmount: number;
  requestedAt: string;
  status: "pending" | "approved" | "dismissed";
}

export interface CampusOverviewMetrics {
  totalMonitoredStudents: number;
  avgScore: number;
  criticalPercentage: number;
}

export interface CampusTrendPoint {
  week: string;
  avgScore: number;
}

export interface CampusScoreDistributionItem {
  status: FinancialStatus;
  count: number;
}

export interface CampusCohortRisk {
  id: string;
  faculty: string;
  cohortYear: number;
  totalStudents: number;
  amanPct: number;
  waspadaPct: number;
  kritisPct: number;
}

export interface CampusMetricCard {
  id: string;
  label: string;
  value: string;
  trendPct: number; // signed, e.g. 6.2 or -1.3
  trendIsPositive: boolean; // whether this direction of change is good news
  sparkline: number[];
  accent: "purple" | "teal" | "critical";
}

export interface CampusHealthIndicator {
  id: string;
  label: string;
  valuePct: number;
  accent: "purple" | "teal" | "amber" | "critical";
}

export interface CampusKeyInsight {
  title: string;
  description: string;
}

export interface CampusProfile {
  name: string;
  institution: string;
}

export interface CampusInterventionAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  recommendedAction: string;
  detectedAt: string;
}

export type BudgetPocketKind = "spending" | "saving";

export type BudgetPocketIcon =
  | "food"
  | "transport"
  | "education"
  | "fun"
  | "shopping"
  | "health"
  | "travel"
  | "gadget"
  | "gift"
  | "home"
  | "utility";

export type BudgetPocketTone =
  | "yellow"
  | "sand"
  | "peach"
  | "cream"
  | "brown"
  | "mint"
  | "teal"
  | "sky"
  | "pink"
  | "cyan";

// Kantong budget ala "Kantong" Bank Jago: dana dipisah dari Daily Pocket
// (Kantong Utama) agar tiap pos pengeluaran/tabungan punya batasnya sendiri.
export interface BudgetPocket {
  id: string;
  name: string;
  kind: BudgetPocketKind;
  icon: BudgetPocketIcon;
  tone: BudgetPocketTone;
  balance: number;
  // spending: batas belanja per bulan; saving: target tabungan
  targetAmount: number;
  // Hanya untuk kantong belanja: total yang sudah dipakai bulan ini
  spentThisMonth: number;
  createdAt: string;
}

// Zod Schemas for validation
export const LoanSimulationInputSchema = z.object({
  loanAmount: z.number().positive(),
  tenorMonths: z.number().int().positive(),
  interestRateMonthly: z.number().min(0),
  adminFee: z.number().min(0).default(0),
  platformName: z.string().optional(),
});
