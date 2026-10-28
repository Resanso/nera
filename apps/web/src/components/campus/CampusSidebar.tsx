"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutGridIcon, ShieldCheckIcon, BellRingIcon, ChevronDownIcon, MapPinIcon, GraduationCapIcon, UsersIcon } from "@nera/ui/icons";
import { cn } from "@nera/ui";
import { CAMPUS_PROFILE } from "@nera/core";

const NAV_ITEMS = [
  { label: "Ringkasan", href: "/campus", icon: LayoutGridIcon },
  { label: "Kohort Risiko", href: "/campus/cohorts", icon: ShieldCheckIcon },
  { label: "Peringatan", href: "/campus/alerts", icon: BellRingIcon },
];

export const CampusSidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 min-h-screen bg-white border-r border-[#E9E5DD] lg:flex lg:flex-col">
      <div className="p-6 space-y-2.5">
        <div className="flex items-center gap-3">
          <Image
            src="/logos/nera-home-logo.webp"
            alt="Nera Logo"
            width={112}
            height={34}
            className="h-8 w-auto object-contain"
            priority
            unoptimized
          />
        </div>
        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#817B70]">
          Campus Financial Safety
        </span>
      </div>

      <nav className="flex-1 px-4 space-y-1.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors",
                isActive
                  ? "bg-[#FFF3D6] text-[#5B410C]"
                  : "text-[#736B60] hover:bg-[#F7F5F0] hover:text-[#2F240E]"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 space-y-2.5">
        <div className="flex items-center justify-center gap-3 text-[10px] font-medium text-[#817B70]">
          <span>Lihat sebagai:</span>
          <Link href="/" className="flex items-center gap-1 hover:text-[#76520E] transition-colors">
            <GraduationCapIcon size={11} /> Mahasiswa
          </Link>
          <span>·</span>
          <Link href="/parent" className="flex items-center gap-1 hover:text-[#76520E] transition-colors">
            <UsersIcon size={11} /> Orang Tua
          </Link>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#F7F5F0] cursor-pointer hover:bg-[#FFF3D6] transition-colors">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#FFB900] text-[#352500] flex items-center justify-center font-bold text-sm">
              N
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white border-2 border-[#FFF3D6] flex items-center justify-center">
              <MapPinIcon size={9} className="text-[#76520E]" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#2F240E] truncate">{CAMPUS_PROFILE.name}</p>
            <p className="text-[11px] text-[#736B60] truncate">{CAMPUS_PROFILE.institution}</p>
          </div>
          <ChevronDownIcon size={16} className="text-[#817B70] shrink-0" />
        </div>
      </div>
    </aside>
  );
};

export const CampusMobileNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-[#E9E5DD] bg-white px-4 py-3 lg:hidden" aria-label="Navigasi kampus">
      {NAV_ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-[#5B410C]",
            pathname === href && "bg-[#FFF3D6]"
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
};
