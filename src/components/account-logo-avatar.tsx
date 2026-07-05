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
  const [loadedLogoUrl, setLoadedLogoUrl] = React.useState("")
  const normalizedDomain = normalizeAccountLogoDomain(domain)
  const initials = getAccountLogoInitials(name)
  const logoSize = size === "lg" ? 96 : 64
  const candidateLogoUrls = React.useMemo(
    () => [
      buildAccountLogoUrl(normalizedDomain, { size: logoSize }),
      buildAccountLogoFallbackUrl(normalizedDomain, { size: logoSize }),
      logoUrl ?? "",
    ].filter((url, index, urls) => Boolean(url) && urls.indexOf(url) === index),
    [logoSize, logoUrl, normalizedDomain]
  )
  const resolvedLogoUrl = candidateLogoUrls.find((url) => !failedLogoUrls.has(url)) ?? ""
  const shouldShowImage = Boolean(resolvedLogoUrl)

  React.useEffect(() => {
    setFailedLogoUrls(new Set())
    setLoadedLogoUrl("")
  }, [candidateLogoUrls, retryKey])

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-border bg-muted text-muted-foreground shadow-xs",
        accountLogoSizeClasses[size],
        className
      )}
    >
      <span
        className={cn(
          "font-medium tracking-normal transition-opacity duration-[var(--sf-motion-base)] ease-[var(--sf-ease-standard)]",
          shouldShowImage && loadedLogoUrl === resolvedLogoUrl ? "opacity-0" : "opacity-100"
        )}
      >
        {initials}
      </span>
      {shouldShowImage ? (
        <img
          alt=""
          className={cn(
            "absolute inset-0 size-full rounded-[inherit] bg-background object-contain p-1 transition-opacity duration-[var(--sf-motion-base)] ease-[var(--sf-ease-standard)]",
            loadedLogoUrl === resolvedLogoUrl ? "opacity-100" : "opacity-0"
          )}
          decoding="async"
          draggable={false}
          height={size === "lg" ? 48 : size === "md" ? 40 : 28}
          loading="lazy"
          referrerPolicy="origin"
          src={resolvedLogoUrl}
          width={size === "lg" ? 48 : size === "md" ? 40 : 28}
          onLoad={() => {
            setLoadedLogoUrl(resolvedLogoUrl)
          }}
          onError={() => {
            setLoadedLogoUrl("")
            setFailedLogoUrls((urls) => {
              const nextUrls = new Set(urls)
              nextUrls.add(resolvedLogoUrl)
              return nextUrls
            })
          }}
        />
      ) : null}
    </span>
  )
}
