"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { TopAppBar } from "../../../components/common/TopAppBar";
import { useFinancialStore } from "../../../context/FinancialStore";
import { Button, Card, cn } from "@nera/ui";
import { Transaction } from "@nera/core";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileSpreadsheet,
  Images,
  Loader2,
} from "lucide-react";

type TabId = "manual" | "upload";

type AnalysisStage = "idle" | "analyzing" | "done";

const TABS: { id: TabId; label: string }[] = [
  { id: "manual", label: "Manual" },
  { id: "upload", label: "Upload" },
];

const UPLOAD_METHODS: {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  accept: string;
  capture?: boolean;
}[] = [
  {
    id: "file",
    title: "Upload Mutasi / File Transaksi",
    desc: "Gunakan PDF, Excel, CSV, atau format lainnya.",
    icon: FileSpreadsheet,
    accept: ".pdf,.csv,.xlsx,.xls,image/*",
  },
  {
    id: "camera",
    title: "Ambil Foto",
    desc: "Arahkan kamera ke struk pembayaran atau mutasi rekening.",
    icon: Camera,
    accept: "image/*",
    capture: true,
  },
  {
    id: "gallery",
    title: "Pilih dari Galeri",
    desc: "Pilih foto struk atau screenshot mutasi dari galeri.",
    icon: Images,
    accept: "image/*",
  },
];

const MANUAL_CATEGORIES: { value: Transaction["category"]; label: string }[] = [
  { value: "food", label: "Makan & Minum" },
  { value: "transport", label: "Transportasi" },
  { value: "education", label: "Edukasi" },
  { value: "other", label: "Lainnya" },
];

const parseAmount = (raw: string) => Number(raw.replace(/\D/g, "")) || 0;
const formatAmountInput = (raw: string) => {
  const n = parseAmount(raw);
  return n ? n.toLocaleString("id-ID") : "";
};

