import assert from "node:assert/strict"
import { test } from "node:test"

import { getRecordingUploadRecoveryAction } from "../../src/lib/supabase/recording-upload-integrity.ts"

const uploadedPath = "workspace-1/call-1/immutable-upload.webm"

test("recording recovery accepts only the pointer to the just-uploaded immutable object", () => {
  assert.equal(
    getRecordingUploadRecoveryAction({
      pointer: { status: "found", path: uploadedPath },
      uploadedPath,
    }),
    "linked"
  )
})

test("recording recovery removes the losing immutable object when a concurrent uploader wins", () => {
  assert.equal(
    getRecordingUploadRecoveryAction({
      pointer: { status: "found", path: "workspace-1/call-1/other-upload.webm" },
      uploadedPath,
    }),
    "remove-upload"
  )
})

test("recording recovery removes the upload after the call is confirmed missing", () => {
  assert.equal(
    getRecordingUploadRecoveryAction({ pointer: { status: "call-missing" }, uploadedPath }),
    "remove-upload"
  )
})

test("recording recovery preserves uploads while a null or unreadable pointer remains ambiguous", () => {
  for (const pointer of [{ status: "read-failed" }, { status: "found", path: null }]) {
    assert.equal(
      getRecordingUploadRecoveryAction({ pointer, uploadedPath }),
      "preserve-upload"
    )
  }
})
