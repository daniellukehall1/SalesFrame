import assert from "node:assert/strict"
import test from "node:test"

import {
  getAuthenticatedPathForState,
  getAuthenticatedRoutePath,
  getRouteResource,
  getRouteWorkspaceId,
  getSafeAuthenticatedNextPath,
  isAuthenticatedAppPath,
  isProtectedRoutePath,
  parseAuthenticatedRoute,
} from "../src/lib/authenticated-routes.ts"

const routeCases = [
  ["/app", { kind: "view", view: "home" }],
  ["/opportunities", { kind: "view", view: "opportunities" }],
  ["/calls", { kind: "view", view: "calls" }],
  ["/coach-popout", { kind: "view", view: "coach-popout" }],
  ["/accounts/account-1", { accountId: "account-1", kind: "account", tab: "record", view: "account-detail" }],
  ["/accounts/account-1/contacts", { accountId: "account-1", kind: "account", tab: "contacts", view: "account-detail" }],
  ["/accounts/account-1/opportunities", { accountId: "account-1", kind: "account", tab: "opportunities", view: "account-detail" }],
  ["/accounts/account-1/intelligence", { accountId: "account-1", kind: "account", tab: "intelligence", view: "account-detail" }],
  ["/opportunities/opportunity-1", { kind: "opportunity", opportunityId: "opportunity-1", view: "opportunity-record" }],
  ["/opportunities/opportunity-1/contacts", { kind: "opportunity", opportunityId: "opportunity-1", view: "opportunity-contacts" }],
  ["/opportunities/opportunity-1/next-call", { kind: "opportunity", opportunityId: "opportunity-1", view: "opportunity-intelligence" }],
  ["/opportunities/opportunity-1/methodology", { kind: "opportunity", opportunityId: "opportunity-1", view: "methodology" }],
  ["/opportunities/opportunity-1/history", { kind: "opportunity", opportunityId: "opportunity-1", view: "opportunity-history" }],
  ["/opportunities/opportunity-1/cockpit", { kind: "opportunity", opportunityId: "opportunity-1", view: "workspace" }],
  ["/calls/call-1", { callId: "call-1", kind: "call", view: "post-call" }],
  ["/calls/call-1/cockpit", { callId: "call-1", kind: "call", view: "workspace" }],
  ["/settings", { kind: "view", view: "settings" }],
  ["/settings/capture", { kind: "view", view: "capture" }],
  ["/settings/retention", { kind: "view", view: "retention" }],
  ["/settings/ai", { kind: "view", view: "ai" }],
  ["/profile", { kind: "view", view: "profile-account" }],
  ["/app/playbooks/meddicc", { kind: "view", view: "meddicc" }],
]

test("authenticated routes parse and serialize canonically", () => {
  for (const [path, expectedRoute] of routeCases) {
    assert.deepEqual(parseAuthenticatedRoute(path), expectedRoute)
    assert.equal(getAuthenticatedRoutePath(expectedRoute), path)
    assert.deepEqual(parseAuthenticatedRoute(`${path}/`), expectedRoute)
  }
})

test("legacy opportunity intelligence links normalize to the canonical Next call route", () => {
  const legacyRoute = parseAuthenticatedRoute("/opportunities/opportunity-1/intelligence")

  assert.deepEqual(legacyRoute, {
    kind: "opportunity",
    opportunityId: "opportunity-1",
    view: "opportunity-intelligence",
  })
  assert.equal(getAuthenticatedRoutePath(legacyRoute), "/opportunities/opportunity-1/next-call")
})

test("authenticated routes reject public, malformed, and unknown paths", () => {
  for (const path of [
    "/",
    "/login",
    "/signup",
    "/terms",
    "/privacy",
    "/playbooks",
    "/playbooks/meddicc",
    "/accounts",
    "/accounts/%E0%A4%A",
    "/accounts/.",
    "/accounts/..",
    "/accounts/account%2Fchild",
    "/accounts/%20account-1",
    "/accounts/account%20with%20spaces",
    "/accounts/account-1/unknown",
    "/opportunities/opportunity-1/unknown",
    "/calls/call-1/extra",
    "/app/playbooks/unknown",
  ]) {
    assert.equal(parseAuthenticatedRoute(path), null, path)
    assert.equal(isAuthenticatedAppPath(path), false, path)
  }
})

test("route state builds entity paths without relying on asynchronous React state", () => {
  assert.equal(
    getAuthenticatedPathForState({
      accountId: "account-1",
      accountTab: "contacts",
      activeView: "account-detail",
    }),
    "/accounts/account-1/contacts"
  )
  assert.equal(
    getAuthenticatedPathForState({ activeView: "opportunity-contacts", opportunityId: "opportunity-1" }),
    "/opportunities/opportunity-1/contacts"
  )
  assert.equal(
    getAuthenticatedPathForState({ activeView: "opportunity-intelligence", opportunityId: "opportunity-1" }),
    "/opportunities/opportunity-1/next-call"
  )
  assert.equal(
    getAuthenticatedPathForState({ activeView: "post-call", callId: "call-1", opportunityId: "opportunity-1" }),
    "/calls/call-1"
  )
  assert.equal(
    getAuthenticatedPathForState({ activeView: "workspace", callId: "call-1", opportunityId: "opportunity-1" }),
    "/calls/call-1/cockpit"
  )
  assert.equal(
    getAuthenticatedPathForState({ activeView: "opportunities", workspaceId: "workspace-1" }),
    "/opportunities?workspace=workspace-1"
  )
})

