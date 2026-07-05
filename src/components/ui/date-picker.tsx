import * as React from "react"
import { CalendarIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDisplayDate, parseDateValue, toIsoDate } from "@/lib/date-utils"
import { cn } from "@/lib/utils"

function DatePicker({
  className,
  disabled,
  id,
  placeholder = "Select date",
  value,
  onChange,
}: {
  className?: string
  disabled?: boolean
  id?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selectedDate = parseDateValue(value)
  const displayValue = selectedDate ? formatDisplayDate(selectedDate) : value.trim()
  const hasValue = Boolean(value.trim() && !/^not set$/i.test(value.trim()))

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <div className={cn("relative min-w-0", className)}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full min-w-0 justify-start text-left font-normal",
              hasValue && "pr-12 md:pr-10",
              !hasValue && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="shrink-0" />
            <span className="truncate">{displayValue || placeholder}</span>
          </Button>
        </PopoverTrigger>
        {hasValue ? (
          <button
            type="button"
            disabled={disabled}
            aria-label="Clear date"
            className="absolute top-1/2 right-0.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,opacity] duration-150 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 md:right-1.5 md:size-7"
            onClick={() => onChange("")}
          >
            <XIcon className="size-4" />
          </button>
        ) : null}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          key={`${open ? "open" : "closed"}-${selectedDate?.getTime() ?? "empty"}`}
          mode="single"
          defaultMonth={selectedDate ?? new Date()}
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return
            onChange(toIsoDate(date))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
