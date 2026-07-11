import assert from "node:assert/strict"
import test from "node:test"

import {
  clearStoredLiveCoachPopoutState,
  liveCoachPopoutCommandAckStorageKey,
  liveCoachPopoutCommandStorageKey,
  liveCoachPopoutSnapshotStorageKey,
} from "../src/lib/live-coach-popout.ts"

test("sign-out cleanup removes every live coach pop-out value", () => {
  const removedKeys = []
  const previousWindow = globalThis.window
  globalThis.window = {
    localStorage: {
      removeItem(key) {
        removedKeys.push(key)
      },
    },
  }

  try {
    clearStoredLiveCoachPopoutState()
  } finally {
    globalThis.window = previousWindow
  }

  assert.deepEqual(removedKeys, [
    liveCoachPopoutSnapshotStorageKey,
    liveCoachPopoutCommandStorageKey,
    liveCoachPopoutCommandAckStorageKey,
  ])
})

test("sign-out cleanup stays safe when browser storage is unavailable", () => {
  const previousWindow = globalThis.window
  globalThis.window = {
    localStorage: {
      removeItem() {
        throw new Error("Storage unavailable")
      },
    },
  }

  try {
    assert.doesNotThrow(() => clearStoredLiveCoachPopoutState())
  } finally {
    globalThis.window = previousWindow
  }
})
