"use client";

import React, { useState } from "react";
import Image from "next/image";
import { TopAppBar } from "../../../components/common/TopAppBar";
import { NeraOrb } from "../../../components/mascot/NeraOrb";
import { useFinancialStore } from "../../../context/FinancialStore";
import { Card, Button, RiskGauge, StatusBadge, CountdownTimer, ProgressRing } from "@nera/ui";
import {
  simulateLoanImpact,
  LoanSimulationResult,
  CAMPUS_SAFER_ALTERNATIVES,
} from "@nera/core";
import {
  ShieldAlertIcon,
  ClockIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  TrendingDownIcon,
  BuildingIcon,
  AlertOctagonIcon,
  SirenIcon,
  BanIcon,
  SparklesIcon,
} from "@nera/ui/icons";

export default function RiskCheckPage() {
  const {
    monthlyAllowance,
    dailyPocket,
    dailyBudgetSafe,
    totalMonthlyInstallments,
    activeLoanSources,
    score,
    state,
    coolingOffTargetTime,
    anomalyAlerts,
    startCoolingOff,
    clearCoolingOff,
    acknowledgeAnomaly,
  } = useFinancialStore();

  const [loanAmount, setLoanAmount] = useState<number>(1500000);
  const [tenorMonths, setTenorMonths] = useState<number>(3);
  const [interestRateMonthly, setInterestRateMonthly] = useState<number>(3.5);
  const [adminFee, setAdminFee] = useState<number>(75000);

  const [simulationResult, setSimulationResult] = useState<LoanSimulationResult | null>(null);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    const result = simulateLoanImpact(
      { loanAmount, tenorMonths, interestRateMonthly, adminFee },
      {
        monthlyAllowance,
        dailyPocket,
        dailyBudgetSafe,
        totalMonthlyInstallments,
        activeLoanSourcesCount: activeLoanSources.length,
      }
    );
    setSimulationResult(result);
  };

  const now = Date.now();
  const isCoolingActive = coolingOffTargetTime !== null && coolingOffTargetTime > now;
  const coolingProgress = isCoolingActive
    ? Math.max(0, Math.min(100, ((coolingOffTargetTime - now) / (24 * 60 * 60 * 1000)) * 100))
    : 0;

  const unacknowledgedAlerts = anomalyAlerts.filter((a) => !a.isAcknowledged);

  return (
    <div className="flex flex-col min-h-full">
      <TopAppBar title="AI Risk Intelligence" showBack />

      <main className="flex-1 px-4 py-4 space-y-4">
        {/* FINANCIAL HEALTH OVERVIEW GAUGE */}
        <Card className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#736B60]">
              Skor Risiko Finansial
            </span>
            <div className="flex items-center gap-2">
              <StatusBadge status={state} />
            </div>
            <p className="text-xs text-[#736B60] pt-1">
              DTI: {((totalMonthlyInstallments / (monthlyAllowance || 1)) * 100).toFixed(0)}% • {activeLoanSources.length} Cicilan Aktif
            </p>
          </div>
          <RiskGauge score={score} state={state} size="sm" />
        </Card>

        {/* ANOMALY DETECTION ALERTS */}
        {unacknowledgedAlerts.length > 0 && (
          <div className="space-y-2">
            {unacknowledgedAlerts.map((alert) => (
              <Card
                key={alert.id}
                className="p-4 bg-[#FBE4DE] border-[#EF4444]/40 space-y-3"
              >
                <div className="flex items-center gap-2 text-[#EF4444]">
                  <SirenIcon size={18} className="animate-pulse" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    {alert.matchedPattern.riskLabel}
                  </h3>
                </div>
                <div className="p-3 bg-white/80 rounded-xl border border-[#EF4444]/20 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#736B60]">Transfer Terdeteksi:</span>
                    <span className="font-bold text-[#EF4444]">{formatRupiah(alert.detectedAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#736B60]">Sumber:</span>
                    <span className="font-semibold text-[#2F240E]">{alert.detectedSource}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#736B60]">Estimasi Tekor/Bulan:</span>
                    <span className="font-bold text-[#EF4444]">-{formatRupiah(alert.realDeficitPerMonth)}</span>
                  </div>
                </div>
                <p className="text-xs text-[#2F240E] leading-relaxed">
                  Transfer ini cocok dengan pola platform pinjaman berisiko tinggi. Periksa dan pastikan ini bukan dana pinjol ilegal.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => acknowledgeAnomaly(alert.id)}
                  className="text-xs h-8"
                >
                  Saya Sudah Tahu, Abaikan Peringatan
                </Button>
              </Card>
            ))}
          </div>
        )}

        {/* 24-HOUR COOLING-OFF TIMER */}
        {isCoolingActive && (
          <Card className="p-5 space-y-4 border-[#C43737]/20 bg-[#FBE4DE]/50">
            <div className="flex items-center gap-2 text-[#EF4444]">
              <AlertOctagonIcon size={18} />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                24-Hour Cooling-Off Guardrail
              </h3>
            </div>

            {/* Large countdown with progress ring */}
            <div className="flex items-center justify-center py-2">
              <ProgressRing
                progress={coolingProgress}
                size={120}
                strokeWidth={8}
                color="#EF4444"
                trackColor="#FBE4DE"
              >
                <CountdownTimer
                  targetTime={coolingOffTargetTime}
                  size="sm"
                />
              </ProgressRing>
            </div>

            <p className="text-xs text-[#2F240E] text-center leading-relaxed">
              Jeda tunda keputusan impulsif sedang berlangsung. Tinjau kembali alternatif aman di bawah ini sebelum membuat keputusan.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={clearCoolingOff}
                className="text-xs h-9"
              >
                Batalkan Timer
              </Button>
            </div>
          </Card>
        )}

        {/* LOAN SIMULATOR FORM */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlertIcon size={16} className="text-[#76520E]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#2F240E]">
              Simulator Risiko Cicilan
            </h3>
          </div>

          <form onSubmit={handleSimulate} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#736B60] mb-1">
                Plafon Pinjaman / Cicilan (Rp)
              </label>
              <input
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold text-[#2F240E] border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#76520E]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#736B60] mb-1">
                  Tenor (Bulan)
                </label>
                <select
                  value={tenorMonths}
                  onChange={(e) => setTenorMonths(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#76520E]"
                >
                  <option value={1}>1 Bulan</option>
                  <option value={3}>3 Bulan</option>
                  <option value={6}>6 Bulan</option>
                  <option value={12}>12 Bulan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#736B60] mb-1">
                  Bunga Bulanan (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={interestRateMonthly}
                  onChange={(e) => setInterestRateMonthly(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#76520E]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#736B60] mb-1">
                Biaya Admin / Layanan (Rp)
              </label>
              <input
                type="number"
                value={adminFee}
                onChange={(e) => setAdminFee(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#76520E]"
              />
            </div>

            <Button type="submit" variant="primary" fullWidth className="rounded-xl mt-2">
              Analisis Dampak Defisit
            </Button>
          </form>
        </Card>

        {/* SIMULATION RESULT — REALITY CHECK UI */}
        {simulationResult && (
          <div className="space-y-4">
            <Card
              className={`p-4 space-y-3 ${
                simulationResult.isDangerous
                  ? "border-[#EF4444] bg-[#FBE4DE]/20"
                  : "border-[#22C55E] bg-[#DDF0E6]/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Nera reacts to the verdict: worried when the loan would push into deficit */}
                  <NeraOrb mood={simulationResult.isDangerous ? "alert" : "happy"} size={40} trackPointer={false} />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#2F240E]">
                    Hasil Simulasi NerAI
                  </span>
                </div>
                <StatusBadge status={simulationResult.projectedState} />
              </div>

              {/* REALITY CHECK: Real Deficit Callout */}
              {simulationResult.isDangerous && simulationResult.monthlyDeficitAmount > 0 && (
                <div className="p-4 bg-[#EF4444] rounded-2xl text-white text-center space-y-1">
                  <TrendingDownIcon size={24} className="mx-auto" />
                  <p className="text-lg font-black">
                    Tekor {formatRupiah(simulationResult.monthlyDeficitAmount)}
                  </p>
                  <p className="text-[11px] text-white/80">setiap bulan sejak bulan pertama</p>
                </div>
              )}

              {/* Breakdown */}
              <div className="p-3 bg-white rounded-xl border border-[#E9E5DD] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#736B60]">Cicilan per Bulan:</span>
                  <span className="font-bold text-[#2F240E]">
                    {formatRupiah(simulationResult.monthlyInstallment)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#736B60]">Total Bunga & Admin:</span>
                  <span className="font-bold text-[#EF4444]">
                    +{formatRupiah(simulationResult.totalInterestAndFees)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#736B60]">Proyeksi DTI Baru:</span>
                  <span className="font-bold text-[#2F240E]">
                    {simulationResult.newDti}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#736B60]">Skor Risiko Baru:</span>
                  <span className={`font-bold ${
                    simulationResult.projectedState === "KRITIS" ? "text-[#EF4444]" :
                    simulationResult.projectedState === "WASPADA" ? "text-[#FBBF24]" : "text-[#22C55E]"
                  }`}>
                    {simulationResult.projectedScore}
                  </span>
                </div>
              </div>

              {/* Explanation */}
              <p className="text-xs text-[#2F240E] font-medium leading-relaxed">
                {simulationResult.deficitExplanation}
              </p>

              {/* Cooling-off trigger */}
              {simulationResult.coolingOffRequired && !isCoolingActive && (
                <Button
                  variant="danger"
                  fullWidth
                  onClick={() => startCoolingOff(24)}
                  className="rounded-xl text-xs gap-1.5"
                >
                  <ClockIcon size={16} /> Aktifkan 24-Hour Cooling-Off Timer
                </Button>
              )}
            </Card>

            {/* SAFER CAMPUS ALTERNATIVES */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#2F240E]">
                Alternatif Aman Kampus (Rekomendasi Nera)
              </h3>

              <div className="space-y-2">
                {CAMPUS_SAFER_ALTERNATIVES.map((alt) => (
                  <Card key={alt.id} className="p-3.5 space-y-2 border-l-4 border-l-[#5B410C]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <BuildingIcon size={14} className="text-[#5B410C]" />
                        <h4 className="text-xs font-bold text-[#2F240E]">{alt.title}</h4>
                      </div>
                      <span className="text-[10px] bg-[#DDF0E6] text-[#15803D] font-bold px-2 py-0.5 rounded-full">
                        {alt.badge}
                      </span>
                    </div>
                    <p className="text-xs text-[#736B60] leading-relaxed">{alt.description}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-semibold text-[#5B410C]">
                        Plafon s/d {formatRupiah(alt.maxAmount)}
                      </span>
                      <a
                        href={alt.actionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-[#76520E] hover:underline flex items-center gap-1"
                      >
                        Ajukan Resmi <ArrowRightIcon size={12} />
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
