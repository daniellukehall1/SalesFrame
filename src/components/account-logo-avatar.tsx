import * as React from "react"

import {
  buildAccountLogoFallbackUrl,
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
  retryKey,
  size = "sm",
}: {
  className?: string
  domain?: string | null
  logoUrl?: string | null
  name: string
  retryKey?: string | null
  size?: keyof typeof accountLogoSizeClasses
}) {
  const [failedLogoUrls, setFailedLogoUrls] = React.useState<Set<string>>(() => new Set())
  const normalizedDomain = normalizeAccountLogoDomain(domain)
  const logoSize = size === "lg" ? 96 : 64
  const candidateLogoUrls = React.useMemo(
    () => [
      logoUrl ?? "",
      buildAccountLogoUrl(normalizedDomain, { size: logoSize }),
      buildAccountLogoFallbackUrl(normalizedDomain, { size: logoSize }),
    ].filter((url, index, urls) => Boolean(url) && urls.indexOf(url) === index),
    [logoSize, logoUrl, normalizedDomain]
  )
  const resolvedLogoUrl = candidateLogoUrls.find((url) => !failedLogoUrls.has(url)) ?? ""
  const shouldShowImage = Boolean(resolvedLogoUrl)

  React.useEffect(() => {
    setFailedLogoUrls(new Set())
  }, [candidateLogoUrls, retryKey])

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
          decoding="async"
          draggable={false}
          height={size === "lg" ? 48 : size === "md" ? 40 : 28}
          loading="lazy"
          referrerPolicy="origin"
          src={resolvedLogoUrl}
          width={size === "lg" ? 48 : size === "md" ? 40 : 28}
          onError={() => {
            setFailedLogoUrls((urls) => {
              const nextUrls = new Set(urls)
              nextUrls.add(resolvedLogoUrl)
              return nextUrls
            })
          }}
        />
      ) : (
        <span className="font-medium tracking-normal">{getAccountLogoInitials(name)}</span>
      )}
    </span>
  )
}
