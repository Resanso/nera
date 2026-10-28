import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../tokens";
import { XIcon } from "../icons";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** "sheet": slides up from the bottom of the phone frame instead of a centred dialog */
  variant?: "dialog" | "sheet";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  variant = "dialog",
}) => {
  // a sheet anchors to the phone frame, not to the (possibly long) page it was opened from
  const [frame, setFrame] = useState<Element | null>(null);
  useEffect(() => {
    if (variant === "sheet") setFrame(document.querySelector("[data-mobile-frame]") ?? document.body);
  }, [variant]);
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  if (variant === "sheet") {
    if (!frame) return null;
    return createPortal(
      <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="animate-overlay-in absolute inset-0 h-full w-full bg-[#2F240E]/45 backdrop-blur-[2px]"
        />
        <div className="animate-sheet-in pointer-events-none absolute inset-x-0 bottom-0 top-12 flex flex-col justify-end">
          <div
            className={cn(
              "pointer-events-auto flex max-h-full flex-col rounded-t-[28px] bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-12px_40px_rgba(47,36,14,0.28)]",
              className
            )}
          >
            <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-[#D8D3C9]" />
            <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
              <h3 className="text-[17px] font-bold text-[#2F240E]">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#736B60] transition-colors hover:bg-[#F7F5F0]"
              >
                <XIcon size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </div>
        </div>
      </div>,
      frame
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#2F240E]/45 backdrop-blur-sm animate-fade-in">
      <div
        className={cn(
          "w-full max-w-[430px] bg-white rounded-[26px] shadow-xl overflow-hidden p-6 animate-slide-up max-h-[85vh] overflow-y-auto",
          className
        )}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#E9E5DD] mb-4">
          <h3 className="text-lg font-bold text-[#2F240E]">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#736B60] hover:bg-[#F7F5F0] transition-colors"
          >
            <XIcon size={20} />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};
