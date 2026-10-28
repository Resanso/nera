import React from "react";
import { cn } from "../tokens";
import { CheckIcon } from "../icons";

export interface StepProgressItem {
  id: string;
  label: string;
  description?: string;
  isCompleted: boolean;
  isActive?: boolean;
}

export interface StepProgressProps {
  steps: StepProgressItem[];
  className?: string;
  accentColor?: string;
}

export const StepProgress: React.FC<StepProgressProps> = ({
  steps,
  className,
  accentColor = "#76520E",
}) => {
  return (
    <div className={cn("space-y-0", className)}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;

        return (
          <div key={step.id} className="flex gap-3">
            {/* Vertical line + circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 transition-all",
                  step.isCompleted
                    ? "bg-[#22C55E] border-[#22C55E] text-white"
                    : step.isActive
                    ? "border-current text-white"
                    : "bg-white border-[#E9E5DD] text-[#736B60]"
                )}
                style={
                  step.isActive && !step.isCompleted
                    ? { backgroundColor: accentColor, borderColor: accentColor }
                    : undefined
                }
              >
                {step.isCompleted ? (
                  <CheckIcon size={14} strokeWidth={3} />
                ) : (
                  idx + 1
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-[24px] transition-all",
                    step.isCompleted ? "bg-[#22C55E]" : "bg-[#E9E5DD]"
                  )}
                />
              )}
            </div>

            {/* Label + description */}
            <div className={cn("pb-4", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-xs font-bold leading-tight pt-1",
                  step.isCompleted
                    ? "text-[#22C55E]"
                    : step.isActive
                    ? "text-[#2F240E]"
                    : "text-[#736B60]"
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="text-[11px] text-[#736B60] mt-0.5 leading-relaxed">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
