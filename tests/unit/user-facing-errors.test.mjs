import assert from "node:assert/strict"
import { test } from "node:test"

import { isWorkspaceSessionExpiredError } from "../../src/lib/user-facing-errors.ts"

test("workspace expiry classification accepts only explicit expiry evidence", () => {
  assert.equal(isWorkspaceSessionExpiredError({ code: "workspace_session_expired" }), true)
  assert.equal(isWorkspaceSessionExpiredError({ code: "session_expired" }), true)
  assert.equal(isWorkspaceSessionExpiredError({ code: "refresh_token_not_found" }), true)
  assert.equal(isWorkspaceSessionExpiredError(new Error("JWT expired")), true)
  assert.equal(isWorkspaceSessionExpiredError(new Error("Refresh token expired")), true)
  assert.equal(isWorkspaceSessionExpiredError(new Error("workspace_session_expired")), true)
  assert.equal(
    isWorkspaceSessionExpiredError(new Error("We signed you out to keep your workspace safe.")),
    true
  )
  assert.equal(
    isWorkspaceSessionExpiredError(new Error("Your session has expired. Sign in again to continue.")),
    true
  )
})

test("workspace expiry classification ignores transient and technical failures", () => {
  assert.equal(isWorkspaceSessionExpiredError(null), false)
  assert.equal(isWorkspaceSessionExpiredError(new Error()), false)
  assert.equal(isWorkspaceSessionExpiredError(new Error("Failed to fetch")), false)
  assert.equal(isWorkspaceSessionExpiredError(new Error("Session check timed out")), false)
  assert.equal(isWorkspaceSessionExpiredError(new Error("Internal server error")), false)
  assert.equal(isWorkspaceSessionExpiredError({ code: "server_error" }), false)
})
