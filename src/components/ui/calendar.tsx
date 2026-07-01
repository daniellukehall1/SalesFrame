import * as React from "react"
import {
  DayFlag,
  DayPicker,
  SelectionState,
  UI,
  type DayPickerProps,
} from "react-day-picker"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        [UI.Root]: "relative w-full",
        [UI.Months]: "flex flex-col gap-4",
        [UI.Month]: "space-y-4",
        [UI.MonthCaption]: "relative flex items-center justify-center pt-1",
        [UI.CaptionLabel]: "text-sm font-medium",
        [UI.Nav]: "absolute inset-x-0 top-1 flex items-center justify-between",
        [UI.PreviousMonthButton]: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-60 hover:opacity-100"
        ),
        [UI.NextMonthButton]: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-60 hover:opacity-100"
        ),
        [UI.MonthGrid]: "w-full border-collapse",
        [UI.Weekdays]: "flex",
        [UI.Weekday]: "w-8 rounded-md text-[0.8rem] font-normal text-muted-foreground",
        [UI.Weeks]: "grid gap-1",
        [UI.Week]: "flex w-full gap-1",
        [UI.Day]: "relative size-8 p-0 text-center text-sm",
        [UI.DayButton]: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal aria-selected:opacity-100"
        ),
        [DayFlag.today]: "rounded-md bg-accent text-accent-foreground",
        [DayFlag.outside]: "text-muted-foreground opacity-50",
        [DayFlag.disabled]: "text-muted-foreground opacity-50",
        [DayFlag.hidden]: "invisible",
        [SelectionState.selected]:
          "rounded-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        ...classNames,
      }}
      {...props}
    />
  )
}

export { Calendar }
