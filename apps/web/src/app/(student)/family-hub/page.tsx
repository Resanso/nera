"use client";

import React, { useState } from "react";
import Image from "next/image";
import { TopAppBar } from "../../../components/common/TopAppBar";
import { useFinancialStore } from "../../../context/FinancialStore";
import { Card, Button, Modal, TrustBanner } from "@nera/ui";
import {
  UsersIcon,
  ShieldCheckIcon,
  QrCodeIcon,
  ShareNodesIcon,
  SlidersIcon,
  CheckCircleIcon,
  LockIcon,
  WalletIcon,
  ArrowRightIcon,
  InfoIcon,
  EyeIcon,
  EyeOffIcon,
  FingerprintIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  SparklesIcon,
} from "@nera/ui/icons";

export default function FamilyHubPage() {
  const {
    userName,
    monthlyAllowance,
    dailyPocket,
    lockPocket,
    setAllowanceSplit,
  } = useFinancialStore();

  const [splitRatio, setSplitRatio] = useState<number>(80);
  const [allowanceInput, setAllowanceInput] = useState<number>(monthlyAllowance || 2000000);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const pocketAmount = (allowanceInput * splitRatio) / 100;
  const lockAmount = allowanceInput - pocketAmount;

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  const handleSaveSplit = () => {
    setAllowanceSplit(allowanceInput, splitRatio);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="flex flex-col min-h-full">
      <TopAppBar title="Family Hub & Pairing" showBack />

      <main className="flex-1 px-4 py-4 space-y-4">
        {/* SECTION 1: PERMISSION & ONBOARDING — "Batasan Sebelum Manfaat" */}
        <Card className="p-0 overflow-hidden">
          <TrustBanner
            icon={<FingerprintIcon size={18} />}
            eyebrow="Izin Akses Transparan"
            title={<>&quot;Batasan Sebelum Manfaat&quot;</>}
            showSparkles
          >
            Nera hanya membaca <strong className="text-white">kategori mutasi masuk/keluar</strong> untuk kalkulasi runway & proteksi cicilan berisiko. Tidak pernah membaca detail nomor rekening, nama penerima, atau data pribadi lainnya.
          </TrustBanner>

          <div className="p-4 space-y-3">
            {/* Permission toggles */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <EyeIcon size={14} className="text-[#5B410C]" />
                <span className="text-xs font-medium text-[#2F240E]">Baca Kategori Mutasi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-[#22C55E] bg-[#DDF0E6] px-2 py-0.5 rounded-full">READ-ONLY</span>
                <div className="w-9 h-5 bg-[#22C55E] rounded-full relative cursor-pointer">
                  <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <EyeOffIcon size={14} className="text-[#736B60]" />
                <span className="text-xs font-medium text-[#2F240E]">Akses Detail Rekening</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-[#736B60] bg-[#F7F5F0] px-2 py-0.5 rounded-full">DIBLOKIR</span>
                <div className="w-9 h-5 bg-[#E9E5DD] rounded-full relative">
                  <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#E9E5DD]">
              <span className="text-xs font-medium text-[#2F240E]">Status Proteksi Data</span>
              <span className="inline-flex items-center gap-1 text-[#22C55E] font-semibold text-xs bg-[#DDF0E6] px-2.5 py-1 rounded-full">
                <ShieldCheckIcon size={12} /> Terenkripsi BNI
              </span>
            </div>
          </div>
        </Card>

        {/* SECTION 2: PARENT-CHILD LINK */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-[12px] bg-[#FFF0BD] flex items-center justify-center text-[#76520E]">
                <UsersIcon size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#2F240E]">Akun Terhubung</h4>
                <p className="text-[11px] text-[#736B60]">Hendra Pratama (Ayah)</p>
              </div>
            </div>
            <span className="text-[10px] bg-[#DDF0E6] text-[#15803D] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
              <CheckCircleIcon size={10} /> TERVERIFIKASI
            </span>
          </div>

          {/* Account details */}
          <div className="p-3 bg-[#F1F2F4] rounded-xl border border-[#E9E5DD] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#736B60]">Rekening Orang Tua</span>
              <span className="font-mono font-medium text-[#2F240E]">BNI •••• 7890</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#736B60]">Rekening Anak</span>
              <span className="font-mono font-medium text-[#2F240E]">wondr •••• 4501</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#736B60]">Tanggal Pairing</span>
              <span className="font-medium text-[#2F240E]">15 Januari 2026</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsQrModalOpen(true)}
              className="text-xs h-9 rounded-xl gap-1.5"
            >
              <QrCodeIcon size={14} /> Tampilkan QR
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => alert("Link undangan pairing telah disalin!")}
              className="text-xs h-9 rounded-xl gap-1.5"
            >
              <ShareNodesIcon size={14} /> Share Link
            </Button>
          </div>
        </Card>

        {/* SECTION 3: SMART ALLOWANCE SPLITTER */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersIcon size={16} className="text-[#76520E]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#2F240E]">
                Smart Allowance Splitter
              </h3>
            </div>
            <span className="text-xs font-bold text-[#76520E] bg-[#76520E]/10 px-2 py-0.5 rounded-full">
              {splitRatio}% / {100 - splitRatio}%
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#736B60] mb-1">
              Nominal Uang Saku Bulanan
            </label>
            <input
              type="number"
              value={allowanceInput}
              onChange={(e) => setAllowanceInput(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-bold text-[#2F240E] border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#76520E]"
            />
          </div>

          {/* Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-[#736B60]">
              <span>Kebutuhan Harian ({splitRatio}%)</span>
              <span>Life Goals ({100 - splitRatio}%)</span>
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

          {/* Auto-routing Visualization */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-[#736B60] font-semibold uppercase tracking-wider">
              <SparklesIcon size={10} className="text-[#76520E]" /> Pratinjau Alokasi Otomatis
            </div>

            {/* Flow visualization */}
            <div className="relative">
              {/* Source */}
              <div className="p-3 bg-[#F1F2F4] rounded-xl border border-[#E9E5DD] flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#DDF0E6] flex items-center justify-center">
                  <ArrowDownLeftIcon size={14} className="text-[#22C55E]" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-[#736B60]">Uang Saku Masuk</p>
                  <p className="text-sm font-bold text-[#2F240E]">{formatRupiah(allowanceInput)}</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center py-1.5">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-0.5 h-3 bg-[#76520E]/30" />
                  <ArrowRightIcon size={12} className="text-[#76520E] rotate-90" />
                </div>
              </div>

              {/* Destinations */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-[#FFF3D6] rounded-xl border border-[#A36A00]/30 space-y-0.5">
                  <div className="flex items-center gap-1 text-[11px] text-[#A36A00] font-semibold">
                    <WalletIcon size={12} /> Daily Pocket
                  </div>
                  <p className="text-sm font-black text-[#2F240E]">{formatRupiah(pocketAmount)}</p>
                  <p className="text-[10px] text-[#736B60]">~{formatRupiah(Math.round(pocketAmount / 30))}/hari</p>
                </div>

                <div className="p-3 bg-[#DDF0E6] rounded-xl border border-[#22C55E]/30 space-y-0.5">
                  <div className="flex items-center gap-1 text-[11px] text-[#15803D] font-semibold">
                    <LockIcon size={12} /> BNI Life Goals
                  </div>
                  <p className="text-sm font-black text-[#2F240E]">{formatRupiah(lockAmount)}</p>
                  <p className="text-[10px] text-[#15803D]">Tabungan Wajib Aman</p>
                </div>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            fullWidth
            onClick={handleSaveSplit}
            className="rounded-xl mt-2"
          >
            {isSaved ? (
              <span className="flex items-center gap-1.5">
                <CheckCircleIcon size={16} /> Tersimpan Otomatis!
              </span>
            ) : (
              "Terapkan Alokasi Otomatis"
            )}
          </Button>
        </Card>

        {/* SECTION 4: NEXT MONTH PREVIEW */}
        <Card className="p-4 space-y-2 bg-[#FFF8E6] border-[#EEDB9A]">
          <div className="flex items-center gap-1.5 text-[11px] text-[#A36A00] font-semibold uppercase tracking-wider">
            <SparklesIcon size={12} /> Pratinjau Bulan Depan
          </div>
          <p className="text-xs text-[#736B60] leading-relaxed">
            Saat uang saku <strong className="text-[#2F240E]">{formatRupiah(allowanceInput)}</strong> masuk bulan depan,
            Nera akan otomatis mengalokasikan{" "}
            <strong className="text-[#76520E]">{formatRupiah(pocketAmount)}</strong> ke Daily Pocket dan{" "}
            <strong className="text-[#15803D]">{formatRupiah(lockAmount)}</strong> ke tabungan BNI Life Goals secara instan.
          </p>
        </Card>
      </main>

      {/* QR PAIRING MODAL */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title="QR Code Pairing Ortu-Anak"
      >
        <div className="text-center space-y-4">
          <div className="w-48 h-48 mx-auto bg-[#FFF8E6] rounded-2xl border-2 border-dashed border-[#BA8500] flex flex-col items-center justify-center p-4">
            <QrCodeIcon size={110} className="text-[#76520E]" />
            <span className="text-[10px] font-mono text-[#736B60] mt-2">NERA-PAIR-BUDI-1301</span>
          </div>
          <p className="text-xs text-[#736B60]">
            Minta orang tua memindai QR code ini melalui aplikasi <strong className="text-[#5B410C]">wondr by BNI</strong> untuk aktivasi pairing dan autodebet allowance.
          </p>
          <Button variant="outline" fullWidth onClick={() => setIsQrModalOpen(false)}>
            Tutup
          </Button>
        </div>
      </Modal>
    </div>
  );
}
