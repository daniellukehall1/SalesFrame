export type AccountRouteTab = "record" | "contacts" | "opportunities" | "intelligence"

export type AuthenticatedRoute =
  | { kind: "view"; view: string; workspaceId?: string }
  | { accountId: string; kind: "account"; tab: AccountRouteTab; view: "account-detail" }
  | { kind: "opportunity"; opportunityId: string; view: string }
  | { callId: string; kind: "call"; view: "post-call" | "workspace" }

export type AuthenticatedRouteState = {
  accountId?: string
  accountTab?: AccountRouteTab
  activeView: string
  callId?: string
  opportunityId?: string
  workspaceId?: string
}

const accountTabBySegment: Record<string, AccountRouteTab> = {
  contacts: "contacts",
  intelligence: "intelligence",
  opportunities: "opportunities",
}

const accountSegmentByTab: Record<AccountRouteTab, string> = {
  contacts: "/contacts",
  intelligence: "/intelligence",
  opportunities: "/opportunities",
  record: "",
}

const opportunityViewBySegment: Record<string, string> = {
  cockpit: "workspace",
  contacts: "opportunity-contacts",
  history: "opportunity-history",
  intelligence: "opportunity-intelligence",
  methodology: "methodology",
  "post-call": "post-call",
}

const opportunitySegmentByView: Record<string, string> = {
  methodology: "/methodology",
  "opportunity-contacts": "/contacts",
  "opportunity-history": "/history",
  "opportunity-intelligence": "/intelligence",
  "opportunity-record": "",
  "post-call": "/post-call",
  workspace: "/cockpit",
}

const authenticatedPlaybookViews = new Set([
  "bant",
  "challenger",
  "custom",
  "force-management",
  "gap-selling",
  "meddicc",
  "meddpicc",
  "sandler",
  "spiced",
  "spin",
  "strategic-selling",
  "value-selling",
])

const workspaceScopedViews = new Set([
  "ai",
  "bant",
  "billing",
  "calls",
  "capture",
  "challenger",
  "custom",
  "force-management",
  "gap-selling",
  "home",
  "meddicc",
  "meddpicc",
  "opportunities",
  "playbooks",
  "retention",
  "sandler",
  "settings",
  "spiced",
  "spin",
  "strategic-selling",
  "value-selling",
])

const simpleViewByPath: Record<string, string> = {
  "/app": "home",
  "/app/playbooks": "playbooks",
  "/billing": "billing",
  "/calls": "calls",
  "/coach-popout": "coach-popout",
  "/opportunities": "opportunities",
  "/profile": "profile-account",
  "/roadmap": "roadmap",
  "/settings": "settings",
  "/settings/ai": "ai",
  "/settings/capture": "capture",
  "/settings/retention": "retention",
  "/support": "help",
}

function getAuthenticatedLocationParts(location: string) {
  const hashlessLocation = location.split("#", 1)[0] || "/"
  const queryIndex = hashlessLocation.indexOf("?")
  const pathname = queryIndex === -1 ? hashlessLocation : hashlessLocation.slice(0, queryIndex)
  const search = queryIndex === -1 ? "" : hashlessLocation.slice(queryIndex + 1)

  return { pathname: pathname || "/", search }
}

function normalizePathname(pathname: string) {
  const pathOnly = getAuthenticatedLocationParts(pathname).pathname
  return pathOnly.length > 1 && pathOnly.endsWith("/") ? pathOnly.slice(0, -1) : pathOnly
}

function decodeRouteId(value: string | undefined) {
  if (!value) return null

  try {
    const decoded = decodeURIComponent(value)
    return decoded.length <= 128 && /^[A-Za-z0-9_-]+$/.test(decoded) ? decoded : null
  } catch {
    return null
  }
}

function getWorkspaceIdFromLocation(location: string, view: string) {
  if (!workspaceScopedViews.has(view)) return undefined

  const { search } = getAuthenticatedLocationParts(location)
  const workspaceId = decodeRouteId(new URLSearchParams(search).get("workspace") ?? undefined)
  return workspaceId ?? undefined
}

function appendWorkspaceId(path: string, view: string, workspaceId?: string) {
  if (!workspaceScopedViews.has(view)) return path

  const normalizedWorkspaceId = decodeRouteId(workspaceId)
  return normalizedWorkspaceId
    ? `${path}?workspace=${encodeURIComponent(normalizedWorkspaceId)}`
    : path
}

