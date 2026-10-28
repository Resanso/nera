"use client";

import React from "react";
import { TopAppBar } from "../../components/common/TopAppBar";
import { useFinancialStore } from "../../context/FinancialStore";
import { Card, RiskGauge } from "@nera/ui";
import { ParentPairingCard } from "../../components/parent/ParentPairingCard";
import { EmergencyTopUpCard } from "../../components/parent/EmergencyTopUpCard";
import { ShieldCheckIcon, EyeOffIcon, ChevronDownIcon } from "@nera/ui/icons";

// PRIVACY NOTE: this page must never render individual transactions or
// merchant names — only the aggregate score/status, mirroring the
// "Batasan Sebelum Manfaat" consent already established in Family Hub.
export default function ParentDashboardPage() {
  const { userName, score, state, isParentPaired, emergencyTopUpRequests } = useFinancialStore();

  if (!isParentPaired) {
    return (
      <div className="flex flex-col min-h-full">
        <TopAppBar />
        <ParentPairingCard />
      </div>
    );
  }

  const pendingRequests = emergencyTopUpRequests.filter((r) => r.status === "pending");

  const stateConfig = {
    AMAN: {
      label: "Aman",
      color: "#22C55E",
      copy: "Kondisi finansial anak Anda sehat dan terpantau baik.",
    },
    WASPADA: {
      label: "Waspada",
      color: "#FBBF24",
      copy: "Perlu perhatian — anak Anda mendekati batas pengeluaran aman.",
    },
    KRITIS: {
      label: "Kritis",
      color: "#EF4444",
      copy: "Butuh perhatian segera — hubungi anak Anda untuk berdiskusi.",
    },
  }[state];

  return (
    <div className="flex flex-col min-h-full bg-[#F1F2F4]">
      <TopAppBar />

      <main className="flex-1 px-4 pt-3.5 pb-6 space-y-4">
        {/* CHILD SELECTOR */}
        <button className="flex items-center gap-2.5 bg-white border border-[#E9E5DD] rounded-full pl-1.5 pr-3.5 py-1.5">
          <div className="w-8 h-8 rounded-full bg-[#FFB900] text-[#352500] flex items-center justify-center font-bold text-xs shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-bold text-[#2F240E]">{userName}</span>
          <ChevronDownIcon size={14} className="text-[#817B70]" />
        </button>

        <p className="text-sm text-[#736B60] -mt-2">Ringkasan untuk orang tua</p>

        {/* HERO CARD: Child Safety Status */}
        <div className="relative overflow-hidden rounded-[26px] bg-white p-4">
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-[#736B60]">
                Status Keamanan Finansial
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <ShieldCheckIcon size={22} style={{ color: stateConfig.color }} />
                <h2 className="text-[28px] font-bold text-[#2F240E] tracking-tight leading-none">
                  {stateConfig.label}
                </h2>
              </div>
              <p className="text-xs text-[#736B60] mt-2 leading-relaxed max-w-[210px]">
                {stateConfig.copy}
              </p>
            </div>
            <RiskGauge score={score} state={state} size="sm" />
          </div>
        </div>

        <Card className="p-3.5 bg-white border-dashed flex items-start gap-2.5">
          <EyeOffIcon size={16} className="text-[#76520E] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#736B60] leading-relaxed">
            Demi privasi anak Anda, Nera <strong className="text-[#2F240E]">tidak menampilkan</strong> riwayat transaksi atau nama merchant — hanya status keamanan finansial secara umum.
          </p>
        </Card>

        {pendingRequests.length > 0 && (
          <section className="space-y-2.5">
            <h3 className="text-[15px] font-bold text-[#2F240E]">Insight Nera</h3>
            {pendingRequests.map((request) => (
              <EmergencyTopUpCard key={request.id} request={request} />
            ))}
          </section>
        )}

        <Card className="p-4 space-y-2 bg-[#FFF3D6] border-[#76520E]/20">
          <div className="flex items-center gap-2 text-[#76520E]">
            <ShieldCheckIcon size={16} />
            <h3 className="text-xs font-bold uppercase tracking-wider">Terenkripsi BNI</h3>
          </div>
          <p className="text-xs text-[#2F240E] leading-relaxed">
            Akses ini bersifat read-only dan bisa dicabut kapan saja lewat aplikasi wondr by BNI milik Anda.
          </p>
        </Card>
      </main>
    </div>
  );
}
