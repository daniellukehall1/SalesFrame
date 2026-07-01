import * as React from "react"

import {
  buildAccountLogoUrl,
  getAccountLogoInitials,
  normalizeAccountLogoDomain,
} from "@/lib/account-logo"
import { cn } from "@/lib/utils"

const accountLogoSizeClasses = {
  lg: "size-12 rounded-xl text-sm",
  md: "size-10 rounded-lg text-sm",
  sm: "size-7 rounded-md text-[10px]",
} as const

export function AccountLogoAvatar({
  className,
  domain,
  logoUrl,
  name,
  size = "sm",
}: {
  className?: string
  domain?: string | null
  logoUrl?: string | null
  name: string
  size?: keyof typeof accountLogoSizeClasses
}) {
  const [imageFailed, setImageFailed] = React.useState(false)
  const normalizedDomain = normalizeAccountLogoDomain(domain)
  const resolvedLogoUrl = logoUrl || buildAccountLogoUrl(normalizedDomain, { size: size === "lg" ? 96 : 64 })
  const shouldShowImage = Boolean(resolvedLogoUrl && !imageFailed)

  React.useEffect(() => {
    setImageFailed(false)
  }, [resolvedLogoUrl])

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground shadow-xs",
        accountLogoSizeClasses[size],
        className
      )}
    >
      {shouldShowImage ? (
        <img
          alt=""
          className="size-full rounded-[inherit] object-contain p-1"
          height={size === "lg" ? 48 : size === "md" ? 40 : 28}
          loading="lazy"
          referrerPolicy="origin"
          src={resolvedLogoUrl}
          width={size === "lg" ? 48 : size === "md" ? 40 : 28}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="font-medium tracking-normal">{getAccountLogoInitials(name)}</span>
      )}
    </span>
  )
}
