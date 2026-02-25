import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays
      // 整个日历容器设置为 relative，并在左右预留一点空间给月份切换箭头
      className={cn("relative p-3 px-8 text-zinc-900", className)}
      classNames={{
        // 标题栏（显示“2026年2月”）
        // 设为 relative，方便下面的 nav 绝对定位在标题行内部。
        caption:
          "relative flex justify-center py-2 mb-1 items-center text-zinc-900",
        caption_label: "text-sm font-semibold text-zinc-900",
        // 导航区域只占据标题行高度，箭头在标题左右两侧，不会和日期区域重叠。
        // 使用 pointer-events-none，避免挡住其它区域点击，单独给按钮开启 pointer-events。
        nav: "absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-1 pointer-events-none",
        // v9: 使用 button_previous / button_next 来设置月份切换箭头样式
        button_previous: cn(
          "h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100 inline-flex items-center justify-center rounded-md text-zinc-700 pointer-events-auto"
        ),
        button_next: cn(
          "h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100 inline-flex items-center justify-center rounded-md text-zinc-700 pointer-events-auto"
        ),
        // v9: 使用 month_grid / weekdays / weekday / week 控制布局，保证星期与日期对齐
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-zinc-900 rounded-md w-9 font-medium text-[0.8rem] flex items-center justify-center",
        week: "flex w-full mt-1",
        day: cn(
          "h-9 w-9 p-0 font-medium aria-selected:opacity-100 inline-flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-900"
        ),
        day_selected:
          "bg-zinc-900 text-zinc-50 hover:bg-zinc-900 hover:text-zinc-50",
        day_today:
          "bg-zinc-100 text-zinc-900 border border-zinc-300 font-semibold",
        day_outside: "text-zinc-500 opacity-70",
        day_disabled: "text-zinc-500 opacity-70",
        ...classNames,
      }}
      {...props}
    />
  );
}

