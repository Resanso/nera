"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowRightIcon, MessageCircleIcon, ShieldAlertIcon, UploadCloudIcon, XIcon } from "@nera/ui/icons";

export interface CenterActionSheetProps {
  open: boolean;
  onClose: () => void;
}

const CARD_CLASS =
  "group flex w-full items-center gap-3 rounded-[20px] border border-[#E9E5DD] bg-white px-4 py-4 text-left transition-colors duration-150 hover:border-[#EEDB9A] hover:bg-[#FFF8E6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA8500]";

const ICON_WRAP_CLASS =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF3D6] text-[#76520E]";

export const CenterActionSheet: React.FC<CenterActionSheetProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-label="Aksi Cepat">
      <button
        type="button"
        aria-label="Tutup menu"
        onClick={onClose}
        className="animate-overlay-in absolute inset-0 h-full w-full bg-[#2F240E]/45 backdrop-blur-[2px]"
      />

      <div className="animate-sheet-in absolute inset-x-0 bottom-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="rounded-[26px] bg-[#F7F5F0] p-3 shadow-[0_-12px_40px_rgba(47,36,14,0.28)]">
          <div className="px-2 pb-3 pt-1">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#D8D3C9]" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A36A00]">
                  Aksi Cepat
                </p>
                <p className="mt-0.5 text-[15px] font-bold text-[#2F240E]">Mau mulai dari mana?</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#736B60] transition-colors hover:bg-[#EFE7D8] hover:text-[#2F240E]"
              >
                <XIcon size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <Link href="/risk-check" onClick={onClose} className={CARD_CLASS}>
              <span className={ICON_WRAP_CLASS}>
                <ShieldAlertIcon size={22} strokeWidth={2.1} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold leading-tight text-[#2F240E]">
                  Cek Risiko Pinjaman dengan AI
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-[#736B60]">
                  Deteksi pinjol dan simulasi cicilan yang aman
                </span>
              </span>
              <ArrowRightIcon
                size={18}
                className="shrink-0 text-[#A89F90] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#76520E]"
              />
            </Link>

            <Link href="/upload-transaction" onClick={onClose} className={CARD_CLASS}>
              <span className={ICON_WRAP_CLASS}>
                <UploadCloudIcon size={22} strokeWidth={2.1} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold leading-tight text-[#2F240E]">
                  Upload Transaksi
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-[#736B60]">
                  Impor mutasi rekening atau struk untuk dianalisis
                </span>
              </span>
              <ArrowRightIcon
                size={18}
                className="shrink-0 text-[#A89F90] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#76520E]"
              />
            </Link>

            <Link href="/recovery" onClick={onClose} className={CARD_CLASS}>
              <span className={ICON_WRAP_CLASS}>
                <MessageCircleIcon size={22} strokeWidth={2.1} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold leading-tight text-[#2F240E]">
                  Ngobrol dengan NerAI
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-[#736B60]">
                  Tanya kondisi keuanganmu ke konsultan AI Nera
                </span>
              </span>
              <ArrowRightIcon
                size={18}
                className="shrink-0 text-[#A89F90] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#76520E]"
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
