"use client";

import React, { useEffect } from "react";
import { NeraOrb } from "../mascot/NeraOrb";
import { usePathname, useRouter } from "next/navigation";
import { useOnboardingHydrated, useOnboardingStore } from "../../context/OnboardingStore";

const Splash: React.FC = () => (
  <div className="flex h-dvh w-full items-center justify-center bg-[#F1F2F4] sm:min-h-screen sm:py-6">
    <div className="relative flex h-dvh w-full max-w-[430px] flex-col items-center justify-center overflow-hidden bg-[#FFFBF0] sm:h-auto sm:min-h-[890px] sm:rounded-[36px] sm:border-[8px] sm:border-[#1E293B] sm:shadow-2xl">
      <div className="absolute -left-16 top-16 h-52 w-52 rounded-full bg-[#FFB900]/15 blur-2xl" />
      <div className="absolute -right-14 bottom-24 h-56 w-56 rounded-full bg-[#BFE8DA]/40 blur-2xl" />
      <div className="relative flex flex-col items-center gap-5">
        <div className="relative h-32 w-32">
          <span className="absolute inset-0 animate-ping rounded-full bg-[#FFB900]/20" />
          <span className="relative flex h-full w-full items-center justify-center">
            <NeraOrb mood="thinking" size={120} trackPointer={false} />
          </span>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold tracking-tight text-[#2F240E]">Nera menyiapkan semuanya</p>
          <p className="mt-1 text-xs text-[#817B70]">Sebentar ya, kamu hampir siap.</p>
        </div>
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#F0E6D2]">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-[#FFB900]" />
        </span>
      </div>
    </div>
  </div>
);

export const OnboardingGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const hydrated = useOnboardingHydrated();
  const completed = useOnboardingStore((s) => s.completed);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!hydrated || completed) return;
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/onboarding${next}`);
  }, [hydrated, completed, pathname, router]);

  if (!hydrated || !completed) return <Splash />;

  return <>{children}</>;
};
