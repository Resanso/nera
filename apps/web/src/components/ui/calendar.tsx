"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@nera/ui/icons";
import { DayPicker, getDefaultClassNames, type DayPickerProps } from "react-day-picker";
import { id } from "react-day-picker/locale";
import { cn } from "@nera/ui";

/**
 * shadcn/ui Calendar (react-day-picker v9) in Nera's palette, Indonesian locale.
 * Range ends are solid yellow, the days between them a soft tint.
 */
export function Calendar({ className, classNames, showOutsideDays = true, ...props }: DayPickerProps) {
  const d = getDefaultClassNames();
  return (
    <DayPicker
      locale={id}
      showOutsideDays={showOutsideDays}
      className={cn("w-full select-none", className)}
      classNames={{
        root: cn(d.root, "w-full"),
        months: "relative flex flex-col",
        month: "flex w-full flex-col gap-3",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous:
          "flex h-8 w-8 items-center justify-center rounded-full text-[#2F240E] hover:bg-[#F7F5F0] disabled:opacity-30",
        button_next:
          "flex h-8 w-8 items-center justify-center rounded-full text-[#2F240E] hover:bg-[#F7F5F0] disabled:opacity-30",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-[14px] font-bold capitalize text-[#2F240E]",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "flex-1 pb-1 text-[11px] font-semibold uppercase text-[#A89F90]",
        week: "mt-1 flex w-full",
        day: "group/day relative h-10 flex-1 p-0 text-center",
        day_button: cn(
          "flex h-full w-full items-center justify-center rounded-full text-[13px] font-medium tabular-nums text-[#2F240E]",
          "transition-colors hover:bg-[#FFF0BD] focus-visible:outline-2 focus-visible:outline-[#A36A00]",
          "group-data-[selected=true]/day:font-bold",
        ),
        range_start: "rounded-l-full bg-[#FFF0BD] [&>button]:bg-[#FFB900] [&>button]:text-[#352500] [&>button]:hover:bg-[#FFB900]",
        range_end: "rounded-r-full bg-[#FFF0BD] [&>button]:bg-[#FFB900] [&>button]:text-[#352500] [&>button]:hover:bg-[#FFB900]",
        range_middle: "rounded-none bg-[#FFF0BD] [&>button]:rounded-none [&>button]:hover:bg-[#FFE38A]",
        selected: "",
        today: "[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-[#A36A00]",
        outside: "[&>button]:text-[#C9C2B6]",
        disabled: "[&>button]:pointer-events-none [&>button]:text-[#D8D3C9]",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: c }) =>
          orientation === "left" ? <ChevronLeftIcon size={18} className={c} /> : <ChevronRightIcon size={18} className={c} />,
      }}
      {...props}
    />
  );
}
