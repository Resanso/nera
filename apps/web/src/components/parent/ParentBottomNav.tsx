"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboardIcon, SlidersIcon } from "@nera/ui/icons";
import { cn } from "@nera/ui";

export const ParentBottomNav: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { label: "Ringkasan", href: "/parent", icon: LayoutDashboardIcon },
    { label: "Alokasi", href: "/parent/allowance", icon: SlidersIcon },
  ];

  return (
    <nav className="absolute inset-x-0 bottom-0 z-40 w-full border-t border-[#F0EEE9] bg-white/95 px-3 pt-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] backdrop-blur-md">
      <div className="grid grid-cols-2 items-end">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
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
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
