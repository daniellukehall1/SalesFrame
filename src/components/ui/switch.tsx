import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex h-11 w-11 shrink-0 items-center rounded-full border border-transparent bg-transparent transition-[border-color,box-shadow,opacity] duration-150 outline-none before:absolute before:left-1.5 before:top-1/2 before:h-[18.4px] before:w-[32px] before:-translate-y-1/2 before:rounded-full before:bg-input before:transition-colors before:duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=sm]:before:left-2.5 data-[size=sm]:before:h-[14px] data-[size=sm]:before:w-[24px] sm:data-[size=default]:h-[18.4px] sm:data-[size=default]:w-[32px] sm:data-[size=sm]:h-[14px] sm:data-[size=sm]:w-[24px] sm:before:left-0 sm:before:top-0 sm:before:h-full sm:before:w-full sm:before:translate-y-0 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:before:bg-primary data-unchecked:before:bg-input dark:data-unchecked:before:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none relative z-10 ml-1.5 block rounded-full bg-background ring-0 transition-transform duration-150 group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:ml-2.5 group-data-[size=sm]/switch:size-3 sm:ml-0 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