export default function UploadTransactionPage() {
  const { addTransaction } = useFinancialStore();

  const [activeTab, setActiveTab] = useState<TabId>("upload");
  const [stage, setStage] = useState<AnalysisStage>("idle");
  const [fileName, setFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const [manualCategory, setManualCategory] = useState<Transaction["category"]>("food");
  const [manualTitle, setManualTitle] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [isManualSaved, setIsManualSaved] = useState(false);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const timeoutRef = useRef<number | null>(null);

  const startAnalysis = useCallback((name: string) => {
    setFileName(name);
    setStage("analyzing");

    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setStage("done"), 2200);
  }, []);

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    },
    []
  );

  // Paste anywhere on this screen behaves like dropping the content into the
  // dashed zone — images/files are analyzed directly, plain text counts as a
  // pasted mutation copy. Inputs are excluded so the Manual form stays usable.
  useEffect(() => {
    const handleWindowPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "OPTION"].includes(target.tagName)) return;

      const files = event.clipboardData?.files;
      if (files && files.length > 0) {
        event.preventDefault();
        startAnalysis(files[0].name || "File tempel");
        return;
      }

      const text = event.clipboardData?.getData("text/plain");
      if (text && text.trim().length > 0) {
        event.preventDefault();
        startAnalysis("Teks mutasi tempel");
      }
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [startAnalysis]);

  const scrollPasteZoneIntoView = () => {
    document.getElementById("paste-zone")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(manualAmount);
    if (!manualTitle.trim() || amount <= 0) return;

    addTransaction({
      title: manualTitle.trim(),
      category: manualCategory,
      amount,
      type: "expense",
      source: "QRIS_BNI",
    });
    setManualTitle("");
    setManualAmount("");
    setIsManualSaved(true);
    window.setTimeout(() => setIsManualSaved(false), 3000);
  };

  const manualAmountValue = parseAmount(manualAmount);
  const isManualValid = manualTitle.trim().length > 0 && manualAmountValue > 0;

  return (
    <div className="flex flex-col min-h-full">
      <TopAppBar title="Import Transaksi" showBack />

      <main className="flex-1 px-4 py-4 space-y-3.5">
        {/* Segmented input-mode switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-[16px] border border-[#E9E5DD] bg-white p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "h-9 rounded-[12px] text-[12px] font-bold transition-colors",
                activeTab === tab.id
                  ? "bg-[#FFF3D6] text-[#76520E]"
                  : "text-[#817B70] hover:bg-[#F7F5F0] hover:text-[#2F240E]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* UPLOAD TAB */}
        {activeTab === "upload" && (
          <div className="animate-overlay-in space-y-3.5">
            {/* Nera promo banner */}
            <div className="relative flex items-center overflow-hidden rounded-[22px] bg-gradient-to-br from-[#FFF3D6] to-[#FFEFB8] p-4 ring-1 ring-[#EEDB9A]/60">
              <Image
                src="/images/nera-home-mascot.webp"
                alt="Maskot Nera"
                width={96}
                height={110}
                className="h-20 w-auto shrink-0 object-contain drop-shadow-[0_10px_14px_rgba(47,36,14,0.14)]"
                unoptimized
              />
              <div className="min-w-0 flex-1 pl-3">
                <p className="text-[14px] font-bold leading-snug text-[#2F240E]">
                  Mau lacak pengeluaran tanpa buka aplikasi?
                </p>
                <p className="mt-1 text-[12px] font-medium text-[#76520E]">
                  Titip struk ke Nera — dibaca otomatis!
                </p>
                <button
                  type="button"
                  onClick={scrollPasteZoneIntoView}
                  className="mt-2 inline-flex items-center gap-1 text-[13px] font-bold text-[#76520E] transition-colors hover:text-[#3A2800]"
                >
                  Coba Sekarang <ArrowRight size={15} />
                </button>
              </div>
            </div>

            {/* Import methods */}
            <div className="space-y-3">
              {UPLOAD_METHODS.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => inputRefs.current[method.id]?.click()}
                    className="group relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-[20px] border border-[#E9E5DD] bg-white px-4 py-5 text-left transition-colors duration-150 hover:border-[#EEDB9A] hover:bg-[#FFF8E6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA8500]"
                  >
                    <span className="relative z-[1] min-w-0">
                      <span className="block text-[15px] font-bold leading-snug text-[#2F240E]">
                        {method.title}
                      </span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-[#736B60]">
                        {method.desc}
                      </span>
                    </span>
                    <span className="relative flex h-12 w-14 shrink-0 items-center justify-center">
                      <span className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F7F4EC] transition-colors duration-150 group-hover:bg-[#FFF3D6]" />
                      <Icon
                        size={32}
                        strokeWidth={1.8}
                        className="relative text-[#76520E] transition-transform duration-150 group-hover:scale-110"
                      />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Paste zone */}
            <div
              id="paste-zone"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) startAnalysis(file.name);
              }}
              className={cn(
                "relative rounded-[20px] border-2 border-dashed p-6 text-center transition-colors duration-150",
                isDragOver ? "border-[#BA8500] bg-[#FFF8E6]" : "border-[#D8D3C9] bg-white/70"
              )}
            >
              <span className="absolute right-4 top-4 rounded-full bg-[#EF4444] px-2.5 py-1 text-[10px] font-bold text-white">
                Baru
              </span>
              <p className="text-[15px] font-bold text-[#2F240E]">Atau, tempel file di sini</p>
              <p className="mx-auto mt-1.5 max-w-[300px] text-[12px] leading-relaxed text-[#736B60]">
                Salin screenshot, foto struk, atau teks mutasi dari mana saja, lalu tempel di sini
                (Ctrl + V). Nera akan membacanya otomatis.
              </p>
            </div>

            {/* Nera analysis status */}
            {stage !== "idle" && (
              <div className="animate-sheet-in rounded-[20px] border border-[#E9E5DD] bg-white p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                      stage === "analyzing"
                        ? "bg-[#FFF3D6] text-[#76520E]"
                        : "bg-[#DDF0E6] text-[#277449]"
                    )}
                  >
                    {stage === "analyzing" ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <BadgeCheck size={20} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[#2F240E]">{fileName}</p>
                    {stage === "analyzing" ? (
                      <>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-[#736B60]">
                          NerAI sedang membaca file dan mengklasifikasi transaksimu…
                        </p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#F1F2F4]">
                          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#FFB900]" />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-[#277449]">
                          Analisis selesai — transaksi berhasil diimpor ke riwayat.
                        </p>
                        <div className="mt-2.5 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setStage("idle");
                              setFileName("");
                            }}
                            className="text-[12px] font-bold text-[#76520E] transition-colors hover:text-[#3A2800]"
                          >
                            Import File Lagi
                          </button>
                          <Link
                            href="/"
                            className="inline-flex items-center gap-1 text-[12px] font-bold text-[#817B70] transition-colors hover:text-[#2F240E]"
                          >
                            Cek Beranda <ArrowRight size={13} />
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Hidden native pickers triggered by the method cards */}
            {UPLOAD_METHODS.map((method) => (
              <input
                key={method.id}
                ref={(el) => {
                  inputRefs.current[method.id] = el;
                }}
                type="file"
                accept={method.accept}
                {...(method.capture ? { capture: "environment" as const } : {})}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) startAnalysis(file.name);
                  e.target.value = "";
                }}
              />
            ))}
          </div>
        )}

        {/* MANUAL TAB */}
        {activeTab === "manual" && (
          <Card className="animate-overlay-in space-y-3">
            <div>
              <p className="text-[14px] font-bold text-[#2F240E]">Catat Transaksi Manual</p>
              <p className="mt-0.5 text-[11px] text-[#736B60]">
                Isi cepat pengeluaran tanpa file — langsung masuk ke riwayat & Kantong Utama.
              </p>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#817B70]">
                  Kategori
                </span>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as Transaction["category"])}
                  className="h-11 w-full rounded-[12px] border border-[#E9E5DD] bg-[#F7F5F0] px-3 text-[13px] font-semibold text-[#2F240E] focus:outline-2 focus:outline-offset-2 focus:outline-[#BA8500]"
                >
                  {MANUAL_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#817B70]">
                  Keterangan
                </span>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Contoh: Makan Siang Kantin Tel-U"
                  className="h-11 w-full rounded-[12px] border border-[#E9E5DD] bg-[#F7F5F0] px-3 text-[13px] font-semibold text-[#2F240E] placeholder:text-[#A89F90] focus:outline-2 focus:outline-offset-2 focus:outline-[#BA8500]"
                />
              </div>

              <div>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#817B70]">
                  Nominal
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(formatAmountInput(e.target.value))}
                  placeholder="Contoh: 25.000"
                  className="h-11 w-full rounded-[12px] border border-[#E9E5DD] bg-[#F7F5F0] px-3 text-[13px] font-semibold text-[#2F240E] placeholder:text-[#A89F90] focus:outline-2 focus:outline-offset-2 focus:outline-[#BA8500]"
                />
              </div>

              <Button type="submit" fullWidth disabled={!isManualValid}>
                Simpan ke Riwayat
              </Button>
            </form>

            {isManualSaved && (
              <div className="animate-overlay-in flex items-center gap-2 rounded-2xl bg-[#DDF0E6] px-3.5 py-2.5 text-[11px] font-semibold text-[#277449]">
                <CheckCircle2 size={15} /> Tersimpan! Cek riwayat di Beranda.
              </div>
            )}
          </Card>
        )}

      </main>
    </div>
  );
}
