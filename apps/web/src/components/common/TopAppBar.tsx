"use client";

import React, { useContext } from "react";
import Image from "next/image";
import { Bell, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { DemoControlPanel } from "./DemoControlPanel";
import { FullscreenButton } from "./FullscreenButton";
import { MobileFrameContext } from "./MobileFrame";

export interface TopAppBarProps {
  title?: string;
  showBack?: boolean;
  homeBrand?: boolean;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({ title, showBack = false }) => {
  const router = useRouter();
  const { showFullscreenControl } = useContext(MobileFrameContext);

  return (
    <header className="sticky top-0 z-40 bg-white px-4 pb-3 pt-[calc(2.25rem+env(safe-area-inset-top))] sm:pt-[1.875rem]">
      <div className="flex items-center justify-between">
        {/* Left: Branding or Title */}
        {title ? (
          <div className="flex min-w-0 items-center gap-2.5">
            {showBack && (
              <button
                onClick={() => router.back()}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#2F240E] hover:bg-[#FFF3D6] transition-colors -ml-1"
                aria-label="Kembali"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="truncate text-base font-bold text-[#2F240E]">{title}</h1>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Image
              src="/logos/nera-home-logo.webp"
              alt="Nera Logo"
              width={112}
              height={34}
              className="h-7 w-auto shrink-0 object-contain sm:h-8"
              priority
              unoptimized
            />
          </div>
        )}

        {/* Right: Notification Bell */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {/* Notification Bell */}
          <button
            className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[#2F240E] bg-[#F5F5F5] hover:bg-[#FFF3D6] transition-colors"
            aria-label="Notifikasi"
          >
            <Bell size={22} className="text-[#2F240E]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FFB900] ring-2 ring-white" />
          </button>

          {/* Demo-only: role switcher + persona scenario switcher (judge/demo aid) */}
          <DemoControlPanel />
          {showFullscreenControl && <FullscreenButton />}
        </div>
      </div>
    </header>
  );
};
