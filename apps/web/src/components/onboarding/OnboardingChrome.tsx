"use client";

import React from "react";
import Image from "next/image";
import { ArrowLeftIcon } from "@nera/ui/icons";
import { FullscreenButton } from "../common/FullscreenButton";

export interface OnboardingChromeProps {
  step: number;
  totalSteps: number;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  tone?: "cream" | "white";
}

export const OnboardingChrome: React.FC<OnboardingChromeProps> = ({
  step,
  totalSteps,
  eyebrow,
  title,
  subtitle,
  onBack,
  onSkip,
  skipLabel = "Lewati",
  footer,
  children,
  tone = "cream",
}) => {
  return (
    <div
      className={
        tone === "white"
          ? "flex min-h-full flex-1 flex-col bg-white"
          : "flex min-h-full flex-1 flex-col bg-[#FFFBF0]"
      }
    >
      <header className="px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] sm:pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Kembali"
                className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-[#2F240E] transition-colors hover:bg-[#FFF3D6]"
              >
                <ArrowLeftIcon size={20} />
              </button>
            ) : (
              <Image
                src="/logos/nera-home-logo.webp"
                alt="Nera"
                width={96}
                height={30}
                className="h-7 w-auto object-contain"
                priority
                unoptimized
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            {onSkip ? (
              <button
                type="button"
                onClick={onSkip}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#817B70] transition-colors hover:bg-[#FFF3D6] hover:text-[#5B410C]"
              >
                {skipLabel}
              </button>
            ) : (
              <span className="text-[11px] font-semibold tabular-nums text-[#A79F92]">
                {step + 1}/{totalSteps}
              </span>
            )}
            <FullscreenButton />
          </div>
        </div>

        <div className="mt-4 flex gap-1.5" aria-hidden>
          {Array.from({ length: totalSteps }).map((_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                index <= step ? "bg-[#FFB900]" : "bg-[#EFE7D8]"
              }`}
            />
          ))}
        </div>

        {(eyebrow || title || subtitle) && (
          <div className="mt-5">
            {eyebrow && (
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A36A00]">
                {eyebrow}
              </p>
            )}
            {title && (
              <h1 className="mt-1.5 text-[26px] font-bold leading-[1.15] tracking-tight text-[#2F240E]">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-2 text-[13px] leading-relaxed text-[#817B70]">{subtitle}</p>
            )}
          </div>
        )}
      </header>

      <div className="flex-1 px-5 pb-6 pt-5">{children}</div>

      {footer && (
        <div className="sticky bottom-0 z-20 border-t border-[#F0E6D2]/70 bg-gradient-to-t from-[#FFFBF0] via-[#FFFBF0] to-[#FFFBF0]/95 px-5 pb-[calc(1.4rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
          {footer}
        </div>
      )}
    </div>
  );
};
