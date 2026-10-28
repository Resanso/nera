"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@nera/ui";
import { CalendarClockIcon, ShieldCheckIcon, SparklesIcon } from "@nera/ui/icons";
import type { ConsentKind, EmailStatus } from "../../lib/emailImport";

type Props = {
  consent: EmailStatus["consent"];
  busy: boolean;
  onChange: (kind: ConsentKind, granted: boolean) => void;
};

const formatDate = (iso?: string) =>
  iso ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "";

/**
 * The decisions a user makes before Nera touches their mail. Email import is required
 * for Gmail/forwarding; AI help and the Beranda estimate are optional. All can be withdrawn here.
 */
export function ConsentCard({ consent, busy, onChange }: Props) {
  const [agreeImport, setAgreeImport] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  return (
    <section id="consent" className="rounded-[24px] bg-white p-5">
      <div className="flex items-center gap-2 text-[#2F240E]">
        <ShieldCheckIcon size={18} className="text-[#76520E]" />
        <h3 className="text-sm font-bold">Persetujuan</h3>
      </div>

      {/* 1. email import: required */}
      <div className="mt-3 rounded-[16px] border border-[#F0E6D2] p-3.5">
        <p className="text-xs font-bold text-[#2F240E]">Impor email (wajib untuk Gmail dan alamat penerusan)</p>
        {/* once agreed, keep the card short; the full text stays on /privacy */}
        <ul className={`mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-[#736B60] ${consent.emailImport ? "hidden" : ""}`}>
          <li>Nera membaca email pembayaran dari pengirim yang terdaftar dan yang Gmail kelompokkan sebagai Pembelian.</li>
          <li>Yang disimpan: nominal, merchant, tanggal, kategori, nomor pesanan. Isi email tidak disimpan.</li>
          <li>Dipakai hanya untuk catatan dan saran pribadimu. Tidak untuk penilaian kredit, pinjaman, atau iklan, dan tidak dijual.</li>
          <li>Bisa dicabut kapan saja; mencabut juga memutus Gmail dan menghapus data dari email.</li>
        </ul>
        {consent.emailImport ? (
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#2F6B1F]">Disetujui {formatDate(consent.emailImportAt)}</span>
            {confirmRevoke ? (
              <span className="flex gap-2">
                <button type="button" className="text-[11px] font-bold text-[#A92F2F]" onClick={() => onChange("email_import", false)} disabled={busy}>
                  Ya, cabut & hapus
                </button>
                <button type="button" className="text-[11px] font-semibold text-[#736B60]" onClick={() => setConfirmRevoke(false)}>
                  Batal
                </button>
              </span>
            ) : (
              <button type="button" className="text-[11px] font-semibold text-[#A92F2F]" onClick={() => setConfirmRevoke(true)}>
                Cabut persetujuan
              </button>
            )}
          </div>
        ) : (
          <>
            <label className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-[#2F240E]">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#76520E]" checked={agreeImport} onChange={(e) => setAgreeImport(e.target.checked)} />
              <span>
                Saya sudah membaca penjelasan di atas dan{" "}
                <Link href="/privacy" className="font-semibold text-[#76520E] underline underline-offset-2">
                  Kebijakan Privasi
                </Link>
                , dan setuju Nera memproses email pembayaran saya.
              </span>
            </label>
            <Button className="mt-2.5" fullWidth size="sm" disabled={!agreeImport} isLoading={busy} onClick={() => onChange("email_import", true)}>
              Setuju
            </Button>
          </>
        )}
      </div>

      {/* 2. AI help: optional */}
      <div className="mt-3 rounded-[16px] border border-[#F0E6D2] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <SparklesIcon size={14} className="text-[#76520E]" />
            <p className="text-xs font-bold text-[#2F240E]">Bantuan AI (opsional)</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={consent.aiProcessing}
            aria-label="Bantuan AI"
            disabled={busy || !consent.emailImport}
            onClick={() => onChange("ai_processing", !consent.aiProcessing)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${consent.aiProcessing ? "bg-[#58A83C]" : "bg-[#D8D3C9]"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${consent.aiProcessing ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-[#736B60]">
          <li>Untuk struk yang tidak terbaca aturan biasa: teks struk (nama, telepon, alamat, email dan nomor kartu/rekening disamarkan) dikirim ke AI.</li>
          <li>Untuk analisis dan chatbot: ringkasan pengeluaran dan nama merchant, tanpa isi email.</li>
          <li>Diproses oleh MAIA Router dan penyedia modelnya (xAI, Grok), di server luar Indonesia.</li>
          <li>Tanpa ini, Nera tetap jalan dengan aturan biasa; beberapa struk mungkin tidak terbaca.</li>
        </ul>
        {consent.aiProcessing && <p className="mt-2 text-[11px] font-semibold text-[#2F6B1F]">Aktif sejak {formatDate(consent.aiProcessingAt)}</p>}
        {!consent.emailImport && <p className="mt-2 text-[11px] text-[#736B60]">Setujui impor email dulu.</p>}
      </div>

      {/* 3. Beranda estimate from receipts: optional, a purpose added later */}
      <EmailPlanningConsent consent={consent} busy={busy} onChange={onChange} />
    </section>
  );
}

/** Lets receipts feed "Uangmu bertahan", the daily budget and the Aset Saya balance. Also shown where they are used. */
export function EmailPlanningConsent({ consent, busy, onChange }: Props) {
  return (
    <div className="mt-3 rounded-[16px] border border-[#F0E6D2] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <CalendarClockIcon size={14} className="text-[#76520E]" />
          <p className="text-xs font-bold text-[#2F240E]">Estimasi dari struk email (opsional)</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={consent.emailPlanning}
          aria-label="Estimasi dari struk email"
          disabled={busy || !consent.emailImport}
          onClick={() => onChange("email_planning", !consent.emailPlanning)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${consent.emailPlanning ? "bg-[#58A83C]" : "bg-[#D8D3C9]"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${consent.emailPlanning ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-[#736B60]">
        <li>Pengeluaran dari struk email ikut menghitung &quot;Uangmu bertahan&quot; dan rekomendasi budget harian di Beranda.</li>
        <li>Saldo yang kamu isi di Kantong berkurang sendiri sesuai struk email. Seminggu sekali Nera memintamu mengecek.</li>
        <li>Hanya kamu yang melihat hasilnya. Skor kondisi keuangan dan penawaran produk tetap memakai data BNI saja.</li>
        <li>Bisa dimatikan kapan saja; estimasi kembali memakai data BNI.</li>
      </ul>
      {consent.emailPlanning && <p className="mt-2 text-[11px] font-semibold text-[#2F6B1F]">Aktif sejak {formatDate(consent.emailPlanningAt)}</p>}
      {!consent.emailImport && <p className="mt-2 text-[11px] text-[#736B60]">Setujui impor email dulu.</p>}
    </div>
  );
}
