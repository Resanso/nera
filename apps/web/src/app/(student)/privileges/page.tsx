"use client";

import React, { useMemo, useState } from "react";
import { TopAppBar } from "../../../components/common/TopAppBar";
import { useFinancialStore } from "../../../context/FinancialStore";
import { Card, Button, Modal, TrustBanner } from "@nera/ui";
import { classifyPersonas, BNI_OFFERS } from "@nera/core";
import {
  SparklesIcon,
  ShieldCheckIcon,
  BadgeCheckIcon,
  ArrowUpRightIcon,
  WalletIcon,
  TrendingUpIcon,
  CreditCardIcon,
  UmbrellaIcon,
  FileCheckIcon,
  StoreIcon,
  LifeBuoyIcon,
} from "@nera/ui/icons";

const PERSONA_ICONS: Record<string, React.ElementType> = {
  konsisten_nabung: WalletIcon,
  pejuang_runway: TrendingUpIcon,
  anak_rantau: UmbrellaIcon,
  calon_mapan: CreditCardIcon,
  wirausaha_kampus: StoreIcon,
  pejuang_pemulihan: LifeBuoyIcon,
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Tabungan: WalletIcon,
  Investasi: TrendingUpIcon,
  "Kartu Kredit": CreditCardIcon,
  Proteksi: UmbrellaIcon,
  "Pinjaman Resmi": FileCheckIcon,
  Wirausaha: StoreIcon,
};

export default function PrivilegesPage() {
  const {
    transactions,
    nudges,
    score,
    state,
    monthlyAllowance,
    lockPocket,
    runwayDays,
    safeConsecutiveMonths,
    totalMonthlyInstallments,
    activeDebts,
  } = useFinancialStore();

  const [activeOffer, setActiveOffer] = useState<string | null>(null);

  const personas = useMemo(
    () =>
      classifyPersonas({
        transactions,
        nudges,
        score,
        state,
        monthlyAllowance,
        lockPocket,
        runwayDays,
        safeConsecutiveMonths,
        totalMonthlyInstallments,
        activeDebtsCount: activeDebts.length,
      }),
    [
      transactions,
      nudges,
      score,
      state,
      monthlyAllowance,
      lockPocket,
      runwayDays,
      safeConsecutiveMonths,
      totalMonthlyInstallments,
      activeDebts.length,
    ]
  );

  const activeOfferData = BNI_OFFERS.find((o) => o.id === activeOffer);

  return (
    <div className="flex flex-col min-h-full">
      <TopAppBar title="Manfaat BNI Untukmu" showBack />

      <main className="flex-1 px-4 py-4 space-y-4">
        {/* TRANSPARENCY / CONSENT BANNER */}
        <Card className="p-0 overflow-hidden">
          <TrustBanner icon={<ShieldCheckIcon size={20} />}>
            Skor dan pola transaksimu dipakai <strong className="text-white">read-only</strong> untuk mencocokkan manfaat ini. Tidak ada data yang dibagikan ke pihak luar tanpa persetujuanmu.
          </TrustBanner>
        </Card>

        {state !== "AMAN" && (
          <Card className="p-4 bg-[#FFF3D6]/40 border-[#FBBF24]/40 space-y-1.5">
            <div className="flex items-center gap-2 text-[#92400E]">
              <BadgeCheckIcon size={16} />
              <h3 className="text-xs font-bold uppercase tracking-wider">Mode Proteksi Reputasi Aktif</h3>
            </div>
            <p className="text-xs text-[#2F240E] leading-relaxed">
              Selama status belum kembali Aman, Nera hanya menampilkan opsi resmi & suportif — bukan produk investasi atau kartu kredit.
            </p>
          </Card>
        )}

        {personas.map((persona) => {
          const Icon = PERSONA_ICONS[persona.id] || SparklesIcon;
          const offers = BNI_OFFERS.filter((o) => o.personaId === persona.id);

          return (
            <div key={persona.id} className="space-y-2.5">
              <Card className="p-4 space-y-2.5 border-[#EEDB9A] bg-[#FFF8E6]">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#FFF0BD] text-[#76520E] flex items-center justify-center shrink-0">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#2F240E]">{persona.label}</h3>
                    <p className="text-[11px] text-[#736B60]">{persona.tagline}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {persona.matchReasons.map((reason, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-[#76520E]/8 text-[#76520E] font-medium px-2.5 py-1 rounded-full"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </Card>

              <div className="space-y-2">
                {offers.map((offer) => {
                  const OfferIcon = CATEGORY_ICONS[offer.category] || SparklesIcon;
                  return (
                    <Card key={offer.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#FFF3D6] text-[#76520E] flex items-center justify-center shrink-0">
                            <OfferIcon size={16} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-[#2F240E] truncate">{offer.productName}</h4>
                            <span className="text-[10px] text-[#736B60]">{offer.category}</span>
                          </div>
                        </div>
                        <span className="text-[10px] bg-[#DDF0E6] text-[#15803D] font-bold px-2 py-0.5 rounded-full shrink-0">
                          {offer.badge}
                        </span>
                      </div>

                      <p className="text-xs text-[#2F240E] leading-relaxed">{offer.benefit}</p>
                      <p className="text-[11px] text-[#736B60] leading-relaxed">{offer.eligibilityNote}</p>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-[#817B70]">Sumber: {offer.sourceLabel}</span>
                        {offer.actionType === "wondr" ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setActiveOffer(offer.id)}
                            className="text-xs h-8 px-3 rounded-full gap-1"
                          >
                            {offer.actionLabel} <ArrowUpRightIcon size={12} />
                          </Button>
                        ) : (
                          <a
                            href={offer.actionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-[#76520E] hover:underline flex items-center gap-1"
                          >
                            {offer.actionLabel} <ArrowUpRightIcon size={12} />
                          </a>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </main>

      {/* MODAL: HAND-OFF KE WONDR */}
      <Modal
        isOpen={!!activeOffer}
        onClose={() => setActiveOffer(null)}
        title={activeOfferData?.productName || "Fitur wondr"}
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-14 h-14 bg-[#FFF3D6] text-[#76520E] rounded-2xl flex items-center justify-center mx-auto">
            <SparklesIcon size={28} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#2F240E]">{activeOfferData?.productName}</h4>
            <p className="text-xs text-[#736B60] mt-1 leading-relaxed">
              Layanan wondr by BNI ini terintegrasi langsung dengan proteksi kecerdasan finansial Nera.
            </p>
          </div>
          <Button variant="primary" fullWidth onClick={() => setActiveOffer(null)}>
            Lanjutkan di wondr
          </Button>
        </div>
      </Modal>
    </div>
  );
}