test("workspace-level views preserve a validated workspace query", () => {
  for (const [path, expectedRoute] of [
    ["/app?workspace=workspace-1", { kind: "view", view: "home", workspaceId: "workspace-1" }],
    ["/opportunities?workspace=workspace-1", { kind: "view", view: "opportunities", workspaceId: "workspace-1" }],
    ["/calls?workspace=workspace-1", { kind: "view", view: "calls", workspaceId: "workspace-1" }],
    ["/app/playbooks/meddicc?workspace=workspace-1", { kind: "view", view: "meddicc", workspaceId: "workspace-1" }],
    ["/settings/capture?workspace=workspace-1", { kind: "view", view: "capture", workspaceId: "workspace-1" }],
    ["/billing?workspace=workspace-1", { kind: "view", view: "billing", workspaceId: "workspace-1" }],
  ]) {
    assert.deepEqual(parseAuthenticatedRoute(path), expectedRoute)
    assert.equal(getAuthenticatedRoutePath(expectedRoute), path)
    assert.equal(getRouteWorkspaceId(expectedRoute), "workspace-1")
  }

  assert.deepEqual(parseAuthenticatedRoute("/app?workspace=bad%20workspace"), { kind: "view", view: "home" })
  assert.equal(
    getAuthenticatedRoutePath({ kind: "view", view: "home", workspaceId: "bad workspace" }),
    "/app"
  )
  assert.deepEqual(parseAuthenticatedRoute("/profile?workspace=workspace-1"), { kind: "view", view: "profile-account" })
  assert.equal(getRouteWorkspaceId(parseAuthenticatedRoute("/profile?workspace=workspace-1")), null)
})

test("entity routes stay clean when a workspace query is present", () => {
  for (const [path, expectedPath] of [
    ["/accounts/account-1?workspace=workspace-1", "/accounts/account-1"],
    ["/opportunities/opportunity-1/contacts?workspace=workspace-1", "/opportunities/opportunity-1/contacts"],
    ["/calls/call-1?workspace=workspace-1", "/calls/call-1"],
  ]) {
    const route = parseAuthenticatedRoute(path)
    assert.ok(route)
    assert.equal(getAuthenticatedRoutePath(route), expectedPath)
    assert.equal(getRouteWorkspaceId(route), null)
  }
})

test("safe post-auth destinations accept only known same-origin app paths", () => {
  assert.equal(getSafeAuthenticatedNextPath("?next=%2Fsettings%2Fcapture"), "/settings/capture")
  assert.equal(
    getSafeAuthenticatedNextPath("?next=%2Fsettings%2Fcapture%3Fworkspace%3Dworkspace-1"),
    "/settings/capture?workspace=workspace-1"
  )
  assert.equal(
    getSafeAuthenticatedNextPath("?next=%2Fsettings%2Fcapture%3Fworkspace%3Dbad%2520workspace"),
    "/settings/capture"
  )
  assert.equal(getSafeAuthenticatedNextPath("?next=https%3A%2F%2Fevil.example"), null)
  assert.equal(getSafeAuthenticatedNextPath("?next=%2F%2Fevil.example"), null)
  assert.equal(getSafeAuthenticatedNextPath("?next=%2Fplaybooks%2Fmeddicc"), null)
})

test("protected namespaces remain guarded even when a deep link is malformed", () => {
  for (const path of ["/accounts", "/accounts/a/unknown", "/opportunities/o/unknown", "/calls/c/extra", "/settings/unknown", "/app/unknown", "/coach-popout/extra"]) {
    assert.equal(parseAuthenticatedRoute(path), null)
    assert.equal(isProtectedRoutePath(path), true)
  }
  assert.equal(isProtectedRoutePath("/playbooks/meddicc"), false)
  assert.equal(isProtectedRoutePath("/coach-popout"), true)
  assert.equal(isProtectedRoutePath("/coach-popout/"), true)
})

test("entity routes expose the record used to resolve the correct workspace", () => {
  assert.deepEqual(getRouteResource(parseAuthenticatedRoute("/accounts/a")), { id: "a", type: "account" })
  assert.deepEqual(getRouteResource(parseAuthenticatedRoute("/opportunities/o")), { id: "o", type: "opportunity" })
  assert.deepEqual(getRouteResource(parseAuthenticatedRoute("/calls/c")), { id: "c", type: "call" })
  assert.equal(getRouteResource(parseAuthenticatedRoute("/settings")), null)
})
