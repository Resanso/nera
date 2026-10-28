"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, WalletIcon, UsersIcon, TrendingUpIcon, PlusIcon } from "@nera/ui/icons";
import { cn } from "@nera/ui";
import { CenterActionSheet } from "./CenterActionSheet";

const LEFT_ITEMS = [
  { label: "Beranda", href: "/", icon: HomeIcon },
  { label: "Kantong", href: "/pockets", icon: WalletIcon },
];

const RIGHT_ITEMS = [
  { label: "Keluarga", href: "/family-hub", icon: UsersIcon },
  { label: "Investasi", href: "/wealth-engine", icon: TrendingUpIcon },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const renderItem = ({ label, href, icon: Icon }: (typeof LEFT_ITEMS)[number]) => {
    const isActive = pathname === href;

    return (
      <Link
        key={href}
        href={href}
        aria-current={isActive ? "page" : undefined}
        className="flex flex-col items-center justify-center gap-[3px]"
      >
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl transition-colors duration-150",
            isActive ? "bg-[#FFF3D6] text-[#76520E]" : "text-[#736B60] hover:text-[#2F240E]"
          )}
        >
          <Icon
            size={20}
            strokeWidth={isActive ? 2.2 : 1.8}
            variant={isActive ? "duo" : "line"}
            accent={isActive ? "#FFB900" : undefined}
          />
        </span>
        <span
          className={cn("text-[10px] leading-none tracking-tight transition-colors duration-150", {
            "font-bold text-[#76520E]": isActive,
            "font-normal text-[#736B60]": !isActive,
          })}
        >
          {label}
        </span>
      </Link>
    );
  };

  const isRiskActive = pathname === "/risk-check";

  return (
    <>
      <CenterActionSheet open={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <nav className="absolute inset-x-0 bottom-0 z-40 w-full overflow-visible border-t border-[#F0EEE9] bg-white/95 px-3 pt-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="grid grid-cols-5 items-end">
          {LEFT_ITEMS.map(renderItem)}
          <div aria-hidden className="h-0" />
          {RIGHT_ITEMS.map(renderItem)}
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Buka aksi cepat"
          aria-haspopup="dialog"
          aria-expanded={isMenuOpen}
          className={cn(
            "absolute left-1/2 top-0 flex h-[54px] w-[54px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ring-4 ring-white transition-colors duration-150",
            isRiskActive || isMenuOpen
              ? "bg-[#76520E] text-white"
              : "bg-[#FFB900] text-[#352500] shadow-[0_6px_16px_rgba(255,185,0,0.35)]"
          )}
        >
          <PlusIcon size={26} strokeWidth={2.4} />
        </button>
      </nav>
    </>
  );
};
