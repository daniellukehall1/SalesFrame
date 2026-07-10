export type PublicMarketingLink = {
  href: string
  label: string
}

export type PublicMarketingNavGroup = {
  id: "playbooks" | "use-cases" | "compare" | "resources"
  label: string
  href: string
  links: PublicMarketingLink[]
}

export const publicMarketingNavGroups: PublicMarketingNavGroup[] = [
  {
    id: "playbooks",
    label: "Playbooks",
    href: "/playbooks",
    links: [
      { href: "/playbooks/meddicc", label: "MEDDICC" },
      { href: "/playbooks/bant", label: "BANT" },
      { href: "/playbooks/spin-selling", label: "SPIN Selling" },
      { href: "/playbooks/sandler", label: "Sandler" },
      { href: "/playbooks/challenger-sale", label: "Challenger Sale" },
      { href: "/playbooks/gap-selling", label: "Gap Selling" },
      { href: "/playbooks/spiced", label: "SPICED" },
    ],
  },
  {
    id: "use-cases",
    label: "Use Cases",
    href: "/use-cases",
    links: [
      { href: "/ai-sales-coach", label: "AI sales coach" },
      { href: "/real-time-sales-coaching", label: "Real-time sales coaching" },
      { href: "/sales-discovery-call-coach", label: "Discovery call coach" },
      { href: "/sales-call-coaching-software", label: "Sales call coaching software" },
    ],
  },
  {
    id: "compare",
    label: "Compare",
    href: "/compare",
    links: [
      { href: "/compare/gong", label: "Gong" },
      { href: "/compare/clari-copilot", label: "Clari Copilot" },
      { href: "/compare/fireflies", label: "Fireflies" },
      { href: "/compare/fathom", label: "Fathom" },
      { href: "/compare/outreach", label: "Outreach" },
    ],
  },
  {
    id: "resources",
    label: "Resources",
    href: "/resources",
    links: [
      { href: "/resources/discovery-call-guide", label: "Discovery call guide" },
      { href: "/resources/meddicc-discovery-questions", label: "MEDDICC questions" },
      { href: "/resources/bant-qualification-questions", label: "BANT questions" },
      { href: "/resources/spin-selling-questions-for-saas-discovery", label: "SPIN SaaS questions" },
      { href: "/resources/sandler-upfront-contract-examples", label: "Sandler upfront contract" },
      { href: "/resources/stop-sales-calls-becoming-checklist-interviews", label: "Stop checklist interviews" },
    ],
  },
]

export const publicMarketingPaths = [
  ...publicMarketingNavGroups.flatMap((group) => [group.href, ...group.links.map((link) => link.href)]),
  "/ai-meeting-notetaker-for-sales",
  "/conversation-intelligence-alternative",
  "/meddicc-software",
]

export function normalizePublicMarketingPath(pathname: string) {
  if (!pathname || pathname === "/") return null

  let normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname
  if (normalized.endsWith(".html")) normalized = normalized.slice(0, -5)

  return publicMarketingPaths.includes(normalized) ? normalized : null
}

export function isPublicMarketingRoute(pathname: string) {
  return normalizePublicMarketingPath(pathname) !== null
}
