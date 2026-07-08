"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  normalizeWorkspaceIconId,
  WorkspaceIconGlyph,
  workspaceIconOptions,
  type WorkspaceIconId,
} from "@/lib/workspace-icons"

export function WorkspaceIconPicker({
  description = "Choose the mark that helps this workspace stand apart.",
  label = "Icon",
  onChange,
  value,
}: {
  description?: string
  label?: string
  onChange: (value: WorkspaceIconId) => void
  value: WorkspaceIconId | string | null | undefined
}) {
  const selectedIconId = normalizeWorkspaceIconId(value)

  return (
    <div className="grid gap-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div
        aria-label="Workspace icon"
        className="grid grid-cols-4 gap-2"
        role="radiogroup"
      >
        {workspaceIconOptions.map((option) => {
          const isSelected = option.id === selectedIconId

          return (
            <Button
              key={option.id}
              aria-checked={isSelected}
              aria-label={option.label}
              className={cn(
                "h-11 rounded-lg p-0",
                isSelected ? "" : "bg-background"
              )}
              onClick={() => onChange(option.id)}
              role="radio"
              title={option.label}
              type="button"
              variant={isSelected ? "default" : "outline"}
            >
              <WorkspaceIconGlyph
                className={cn("size-4", isSelected ? "text-primary-foreground" : "text-muted-foreground")}
                iconId={option.id}
              />
            </Button>
          )
        })}
      </div>
    </div>
  )
}
