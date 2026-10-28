"use client";

import React, { useState } from "react";
import { TopAppBar } from "../../../components/common/TopAppBar";
import { useFinancialStore } from "../../../context/FinancialStore";
import { Card, Button } from "@nera/ui";
import { SlidersIcon, ArrowDownLeftIcon, WalletIcon, LockIcon, CheckCircleIcon, SparklesIcon } from "@nera/ui/icons";

export default function ParentAllowancePage() {
  const { monthlyAllowance, setAllowanceSplit } = useFinancialStore();

  const [splitRatio, setSplitRatio] = useState<number>(80);
  const [allowanceInput, setAllowanceInput] = useState<number>(monthlyAllowance || 2000000);
  const [isSaved, setIsSaved] = useState(false);

  const pocketAmount = (allowanceInput * splitRatio) / 100;
  const lockAmount = allowanceInput - pocketAmount;

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  const handleSave = () => {
    setAllowanceSplit(allowanceInput, splitRatio);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="flex flex-col min-h-full">
      <TopAppBar title="Atur Transfer Otomatis" showBack />

      <main className="flex-1 px-4 pt-3.5 pb-6 space-y-4">
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <SlidersIcon size={16} className="text-[#76520E]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#2F240E]">
              Transfer Uang Saku Bulanan
            </h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#736B60] mb-1">
              Nominal Transfer Rutin
            </label>
            <input
              type="number"
              value={allowanceInput}
              onChange={(e) => setAllowanceInput(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-bold text-[#2F240E] border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#76520E]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-[#736B60]">
              <span>Daily Pocket / QRIS ({splitRatio}%)</span>
              <span>Lock Pocket / Tabungan Wajib ({100 - splitRatio}%)</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={splitRatio}
              onChange={(e) => setSplitRatio(Number(e.target.value))}
              className="w-full accent-[#76520E] cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-[#736B60] font-semibold uppercase tracking-wider">
              <SparklesIcon size={10} className="text-[#76520E]" /> Pratinjau Alokasi Real-Time
            </div>

            <div className="p-3 bg-[#F1F2F4] rounded-xl border border-[#E9E5DD] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#DDF0E6] flex items-center justify-center">
                <ArrowDownLeftIcon size={14} className="text-[#22C55E]" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-[#736B60]">Transfer per Bulan</p>
                <p className="text-sm font-bold text-[#2F240E]">{formatRupiah(allowanceInput)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-[#FFF3D6] rounded-xl border border-[#A36A00]/30 space-y-0.5">
                <div className="flex items-center gap-1 text-[11px] text-[#A36A00] font-semibold">
                  <WalletIcon size={12} /> Daily Pocket
                </div>
                <p className="text-sm font-black text-[#2F240E]">{formatRupiah(pocketAmount)}</p>
              </div>

              <div className="p-3 bg-[#DDF0E6] rounded-xl border border-[#22C55E]/30 space-y-0.5">
                <div className="flex items-center gap-1 text-[11px] text-[#15803D] font-semibold">
                  <LockIcon size={12} /> Lock Pocket
                </div>
                <p className="text-sm font-black text-[#2F240E]">{formatRupiah(lockAmount)}</p>
              </div>
            </div>
          </div>

          <Button variant="primary" fullWidth onClick={handleSave} className="rounded-xl mt-2">
            {isSaved ? (
              <span className="flex items-center gap-1.5">
                <CheckCircleIcon size={16} /> Tersimpan Otomatis!
              </span>
            ) : (
              "Simpan & Aktifkan Transfer Otomatis"
            )}
          </Button>
        </Card>
      </main>
    </div>
  );
}
