"use client";

import React from "react";
import { NeraOrb } from "../mascot/NeraOrb";
import type { NeraMood } from "../mascot/moods";
import { Check, Lock, ShieldCheck, Sparkles } from "lucide-react";

type SceneVariant = "welcome" | "goal" | "profile" | "consent" | "ready";

export interface NeraSceneProps {
  variant?: SceneVariant;
  message: string;
  caption?: string;
  compact?: boolean;
}

const CHIPS: Record<SceneVariant, { label: string; tone: string; position: string; icon?: "check" | "lock" | "shield" }[]> = {
  welcome: [
    { label: "Runway aman", tone: "bg-[#DDF0E6] text-[#277449]", position: "left-0 top-10", icon: "check" },
    { label: "Kantong rapi", tone: "bg-[#FFF0BD] text-[#6D4C00]", position: "right-0 top-24" },
    { label: "Anti-boros", tone: "bg-[#EBF5FF] text-[#1E5C8F]", position: "left-4 bottom-8", icon: "shield" },
  ],
  goal: [
    { label: "Fokus satu tujuan", tone: "bg-[#FFF0BD] text-[#6D4C00]", position: "right-0 top-8" },
    { label: "Langkah kecil", tone: "bg-[#DDF0E6] text-[#277449]", position: "left-0 bottom-12", icon: "check" },
  ],
  profile: [
    { label: "Sesuai kondisimu", tone: "bg-[#FDE7DD] text-[#9A4B1F]", position: "left-0 top-10" },
    { label: "Tanpa menghakimi", tone: "bg-[#FFF0BD] text-[#6D4C00]", position: "right-0 bottom-10" },
  ],
  consent: [
    { label: "Datamu milikmu", tone: "bg-[#DDF0E6] text-[#277449]", position: "left-0 top-8", icon: "lock" },
    { label: "Bisa dicabut", tone: "bg-[#EBF5FF] text-[#1E5C8F]", position: "right-0 bottom-12", icon: "shield" },
  ],
  ready: [
    { label: "Siap mulai", tone: "bg-[#DDF0E6] text-[#277449]", position: "left-0 top-8", icon: "check" },
    { label: "Rencana aktif", tone: "bg-[#FFF0BD] text-[#6D4C00]", position: "right-0 top-20", icon: "lock" },
  ],
};

const BLOB: Record<SceneVariant, string> = {
  welcome: "bg-[#FFB900]/20",
  goal: "bg-[#BFE8DA]/60",
  profile: "bg-[#F7C9A8]/50",
  consent: "bg-[#BFE8DA]/50",
  ready: "bg-[#FFB900]/25",
};

// Nera reacts to each step: says hi, thinks about your goal, listens, reassures, cheers
const MASCOT: Record<SceneVariant, { mood: NeraMood; size: number }> = {
  welcome: { mood: "wave", size: 176 },
  goal: { mood: "thinking", size: 136 },
  profile: { mood: "idle", size: 136 },
  consent: { mood: "happy", size: 136 },
  ready: { mood: "celebrate", size: 152 },
};

const iconMap = {
  check: Check,
  lock: Lock,
  shield: ShieldCheck,
};

export const NeraScene: React.FC<NeraSceneProps> = ({ variant = "welcome", message, caption, compact }) => {
  const chips = CHIPS[variant];
  const mascot = MASCOT[variant];

  return (
    <div className="relative">
      <div className="relative mx-auto w-full max-w-[320px]">
        <div className={`absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl ${BLOB[variant]}`} />
        <div className={`relative mx-auto flex ${compact ? "h-[150px]" : "h-[196px]"} w-full items-center justify-center`}>
          <NeraOrb mood={mascot.mood} size={compact ? Math.round(mascot.size * 0.75) : mascot.size} />
        </div>

        {chips.map((chip) => {
          const Icon = chip.icon ? iconMap[chip.icon] : Sparkles;
          return (
            <div
              key={chip.label}
              className={`absolute ${chip.position} flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-bold shadow-sm ring-1 ring-black/5 ${chip.tone}`}
            >
              <Icon size={12} strokeWidth={2.6} />
              {chip.label}
            </div>
          );
        })}
      </div>

      <div className="relative mx-auto mt-2 max-w-[330px]">
        <div className="rounded-[20px] rounded-bl-md border border-[#F0E6D2] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(47,36,14,0.06)]">
          <p className="text-[13px] font-semibold leading-relaxed text-[#2F240E]">{message}</p>
          {caption && <p className="mt-1 text-[11px] leading-relaxed text-[#817B70]">{caption}</p>}
        </div>
      </div>
    </div>
  );
};