export function parseAuthenticatedRoute(pathname: string): AuthenticatedRoute | null {
  const normalizedPath = normalizePathname(pathname)
  const simpleView = simpleViewByPath[normalizedPath]
  if (simpleView) {
    const workspaceId = getWorkspaceIdFromLocation(pathname, simpleView)
    return workspaceId
      ? { kind: "view", view: simpleView, workspaceId }
      : { kind: "view", view: simpleView }
  }

  const segments = normalizedPath.split("/").filter(Boolean)

  if (segments[0] === "app" && segments[1] === "playbooks" && segments.length === 3) {
    const playbookView = decodeRouteId(segments[2])
    if (!playbookView || !authenticatedPlaybookViews.has(playbookView)) return null

    const workspaceId = getWorkspaceIdFromLocation(pathname, playbookView)
    return workspaceId
      ? { kind: "view", view: playbookView, workspaceId }
      : { kind: "view", view: playbookView }
  }

  if (segments[0] === "accounts" && (segments.length === 2 || segments.length === 3)) {
    const accountId = decodeRouteId(segments[1])
    const tab = segments.length === 2 ? "record" : accountTabBySegment[segments[2]]

    return accountId && tab
      ? { accountId, kind: "account", tab, view: "account-detail" }
      : null
  }

  if (segments[0] === "opportunities" && (segments.length === 2 || segments.length === 3)) {
    const opportunityId = decodeRouteId(segments[1])
    const view = segments.length === 2 ? "opportunity-record" : opportunityViewBySegment[segments[2]]

    return opportunityId && view
      ? { kind: "opportunity", opportunityId, view }
      : null
  }

  if (segments[0] === "calls" && (segments.length === 2 || segments.length === 3)) {
    const callId = decodeRouteId(segments[1])
    const view = segments.length === 2 ? "post-call" : segments[2] === "cockpit" ? "workspace" : null
    return callId && view ? { callId, kind: "call", view } : null
  }

  return null
}

export function isAuthenticatedAppPath(pathname: string) {
  return parseAuthenticatedRoute(pathname) !== null
}

export function isProtectedRoutePath(pathname: string) {
  const normalizedPath = normalizePathname(pathname)
  return isAuthenticatedAppPath(normalizedPath) || [
    "/accounts",
    "/app",
    "/billing",
    "/calls",
    "/coach-popout",
    "/opportunities",
    "/profile",
    "/roadmap",
    "/settings",
    "/support",
  ].some((rootPath) => normalizedPath === rootPath || normalizedPath.startsWith(`${rootPath}/`))
}

export function getAuthenticatedRoutePath(route: AuthenticatedRoute) {
  if (route.kind === "account") {
    return `/accounts/${encodeURIComponent(route.accountId)}${accountSegmentByTab[route.tab]}`
  }

  if (route.kind === "opportunity") {
    const suffix = opportunitySegmentByView[route.view]
    return suffix === undefined ? "/app" : `/opportunities/${encodeURIComponent(route.opportunityId)}${suffix}`
  }

  if (route.kind === "call") {
    return `/calls/${encodeURIComponent(route.callId)}${route.view === "workspace" ? "/cockpit" : ""}`
  }

  let path = "/app"

  if (route.view === "opportunities") path = "/opportunities"
  else if (route.view === "calls") path = "/calls"
  else if (route.view === "coach-popout") path = "/coach-popout"
  else if (route.view === "playbooks") path = "/app/playbooks"
  else if (authenticatedPlaybookViews.has(route.view)) path = `/app/playbooks/${route.view}`
  else if (route.view === "settings") path = "/settings"
  else if (route.view === "capture") path = "/settings/capture"
  else if (route.view === "retention") path = "/settings/retention"
  else if (route.view === "ai") path = "/settings/ai"
  else if (route.view === "profile-account") path = "/profile"
  else if (route.view === "help") path = "/support"
  else if (route.view === "roadmap") path = "/roadmap"
  else if (route.view === "billing") path = "/billing"

  return appendWorkspaceId(path, route.view, route.workspaceId)
}

export function getAuthenticatedPathForState({
  accountId,
  accountTab = "record",
  activeView,
  callId,
  opportunityId,
  workspaceId,
}: AuthenticatedRouteState) {
  if (activeView === "account-detail" && accountId) {
    return getAuthenticatedRoutePath({ accountId, kind: "account", tab: accountTab, view: "account-detail" })
  }

  if (activeView === "post-call" && callId) {
    return getAuthenticatedRoutePath({ callId, kind: "call", view: "post-call" })
  }

  if (activeView === "workspace" && callId) {
    return getAuthenticatedRoutePath({ callId, kind: "call", view: "workspace" })
  }

  if (opportunitySegmentByView[activeView] !== undefined && opportunityId) {
    return getAuthenticatedRoutePath({ kind: "opportunity", opportunityId, view: activeView })
  }

  return getAuthenticatedRoutePath({ kind: "view", view: activeView, workspaceId })
}

export function getSafeAuthenticatedNextPath(search: string) {
  const rawNextPath = new URLSearchParams(search).get("next")
  if (!rawNextPath || !rawNextPath.startsWith("/") || rawNextPath.startsWith("//")) return null

  const route = parseAuthenticatedRoute(rawNextPath)
  return route ? getAuthenticatedRoutePath(route) : null
}

export function getRouteResource(route: AuthenticatedRoute) {
  if (route.kind === "account") return { id: route.accountId, type: "account" as const }
  if (route.kind === "opportunity") return { id: route.opportunityId, type: "opportunity" as const }
  if (route.kind === "call") return { id: route.callId, type: "call" as const }

  return null
}

export function getRouteWorkspaceId(route: AuthenticatedRoute) {
  return route.kind === "view" && workspaceScopedViews.has(route.view)
    ? route.workspaceId ?? null
    : null
}
