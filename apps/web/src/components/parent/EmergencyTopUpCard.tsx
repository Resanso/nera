"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, Button } from "@nera/ui";
import { AlertCircleIcon, WalletIcon } from "@nera/ui/icons";
import { EmergencyTopUpRequest } from "@nera/core";
import { useFinancialStore } from "../../context/FinancialStore";

export interface EmergencyTopUpCardProps {
  request: EmergencyTopUpRequest;
}

export const EmergencyTopUpCard: React.FC<EmergencyTopUpCardProps> = ({ request }) => {
  const resolveEmergencyTopUp = useFinancialStore((s) => s.resolveEmergencyTopUp);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-4 space-y-3 bg-[#FFF3D6]/40 border-[#FBBF24]/40">
        <div className="flex items-center gap-2 text-[#92400E]">
          <AlertCircleIcon size={18} />
          <h3 className="text-xs font-bold uppercase tracking-wider">Permintaan Top Up</h3>
        </div>

        <p className="text-xs text-[#2F240E] leading-relaxed">{request.reasonText}</p>

        <div className="p-3 bg-white rounded-xl border border-[#E9E5DD] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WalletIcon size={16} className="text-[#5B410C]" />
            <span className="text-xs text-[#736B60]">Rekomendasi Top Up</span>
          </div>
          <span className="text-sm font-bold text-[#5B410C]">
            {formatRupiah(request.suggestedAmount)}
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={() => resolveEmergencyTopUp(request.id, "dismissed")}
          >
            Abaikan
          </Button>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={() => resolveEmergencyTopUp(request.id, "approved")}
          >
            Top Up Sekarang
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};
