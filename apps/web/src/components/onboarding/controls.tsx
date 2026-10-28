"use client";

import React from "react";
import type { NeraIcon } from "@nera/ui/icons";
import { CheckIcon } from "@nera/ui/icons";
import { cn } from "@nera/ui";

type Tone = "yellow" | "mint" | "sky" | "peach";

const TONE_STYLES: Record<Tone, { iconBg: string; iconText: string; selectedBorder: string; selectedBg: string }> = {
  yellow: {
    iconBg: "bg-[#FFF0BD]",
    iconText: "text-[#6D4C00]",
    selectedBorder: "border-[#FFB900]",
    selectedBg: "bg-[#FFFBEF]",
  },
  mint: {
    iconBg: "bg-[#DDF0E6]",
    iconText: "text-[#277449]",
    selectedBorder: "border-[#58B98D]",
    selectedBg: "bg-[#F4FCF8]",
  },
  sky: {
    iconBg: "bg-[#E3F0FB]",
    iconText: "text-[#1E5C8F]",
    selectedBorder: "border-[#7BB7E6]",
    selectedBg: "bg-[#F5FAFF]",
  },
  peach: {
    iconBg: "bg-[#FDE7DD]",
    iconText: "text-[#9A4B1F]",
    selectedBorder: "border-[#F0A87F]",
    selectedBg: "bg-[#FFF8F4]",
  },
};

export interface OptionCardProps {
  title: string;
  description?: string;
  icon: NeraIcon;
  selected: boolean;
  onClick: () => void;
  tone?: Tone;
}

export const OptionCard: React.FC<OptionCardProps> = ({
  title,
  description,
  icon: Icon,
  selected,
  onClick,
  tone = "yellow",
}) => {
  const styles = TONE_STYLES[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-3 rounded-[18px] border-2 bg-white p-3.5 text-left transition-all duration-150 active:scale-[0.995]",
        selected ? `${styles.selectedBorder} ${styles.selectedBg}` : "border-[#F0E6D2] hover:border-[#E4D6BC]"
      )}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]", styles.iconBg, styles.iconText)}>
        <Icon size={19} strokeWidth={2.1} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold leading-tight text-[#2F240E]">{title}</span>
        {description && (
          <span className="mt-1 block text-[11px] leading-relaxed text-[#817B70]">{description}</span>
        )}
      </span>
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-[#FFB900] bg-[#FFB900] text-[#352500]" : "border-[#E4DCCB] bg-white text-transparent"
        )}
        aria-hidden
      >
        <CheckIcon size={12} strokeWidth={3.2} />
      </span>
    </button>
  );
};

export interface ChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon?: NeraIcon;
}

export const Chip: React.FC<ChipProps> = ({ label, selected, onClick, icon: Icon }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98]",
      selected
        ? "border-[#76520E] bg-[#2F240E] text-white"
        : "border-[#E9E0CE] bg-white text-[#5E574C] hover:border-[#D8CBAF]"
    )}
  >
    {Icon && <Icon size={14} strokeWidth={2.2} className={selected ? "text-[#FFB900]" : "text-[#A36A00]"} />}
    {label}
  </button>
);

export interface FieldLabelProps {
  children: React.ReactNode;
  optional?: boolean;
  hint?: string;
}

export const FieldLabel: React.FC<FieldLabelProps> = ({ children, optional, hint }) => (
  <div className="mb-2 flex items-baseline justify-between gap-2">
    <p className="text-[12px] font-bold text-[#2F240E]">{children}</p>
    {optional && <span className="text-[10px] font-medium text-[#A79F92]">Opsional</span>}
    {hint && !optional && <span className="text-[10px] font-medium text-[#A79F92]">{hint}</span>}
  </div>
);

export interface ToggleCardProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  icon: NeraIcon;
  badge?: string;
}

export const ToggleCard: React.FC<ToggleCardProps> = ({
  title,
  description,
  checked,
  onChange,
  icon: Icon,
  badge,
}) => (
  <div
    className={cn(
      "rounded-[18px] border-2 p-3.5 transition-colors duration-150",
      checked ? "border-[#58B98D] bg-[#F4FCF8]" : "border-[#F0E6D2] bg-white"
    )}
  >
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]",
          checked ? "bg-[#DDF0E6] text-[#277449]" : "bg-[#F7F5F0] text-[#817B70]"
        )}
      >
        <Icon size={18} strokeWidth={2.1} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-bold leading-tight text-[#2F240E]">{title}</p>
          {badge && (
            <span className="rounded-full bg-[#FFF0BD] px-1.5 py-0.5 text-[9px] font-bold text-[#6D4C00]">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[#817B70]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-[#22C55E]" : "bg-[#E0D9CB]"
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  </div>
);
