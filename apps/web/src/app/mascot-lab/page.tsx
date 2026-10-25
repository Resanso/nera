"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NeraMascot2D } from "../../components/mascot/NeraMascot2D";
import { NeraMascot3D } from "../../components/mascot/NeraMascot3D";
import { NeraOrb } from "../../components/mascot/NeraOrb";
import type { NeraMood } from "../../components/mascot/moods";

const MOODS: { mood: NeraMood; label: string; line: string }[] = [
  { mood: "idle", label: "Santai", line: "Hai! Aku Nera, penjaga dompetmu." },
  { mood: "wave", label: "Menyapa", line: "Selamat pagi! Siap atur uang jajan?" },
  { mood: "happy", label: "Senang", line: "Mantap! Kamu hemat Rp25.000 minggu ini." },
  { mood: "celebrate", label: "Rayakan", line: "Target Kantong Laptop tercapai!" },
  { mood: "thinking", label: "Berpikir", line: "Hmm, aku cek dulu transaksi ini ya..." },
  { mood: "alert", label: "Waspada", line: "Eits! Link ini mirip penipuan." },
];

const POKES = ["Hihi, geli!", "Boop!", "Hei, aku lagi kerja!", "Ada yang bisa kubantu?"];

export default function MascotLabPage() {
  const [index, setIndex] = useState(0);
  const [pokeLine, setPokeLine] = useState<string | null>(null);
  const current = MOODS[index];
  const line = pokeLine ?? current.line;

  const poke = () => {
    setPokeLine(POKES[Math.floor(Math.random() * POKES.length)]);
    setTimeout(() => setPokeLine(null), 1400);
  };

  return (
    <main className="min-h-dvh bg-[#FFF7E2] px-4 py-10 text-[#2F240E]">
      <div className="mx-auto flex max-w-6xl flex-col items-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#76520E]/70">Mascot Lab</p>
        <h1 className="mt-1 text-2xl font-bold">Nera dalam gerak</h1>

        <div className="mt-6 flex min-h-[64px] items-end">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={line}
              initial={{ opacity: 0, y: 10, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              className="relative max-w-[320px] rounded-2xl border-2 border-[#2F240E]/10 bg-white px-4 py-3 text-center text-[15px] font-semibold leading-snug shadow-[0_3px_0_rgba(47,36,14,0.1)]"
            >
              {line}
              <span className="absolute -bottom-[9px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-[#2F240E]/10 bg-white" />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <figure className="flex flex-col items-center rounded-3xl bg-white/60 px-4 pb-5 pt-6">
            <NeraMascot2D mood={current.mood} size={240} onPoke={poke} />
            <figcaption className="mt-3 text-sm font-bold">Opsi A · 2D flat</figcaption>
            <p className="text-xs text-[#76520E]/70">SVG + CSS, ringan, tajam di semua ukuran</p>
          </figure>
          <figure className="flex flex-col items-center rounded-3xl bg-white/60 px-4 pb-5 pt-6">
            <NeraMascot3D mood={current.mood} size={240} onPoke={poke} />
            <figcaption className="mt-3 text-sm font-bold">Opsi B · 3D real-time</figcaption>
            <p className="text-xs text-[#76520E]/70">Three.js, plastik glossy, kepala ikut kursor</p>
          </figure>
          <figure className="flex flex-col items-center rounded-3xl bg-white/60 px-4 pb-5 pt-6">
            <div className="flex h-[276px] items-center gap-2">
              <NeraOrb mood={current.mood} size={160} onPoke={poke} eyes="led" />
              <NeraOrb mood={current.mood} size={160} onPoke={poke} eyes="white" />
            </div>
            <figcaption className="mt-3 text-sm font-bold">Opsi C · Orb kepala Nera</figcaption>
            <p className="text-xs text-[#76520E]/70">Mata LED (kiri) atau pil putih (kanan) di balik visor</p>
          </figure>
        </div>

        <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-2">
          {MOODS.map((m, i) => (
            <button
              key={m.mood}
              type="button"
              onClick={() => {
                setIndex(i);
                setPokeLine(null);
              }}
              className={`rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-[transform,background-color] active:translate-y-[2px] ${
                i === index
                  ? "border-[#76520E] bg-[#FFC81E] shadow-[0_3px_0_#76520E]"
                  : "border-[#2F240E]/10 bg-white shadow-[0_3px_0_rgba(47,36,14,0.12)]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs text-[#76520E]/70">Ketuk Nera untuk menyentilnya. Matanya mengikuti kursor.</p>
      </div>
    </main>
  );
}
