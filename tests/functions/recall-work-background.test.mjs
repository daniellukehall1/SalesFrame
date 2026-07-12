import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  createRecallWorkDispatch,
  dispatchRecallWork,
  verifyRecallWorkDispatch,
} from "../../netlify/functions/_shared/recall-work-dispatch.ts"

const secret = "recall-work-test-secret-with-more-than-thirty-two-characters"

test("scheduled and webhook functions dispatch bounded background work", async () => {
  const [scheduled, webhook, createApi, background] = await Promise.all([
    readFile(new URL("../../netlify/functions/recall-recovery.ts", import.meta.url), "utf8"),
    readFile(new URL("../../netlify/functions/_shared/recall-webhook.ts", import.meta.url), "utf8"),
    readFile(new URL("../../netlify/functions/meeting-bots.ts", import.meta.url), "utf8"),
    readFile(new URL("../../netlify/functions/recall-work-background.ts", import.meta.url), "utf8"),
  ])

  assert.match(scheduled, /dispatchRecallWork\(\{ kind: "scheduled_sweep" \}\)/)
  assert.doesNotMatch(scheduled, /processDueMeetingBotProvisioning|processMeetingBotWebhookEvent|recoverMeetingBotSessions/)
  assert.match(webhook, /dispatchRecallWork\(\{/)
  assert.doesNotMatch(webhook, /processMeetingBotWebhookEvent/)
  assert.match(createApi, /kind: "provision_session"/)
  assert.doesNotMatch(createApi, /runMeetingBotProvisioningWindow/)
  assert.match(background, /processDueMeetingBotProvisioning\(\{ limit: 25/)
  assert.match(background, /recoverMeetingBotSessions\(\{ limit: 25/)
  assert.match(background, /Buffer\.byteLength\(rawBody\) > 1_024/)
})

test("Recall work dispatch is tamper evident and stays on the active deploy", async () => {
  const previous = {
    DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
    MEETING_BOT_CRYPTO_SECRET: process.env.MEETING_BOT_CRYPTO_SECRET,
    URL: process.env.URL,
  }
  process.env.MEETING_BOT_CRYPTO_SECRET = secret
  process.env.DEPLOY_PRIME_URL = "https://deploy-preview-42--salesframe.netlify.app"
  process.env.URL = "https://salesframe.ai"

  try {
    const dispatch = createRecallWorkDispatch({ kind: "scheduled_sweep" }, 4_000)
    assert.equal(
      verifyRecallWorkDispatch({
        nowSeconds: 4_100,
        payload: dispatch.payload,
        signature: dispatch.signature,
      }).kind,
      "scheduled_sweep"
    )
    assert.throws(
      () => verifyRecallWorkDispatch({
        nowSeconds: 4_100,
        payload: { ...dispatch.payload, kind: "webhook_event", region: "us-west-2", webhookId: "changed" },
        signature: dispatch.signature,
      }),
      (error) => error?.code === "recall_work_unverified"
    )

    let dispatchedUrl = ""
    await dispatchRecallWork({ kind: "scheduled_sweep" }, {
      nowSeconds: 4_000,
      fetcher: async (url) => {
        dispatchedUrl = String(url)
        return new Response(null, { status: 202 })
      },
    })
    assert.equal(
      dispatchedUrl,
      "https://deploy-preview-42--salesframe.netlify.app/api/internal/recall-work"
    )
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})
