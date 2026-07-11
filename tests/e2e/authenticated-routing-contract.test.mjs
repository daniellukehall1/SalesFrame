import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8")

function getTomlArrayBlocks(source, section) {
  const marker = `[[${section}]]`

  return source
    .split(marker)
    .slice(1)
    .map((block) => block.split(/\n\[\[[^\]]+\]\]/, 1)[0])
}

function getTomlBlockForValue(blocks, key, value) {
  const expectedLine = `${key} = "${value}"`
  return blocks.find((block) => block.split("\n").some((line) => line.trim() === expectedLine)) ?? null
}

test("authenticated navigation uses canonical URLs and restores browser history", async () => {
  const app = await read("src/App.tsx")
  const routes = await read("src/lib/authenticated-routes.ts")
  const data = await read("src/lib/supabase/salesframe-data.ts")

  assert.match(routes, /export function parseAuthenticatedRoute/)
  assert.match(routes, /export function getAuthenticatedRoutePath/)
  assert.match(routes, /export function getAuthenticatedPathForState/)
  assert.match(routes, /return `\/accounts\/\$\{encodeURIComponent\(route\.accountId\)\}\$\{accountSegmentByTab\[route\.tab\]\}`/)
  assert.match(routes, /`\/opportunities\/\$\{encodeURIComponent\(route\.opportunityId\)\}\$\{suffix\}`/)
  assert.match(routes, /`\/calls\/\$\{encodeURIComponent\(route\.callId\)\}\$\{route\.view === "workspace" \? "\/cockpit" : ""\}`/)
  assert.match(routes, /route\.view === "capture"[\s\S]*"\/settings\/capture"/)
  assert.match(routes, /authenticatedPlaybookViews\.has\(route\.view\)[\s\S]*`\/app\/playbooks\/\$\{route\.view\}`/)
  assert.doesNotMatch(routes, /return `\/playbooks\/\$\{route\.view\}`/)

  assert.match(app, /const initialAuthenticatedRouteRef = React\.useRef<AuthenticatedRoute \| null>/)
  assert.match(app, /const \[authenticatedRouteRevision, setAuthenticatedRouteRevision\] = React\.useState\(0\)/)
  assert.match(app, /window\.addEventListener\("popstate", handlePopState\)/)
  assert.match(app, /setAuthenticatedRouteRevision\(\(value\) => value \+ 1\)/)
  assert.match(app, /currentAuthenticatedPathRef\.current[\s\S]*data-unsaved-contact-notes="true"[\s\S]*window\.history\.pushState[\s\S]*Save or revert the contact note changes/)
  assert.match(app, /React\.useLayoutEffect\(\(\) => \{[\s\S]*parseAuthenticatedRoute\(locationPath\)[\s\S]*route\.kind === "account"[\s\S]*route\.kind === "opportunity"[\s\S]*workspaceCalls\.find\(\(call\) => call\.id === route\.callId\)/)
  assert.match(app, /const shouldOpenCockpit = route\.view === "workspace" && isCurrentLiveCall/)
  assert.match(app, /setPostCallFocusCallId\(shouldOpenCockpit \? "" : selectedCall\.id\)/)
  assert.match(app, /setActiveView\(shouldOpenCockpit \? "workspace" : "post-call"\)/)
  assert.match(app, /route\.view === "workspace" && !shouldOpenCockpit[\s\S]*view: "post-call"[\s\S]*"replace"/)
  assert.match(app, /const protectedRouteUnavailableMessage =[\s\S]*This page is not available\. The link may be outdated/)
  assert.match(app, /setAuthenticatedRouteError\(protectedRouteUnavailableMessage\)/)
  assert.match(app, /const handleRetryAuthenticatedRoute = React\.useCallback\(\(\) => \{[\s\S]*authenticatedRouteLookupKeyRef\.current = ""[\s\S]*setAuthenticatedRouteRevision/)

  assert.match(data, /export async function resolveRecordWorkspaceId/)
  assert.match(data, /\.select\("workspace_id"\)[\s\S]*\.eq\("id", resource\.id\)[\s\S]*\.maybeSingle\(\)/)
  assert.match(app, /const \[initialWorkspaceRows, resourceWorkspaceId\] = await Promise\.all/)
  assert.match(app, /resolveRecordWorkspaceId\(requestedResource\)/)
  assert.match(app, /const routeWorkspaceId = resourceWorkspaceId \|\| requestedViewWorkspaceId/)
  assert.match(app, /preferredWorkspaceId/)
  assert.match(app, /authenticatedRouteLookupKeyRef[\s\S]*resolveRecordWorkspaceId\(routeResource\)[\s\S]*setActiveWorkspaceId\(targetWorkspace\.id\)/)
})

test("call routes preserve cockpit intent while active and settle on the call post-call URL when stopped", async () => {
  const app = await read("src/App.tsx")
  const routes = await import("../../src/lib/authenticated-routes.ts")
  const handleCallSelect = app.slice(
    app.indexOf("const handleCallSelect ="),
    app.indexOf("const handleAccountTabChange =")
  )
  const handleRecordingChange = app.slice(
    app.indexOf("const handleRecordingChange ="),
    app.indexOf("const handleStartRecording =")
  )
  const handleStartRecording = app.slice(
    app.indexOf("const handleStartRecording ="),
    app.indexOf("const handleCreateAccount =")
  )

  assert.deepEqual(routes.parseAuthenticatedRoute("/calls/call-1/cockpit"), {
    callId: "call-1",
    kind: "call",
    view: "workspace",
  })
  assert.equal(
    routes.getAuthenticatedRoutePath({ callId: "call-1", kind: "call", view: "workspace" }),
    "/calls/call-1/cockpit"
  )
  assert.equal(
    routes.getAuthenticatedPathForState({ activeView: "workspace", callId: "call-1" }),
    "/calls/call-1/cockpit"
  )

  assert.match(handleCallSelect, /view: isActiveSelectedCall \? "workspace" : "post-call"/)
  assert.match(handleStartRecording, /getAuthenticatedRoutePath\(\{ callId: call\.id, kind: "call", view: "workspace" \}\)/)
  assert.match(handleRecordingChange, /const showPostCallForStoppedCall = \(callId: string\)/)
  assert.match(handleRecordingChange, /showPostCallForStoppedCall\(stoppedCallId\)/)
  assert.match(
    handleRecordingChange,
    /getAuthenticatedRoutePath\(\{ callId, kind: "call", view: "post-call" \}\)/
  )
})

test("protected deep links preserve a validated post-login destination", async () => {
  const app = await read("src/App.tsx")
  const routes = await read("src/lib/authenticated-routes.ts")

  assert.match(routes, /rawNextPath\.startsWith\("\/"\)/)
  assert.match(routes, /rawNextPath\.startsWith\("\/\/"\)/)
  assert.match(routes, /parseAuthenticatedRoute\(rawNextPath\)/)
  assert.match(app, /getSafeAuthenticatedNextPath\(window\.location\.search\)/)
  assert.match(app, /if \(authLoading \|\| authSession \|\| !isProtectedRoutePath\(window\.location\.pathname\)\) return/)
  assert.match(app, /writeAuthenticatedHistory\(`\/login\?next=\$\{encodeURIComponent\(nextPath\)\}`, "replace"\)/)
  assert.match(app, /pendingAuthenticatedPathRef\.current \|\| getSafeAuthenticatedNextPath\(window\.location\.search\) \|\| "\/app"/)
  assert.match(app, /writeAuthenticatedHistory\(nextPath, "replace"\)/)
})

test("the live coach popout is authenticated, preserves login return, and clears sensitive state without a session", async () => {
  const app = await read("src/App.tsx")
  const popout = await read("src/lib/live-coach-popout.ts")
  const routes = await import("../../src/lib/authenticated-routes.ts")
  const unauthenticatedGuardIndex = app.indexOf("if (!authSession || passwordRecoveryActive)")
  const popoutRenderIndex = app.lastIndexOf("if (isLiveCoachPopoutRoute())")

  assert.equal(routes.isProtectedRoutePath("/coach-popout"), true)
  assert.equal(routes.getSafeAuthenticatedNextPath("?next=%2Fcoach-popout"), "/coach-popout")
  assert.ok(unauthenticatedGuardIndex >= 0, "missing authenticated application guard")
  assert.ok(popoutRenderIndex > unauthenticatedGuardIndex, "live coach popout renders before authentication")
  assert.match(
    popout,
    /export function clearStoredLiveCoachPopoutState\(\)[\s\S]*liveCoachPopoutSnapshotStorageKey[\s\S]*liveCoachPopoutCommandStorageKey[\s\S]*liveCoachPopoutCommandAckStorageKey/
  )
  assert.match(app, /if \(authLoading \|\| authSession\) return[\s\S]*clearStoredLiveCoachPopoutState\(\)/)
})

test("live calls cannot leave the protected shell or switch workspaces through browser history", async () => {
  const app = await read("src/App.tsx")
  const restoreActiveCallRoute = app.slice(
    app.indexOf("const restoreActiveCallRoute ="),
    app.indexOf("const ensureAuthenticatedAppRoute =")
  )
  const routeResolverStart = app.indexOf("void resolveRecordWorkspaceId(routeResource)")
  const popstateHandler = app.slice(
    app.indexOf("const handlePopState ="),
    app.indexOf('window.addEventListener("popstate", handlePopState)')
  )
  const routeResolver = app.slice(
    routeResolverStart,
    app.indexOf("\n    lastAppliedAuthenticatedRouteRef.current = routeKey", routeResolverStart)
  )

  assert.match(popstateHandler, /isCallLiveRef\.current/)
  assert.match(popstateHandler, /window\.history\.(?:pushState|replaceState)/)
  assert.match(popstateHandler, /Stop the active call/)
  assert.match(restoreActiveCallRoute, /setActiveView\(callId \? "workspace" : "home"\)/)
  assert.match(restoreActiveCallRoute, /setAuthenticatedRouteRevision\(\(value\) => value \+ 1\)/)

  assert.match(routeResolver, /targetWorkspace/)
  assert.match(routeResolver, /isCallLiveRef\.current/)
  assert.match(routeResolver, /Stop the active call/)
  assert.ok(
    routeResolver.indexOf("isCallLiveRef.current") < routeResolver.indexOf("setActiveWorkspaceId(targetWorkspace.id)"),
    "cross-workspace route changed workspace before applying the live-call guard"
  )
})

test("workspace and entity route restoration fails closed and repairs a stale local cache once", async () => {
  const app = await read("src/App.tsx")
  const routeEffect = app.slice(
    app.indexOf("React.useLayoutEffect(() => {", app.indexOf("const handleAccountTabChange")),
    app.indexOf("const handleOpenCreateOpportunity")
  )

  assert.match(routeEffect, /route\.kind !== "view" && canonicalRoutePath !== locationPath[\s\S]*writeAuthenticatedHistory\(canonicalRoutePath, "replace"\)/)
  assert.match(routeEffect, /requestedWorkspaceId && !targetWorkspace[\s\S]*setAuthenticatedRouteError\(protectedRouteUnavailableMessage\)[\s\S]*return/)
  assert.ok(
    routeEffect.indexOf("requestedWorkspaceId && !targetWorkspace") < routeEffect.indexOf("canonicalViewRoutePath"),
    "an inaccessible workspace route was silently rewritten to the active workspace"
  )
  assert.match(routeEffect, /workspaceId === activeWorkspaceId[\s\S]*authenticatedRouteRefreshKeyRef\.current !== routeKey/)
  assert.match(routeEffect, /authenticatedRouteRefreshKeyRef\.current = routeKey[\s\S]*authenticatedRouteLookupKeyRef\.current = ""[\s\S]*setWorkspaceRefreshToken/)
})

test("authenticated routes set meaningful browser and bookmark titles", async () => {
  const app = await read("src/App.tsx")
  const titleAssignmentIndex = app.indexOf("document.title =")
  const titleContext = app.slice(Math.max(0, titleAssignmentIndex - 1_500), titleAssignmentIndex + 1_500)

  assert.ok(titleAssignmentIndex >= 0, "authenticated application never updates document.title")
  assert.match(titleContext, /SalesFrame/)
  assert.match(titleContext, /activeView/)
  assert.match(titleContext, /activeAccount/)
  assert.match(titleContext, /activeOpportunity/)
  assert.match(app, /document\.title = "Sign in · SalesFrame"/)
  assert.match(app, /document\.title = "Reset password · SalesFrame"/)
  assert.match(app, /document\.title = "Page unavailable · SalesFrame"/)
})

test("account and opportunity tabs are controlled by their authenticated routes", async () => {
  const app = await read("src/App.tsx")

  assert.match(app, /const handleAccountTabChange = React\.useCallback/)
  assert.match(app, /getAuthenticatedRoutePath\(\{ accountId, kind: "account", tab, view: "account-detail" \}\)/)
  assert.match(app, /setAccountTab: handleAccountTabChange/)
  assert.match(app, /activeView === "opportunity-contacts"[\s\S]*\? "contacts"/)
  assert.match(app, /activeView === "opportunity-history"[\s\S]*\? "history"/)
  assert.match(app, /<Tabs[\s\S]*value=\{defaultTab\}[\s\S]*value === "contacts"[\s\S]*"opportunity-contacts"[\s\S]*value === "history"[\s\S]*"opportunity-history"/)
})

test("settings detail routes expose only their matching settings page", async () => {
  const app = await read("src/App.tsx")

  assert.match(app, /activeView === "capture"[\s\S]*\? "Audio capture"/)
  assert.match(app, /id="settings-ai" className=\{cn\(activeView !== "settings" && activeView !== "ai" && "hidden"\)\}/)
  assert.match(app, /id="settings-retention" className=\{cn\(activeView !== "settings" && activeView !== "retention" && "hidden"\)\}/)
  assert.match(app, /id="settings-capture" className=\{cn\(activeView !== "settings" && activeView !== "capture" && "hidden"\)\}/)
})

test("Netlify preserves public prerenders while serving and de-indexing protected SPA routes", async () => {
  const netlifyConfig = await read("netlify.toml")
  const main = await read("src/main.tsx")
  const publicRoutes = await read("src/lib/public-marketing-routes.ts")
  const routes = await read("src/lib/authenticated-routes.ts")

  const headerBlocks = getTomlArrayBlocks(netlifyConfig, "headers")
  const redirectBlocks = getTomlArrayBlocks(netlifyConfig, "redirects")

  for (const path of [
    "/app",
    "/app/*",
    "/accounts",
    "/accounts/*",
    "/opportunities",
    "/opportunities/*",
    "/calls",
    "/calls/*",
    "/settings",
    "/settings/*",
    "/profile",
    "/profile/*",
    "/support",
    "/support/*",
    "/roadmap",
    "/roadmap/*",
    "/billing",
    "/billing/*",
    "/coach-popout",
    "/coach-popout/*",
  ]) {
    const block = getTomlBlockForValue(headerBlocks, "for", path)
    assert.ok(block, `missing Netlify header block for ${path}`)
    assert.match(block, /^\s*X-Robots-Tag = "noindex, nofollow"\s*$/m, `${path} is not de-indexed in its own header block`)
  }

  const fallbackBlock = getTomlBlockForValue(redirectBlocks, "from", "/*")
  assert.ok(fallbackBlock, "missing Netlify SPA fallback")
  assert.match(fallbackBlock, /^\s*to = "\/index\.html"\s*$/m)
  assert.match(fallbackBlock, /^\s*status = 200\s*$/m)
  assert.doesNotMatch(fallbackBlock, /^\s*force = true\s*$/m)
  assert.ok(netlifyConfig.indexOf('from = "/*"') > netlifyConfig.lastIndexOf("[[headers]]"))
  assert.match(main, /normalizePublicMarketingPath\(window\.location\.pathname\)[\s\S]*if \(publicMarketingPath\)/)
  assert.match(publicRoutes, /href: "\/playbooks"/)
  assert.match(routes, /"\/app\/playbooks": "playbooks"/)
  assert.doesNotMatch(routes, /"\/playbooks": "playbooks"/)
})
