"use client";

import { useState } from "react";
import { BellIcon, BellOffIcon, ShareIcon } from "@nera/ui/icons";
import { disablePush, enablePush, pushApi, type PushState } from "../../lib/push";

/**
 * Turns Rencana dadakan reminders on or off for this browser. On an iPhone outside the
 * Home Screen app it explains how to install first, because iOS only delivers push there.
 */
export function ReminderToggle({
  state,
  showAmounts,
  onShowAmounts,
  onChange,
  notify,
}: {
  state: PushState | null;
  showAmounts: boolean;
  onShowAmounts: (v: boolean) => void;
  onChange: () => void;
  notify: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (state === null || state === "unsupported") return null;

  if (state === "install")
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-[#F7F5F0] px-3 py-2.5 text-[12px] leading-snug text-[#5C4A1E]">
        <BellIcon size={16} className="mt-px shrink-0 text-[#76520E]" />
        <p>
          Mau diingatkan tiap malam? Di iPhone, pasang Nera dulu: ketuk <ShareIcon size={12} className="inline align-[-1px]" /> Bagikan, lalu{" "}
          <b>Tambah ke Layar Utama</b>, dan buka Nera dari sana.
        </p>
      </div>
    );

  if (state === "denied")
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-[#F7F5F0] px-3 py-2.5 text-[12px] leading-snug text-[#5C4A1E]">
        <BellOffIcon size={16} className="mt-px shrink-0 text-[#736B60]" />
        <p>Notifikasi untuk Nera diblokir. Izinkan lewat pengaturan situs di browser kalau mau diingatkan.</p>
      </div>
    );

  const toggle = async () => {
    setBusy(true);
    try {
      if (state === "on") {
        await disablePush();
        notify("Pengingat dimatikan");
      } else {
        await enablePush(showAmounts);
        await pushApi.test().catch(() => undefined);
        notify("Pengingat menyala. Nera kirim contoh notifikasinya sekarang");
      }
      onChange();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl bg-[#F7F5F0] px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        {state === "on" ? <BellIcon size={16} className="shrink-0 text-[#76520E]" /> : <BellOffIcon size={16} className="shrink-0 text-[#736B60]" />}
        <p className="min-w-0 flex-1 text-[12px] leading-snug text-[#5C4A1E]">
          {state === "on" ? "Pengingat menyala: tiap malam pukul 19.00 kalau hari itu belum menyisihkan." : "Ingatkan aku tiap malam kalau belum menyisihkan."}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={state === "on"}
          aria-label="Pengingat harian"
          disabled={busy}
          onClick={toggle}
          className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50 ${state === "on" ? "bg-[#A36A00]" : "bg-[#D8D3C9]"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-150 ${state === "on" ? "left-[18px]" : "left-0.5"}`} />
        </button>
      </div>
      {state === "on" && (
        <label className="mt-2 flex items-center gap-2 pl-[26px] text-[11px] text-[#736B60]">
          <input
            type="checkbox"
            checked={showAmounts}
            onChange={async (e) => {
              const v = e.target.checked;
              onShowAmounts(v);
              await pushApi.setShowAmounts(v).catch(() => notify("Pengaturan belum tersimpan"));
            }}
            className="h-3.5 w-3.5 accent-[#A36A00]"
          />
          Tampilkan nominal di notifikasi (terlihat di layar kunci)
        </label>
      )}
    </div>
  );
}
