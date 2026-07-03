import * as React from "react"

import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type DialogActionsProps = React.ComponentProps<typeof DialogFooter> & {
  cancelLabel?: string
  cancelDisabled?: boolean
  onCancel?: () => void
  secondaryActions?: React.ReactNode
  primaryAction: React.ReactNode
}

function DialogActions({
  cancelDisabled,
  cancelLabel = "Cancel",
  children,
  className,
  onCancel,
  primaryAction,
  secondaryActions,
  ...props
}: DialogActionsProps) {
  return (
    <DialogFooter
      className={cn("gap-3 max-sm:[&_[data-slot=button]]:w-full sm:justify-between", className)}
      {...props}
    >
      <Button variant="outline" disabled={cancelDisabled} onClick={onCancel}>
        {cancelLabel}
      </Button>
      <div className="grid gap-2 sm:flex sm:flex-row sm:justify-end">
        {children ?? secondaryActions}
        {primaryAction}
      </div>
    </DialogFooter>
  )
}

export { DialogActions }
