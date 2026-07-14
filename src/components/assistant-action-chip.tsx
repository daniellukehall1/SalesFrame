import * as React from "react"
import {
  ArrowUpRightIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  SparklesIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type AssistantActionChipIcon = "ai" | "open" | "details" | "more"
export type AssistantActionChipTone = "primary" | "secondary" | "quiet"

const assistantActionIcons = {
  ai: SparklesIcon,
  open: ArrowUpRightIcon,
  details: ChevronRightIcon,
  more: MoreHorizontalIcon,
} satisfies Record<AssistantActionChipIcon, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>>

export function AssistantActionChip({
  children,
  className,
  icon = "ai",
  tone = "secondary",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "variant"> & {
  icon?: AssistantActionChipIcon
  tone?: AssistantActionChipTone
}) {
  const Icon = assistantActionIcons[icon]

  return (
    <Button
      size="xs"
      variant={tone === "primary" ? "default" : tone === "quiet" ? "ghost" : "outline"}
      className={cn(
        "relative !h-8 !min-h-8 max-w-full rounded-full px-2.5 text-xs shadow-none",
        "after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] sm:after:inset-0",
        tone === "secondary" && "border-foreground/15 bg-muted/25 hover:border-foreground/25 hover:bg-muted/60",
        tone === "quiet" && "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </Button>
  )
}
