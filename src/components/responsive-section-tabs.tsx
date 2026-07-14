import * as React from "react"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type ResponsiveSectionTabItem = {
  disabled?: boolean
  label: string
  value: string
}

type ResponsiveSectionTabsProps = {
  id: string
  items: readonly ResponsiveSectionTabItem[]
  label: string
  onValueChange: (value: string) => void
  triggerClassName?: string
  value: string
}

export function ResponsiveSectionTabs({
  id,
  items,
  label,
  onValueChange,
  triggerClassName,
  value,
}: ResponsiveSectionTabsProps) {
  return (
    <>
      <div className="md:hidden" data-testid={`${id}-mobile-navigation`}>
        <Label htmlFor={`${id}-mobile`} className="sr-only">{label}</Label>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger id={`${id}-mobile`} className="w-full min-w-0" aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <TabsList className="hidden md:flex md:w-fit" aria-label={label}>
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            className={cn("min-w-24", triggerClassName)}
            value={item.value}
            disabled={item.disabled}
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </>
  )
}
