"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Button, TrustBanner } from "@nera/ui";
import { KeyRoundIcon, CheckCircleIcon, ShieldCheckIcon } from "@nera/ui/icons";
import { useFinancialStore } from "../../context/FinancialStore";

const MOCK_PAIRING_CODE = "NERA-PAIR-BUDI-1301";

export const ParentPairingCard: React.FC = () => {
  const completeParentPairing = useFinancialStore((s) => s.completeParentPairing);
  const [code, setCode] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleAccept = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSuccess(true);
    setTimeout(() => completeParentPairing(), 900);
  };

  return (
    <div className="px-4 py-4">
      <AnimatePresence mode="wait">
        {isSuccess ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <Card className="p-8 flex flex-col items-center text-center space-y-3">
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-[#DDF0E6] text-[#22C55E] flex items-center justify-center"
              >
                <CheckCircleIcon size={34} />
              </motion.div>
              <h3 className="text-base font-bold text-[#2F240E]">Akun Berhasil Terhubung!</h3>
              <p className="text-xs text-[#736B60] leading-relaxed">
                Kamu sekarang bisa memantau status keamanan finansial Budi secara read-only.
              </p>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-0 overflow-hidden">
              <TrustBanner
                icon={<ShieldCheckIcon size={18} />}
                eyebrow="Nera Family Hub"
                title="Hubungkan Akun Keluarga"
              >
                Masukkan kode pairing yang dibagikan anakmu, atau terima undangan lewat link WhatsApp.
                Nera hanya membaca <strong className="text-white">kategori mutasi</strong> — tidak pernah membaca detail transaksi.
              </TrustBanner>

              <form onSubmit={handleAccept} className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#2F240E] mb-1">
                    Kode Pairing
                  </label>
                  <div className="relative">
                    <KeyRoundIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#817B70]" />
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder={MOCK_PAIRING_CODE}
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-mono border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#5B410C]"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" variant="bni" fullWidth>
                  Terima Undangan
                </Button>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
