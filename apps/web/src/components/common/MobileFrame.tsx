"use client";

import React, { createContext } from "react";
import { BottomNav } from "./BottomNav";
import { useUiPreferencesStore } from "../../context/UiPreferencesStore";

export interface MobileFrameProps {
  children: React.ReactNode;
  bottomNav?: React.ReactNode;
  showFullscreenControl?: boolean;
  hideBottomNav?: boolean;
}

export const MobileFrameContext = createContext({ showFullscreenControl: false });

export const MobileFrame: React.FC<MobileFrameProps> = ({
  children,
  bottomNav,
  showFullscreenControl = false,
  hideBottomNav = false,
}) => {
  const mockupCanvasColor = useUiPreferencesStore((s) => s.mockupCanvasColor);

  return (
    <div
      className="h-dvh sm:h-auto sm:min-h-screen flex justify-center items-start sm:py-6"
      style={{ backgroundColor: mockupCanvasColor }}
    >
      {/* data-mobile-frame: portal target for sheets that must cover the phone screen */}
      <div
        data-mobile-frame
        className="w-full max-w-[430px] h-dvh sm:h-auto sm:min-h-[890px] sm:max-h-[920px] bg-[#F1F2F4] flex flex-col relative sm:rounded-[36px] sm:border-[8px] sm:border-[#1E293B] shadow-2xl overflow-hidden"
      >
        {/* Scrollable Main Screen Container */}
        <div className="flex-1 overflow-y-auto select-none">
          <div
            className={
              hideBottomNav
                ? "flex flex-col min-h-full"
                : "flex flex-col min-h-full pb-[calc(5.25rem+env(safe-area-inset-bottom))]"
            }
          >
            <MobileFrameContext.Provider value={{ showFullscreenControl }}>
              {children}
            </MobileFrameContext.Provider>
          </div>
        </div>

        {hideBottomNav ? null : bottomNav ?? <BottomNav />}
      </div>
    </div>
  );
};

