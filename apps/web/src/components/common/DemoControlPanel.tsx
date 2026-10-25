"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HelpCircle, X, GraduationCap, Users, Building2, RotateCcw, Sparkles } from "lucide-react";
import { PERSONA_LABELS, DEMO_PERSONA_SCENARIOS, PersonaId } from "@nera/core";
import { useFinancialStore } from "../../context/FinancialStore";
import { useUiPreferencesStore } from "../../context/UiPreferencesStore";
import { useOnboardingStore } from "../../context/OnboardingStore";

const PERSONA_ORDER: PersonaId[] = [
  "konsisten_nabung",
  "pejuang_runway",
  "anak_rantau",
  "calon_mapan",
  "wirausaha_kampus",
  "pejuang_pemulihan",
];

const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const VIEW_LINKS = [
  { href: "/", label: "Tampilan Mahasiswa", icon: GraduationCap },
  { href: "/parent", label: "Tampilan Orang Tua", icon: Users },
  { href: "/campus", label: "Tampilan Kampus", icon: Building2 },
];

export const DemoControlPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const resetOnboarding = useOnboardingStore((s) => s.reset);
  const applyPersonaDemoScenario = useFinancialStore((s) => s.applyPersonaDemoScenario);
  const mockupCanvasColor = useUiPreferencesStore((s) => s.mockupCanvasColor);
  const setMockupCanvasColor = useUiPreferencesStore((s) => s.setMockupCanvasColor);
  const resetMockupCanvasColor = useUiPreferencesStore((s) => s.resetMockupCanvasColor);

  const [hexInputValue, setHexInputValue] = useState(mockupCanvasColor);

  useEffect(() => {
    setHexInputValue(mockupCanvasColor);
  }, [mockupCanvasColor]);

  const handleHexInputChange = (value: string) => {
    const normalized = value.startsWith("#") ? value : `#${value}`;
    setHexInputValue(normalized);
    if (HEX_COLOR_PATTERN.test(normalized)) {
      setMockupCanvasColor(normalized);
    }
  };

  const handleSelect = (personaId: PersonaId) => {
    applyPersonaDemoScenario(personaId);
    setIsOpen(false);
  };

  const handleReplayOnboarding = () => {
    resetOnboarding();
    setIsOpen(false);
    router.push("/onboarding?replay=1");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[#817B70] hover:bg-slate-100 hover:text-[#2F240E] transition-colors"
        aria-label="Menu Demo"
        title="Menu Demo"
      >
        <HelpCircle size={19} />
      </button>

      {isOpen && (
        <div className="absolute top-11 right-0 w-64 bg-white border border-dashed border-[#76520E]/50 rounded-[18px] shadow-2xl p-2 space-y-1 z-50 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#76520E]">
              Menu Demo
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#817B70] hover:text-[#2F240E]"
              aria-label="Tutup"
            >
              <X size={14} />
            </button>
          </div>

          {/* Role Switcher */}
          <div className="px-2 pb-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#817B70]">
              Lihat Sebagai
            </span>
          </div>
          {VIEW_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-[#76520E]/8 transition-colors"
            >
              <Icon size={14} className="text-[#76520E]" />
              <span className="text-xs font-semibold text-[#2F240E]">{label}</span>
            </Link>
          ))}

          <div className="h-px bg-[#E9E5DD] my-1" />

          {/* Onboarding Replay */}
          <div className="px-2 pb-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#817B70]">
              Onboarding
            </span>
          </div>
          <button
            onClick={handleReplayOnboarding}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-[#76520E]/8 transition-colors text-left"
          >
            <Sparkles size={14} className="text-[#76520E] shrink-0" />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-[#2F240E]">Putar Ulang Onboarding</span>
              <span className="block text-[10px] text-[#736B60] leading-snug">
                Reset rencana Nera & mulai dari awal.
              </span>
            </span>
          </button>

          <div className="h-px bg-[#E9E5DD] my-1" />

          {/* Mockup Canvas Color Picker */}
          <div className="px-2 pb-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#817B70]">
              Warna Latar Mockup
            </span>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <input
              type="color"
              value={mockupCanvasColor}
              onChange={(e) => setMockupCanvasColor(e.target.value)}
              className="w-8 h-8 rounded-lg border border-[#E9E5DD] cursor-pointer p-0.5 bg-white"
              aria-label="Pilih warna latar mockup"
            />
            <input
              type="text"
              value={hexInputValue}
              onChange={(e) => handleHexInputChange(e.target.value)}
              spellCheck={false}
              className="w-24 text-xs font-mono text-[#736B60] flex-1 border border-transparent hover:border-[#E9E5DD] focus:border-[#76520E] focus:text-[#2F240E] rounded-lg px-1.5 py-1 outline-none transition-colors"
              aria-label="Ketik kode warna hex"
            />
            <button
              onClick={resetMockupCanvasColor}
              className="text-[#817B70] hover:text-[#2F240E] transition-colors"
              aria-label="Reset warna latar"
              title="Reset ke warna default"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="h-px bg-[#E9E5DD] my-1" />

          {/* Persona Scenario Switcher */}
          <div className="px-2 pb-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#817B70]">
              Ganti Persona (Mahasiswa)
            </span>
            <p className="text-[10px] text-[#736B60] leading-relaxed pt-0.5">
              Hanya mengganti angka transaksi mentah — persona tetap dihitung ulang oleh classifier.
            </p>
          </div>
          {PERSONA_ORDER.map((id) => (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#76520E]/8 transition-colors"
            >
              <p className="text-xs font-bold text-[#2F240E]">{PERSONA_LABELS[id].label}</p>
              <p className="text-[10px] text-[#736B60] leading-snug">
                {DEMO_PERSONA_SCENARIOS[id].scenarioLabel !== PERSONA_LABELS[id].label
                  ? DEMO_PERSONA_SCENARIOS[id].scenarioLabel
                  : PERSONA_LABELS[id].tagline}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
