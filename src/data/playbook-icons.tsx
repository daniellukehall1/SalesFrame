import type { ReactNode } from "react"
import {
  BadgeDollarSignIcon,
  BrainCircuitIcon,
  ClipboardCheckIcon,
  CrosshairIcon,
  FileCheckIcon,
  HandshakeIcon,
  MessageCircleQuestionMarkIcon,
  NetworkIcon,
  RouteIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
  WaypointsIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

const playbookIconComponents = {
  bant: BadgeDollarSignIcon,
  challenger: BrainCircuitIcon,
  custom: SlidersHorizontalIcon,
  "force-management": CrosshairIcon,
  "gap-selling": RouteIcon,
  meddicc: ClipboardCheckIcon,
  meddpicc: FileCheckIcon,
  sandler: HandshakeIcon,
  spiced: WaypointsIcon,
  spin: MessageCircleQuestionMarkIcon,
  "strategic-selling": NetworkIcon,
  "value-selling": TrendingUpIcon,
} as const

export type PlaybookIconId = keyof typeof playbookIconComponents

export function getPlaybookIconComponent(playbookId: string) {
  return playbookIconComponents[playbookId as PlaybookIconId] ?? ClipboardCheckIcon
}

export function PlaybookIcon({
  className,
  iconClassName,
  playbookId,
}: {
  className?: string
  iconClassName?: string
  playbookId: string
}): ReactNode {
  const Icon = getPlaybookIconComponent(playbookId)

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground",
        className
      )}
    >
      <Icon className={cn("size-4", iconClassName)} />
    </span>
  )
}
