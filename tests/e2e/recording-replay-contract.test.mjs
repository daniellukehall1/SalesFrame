import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const root = new URL("../../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

test("recording lifecycle fields are persisted on calls", async () => {
  const migration = await read("supabase/migrations/202607050002_recording_lifecycle.sql")
  const databaseTypes = await read("src/lib/supabase/database.types.ts")
  const core = await read("src/lib/salesframe-core.ts")
  const adapters = await read("src/lib/supabase/salesframe-adapters.tsx")

  for (const field of [
    "recording_status",
    "recording_mime_type",
    "recording_size_bytes",
    "recording_ready_at",
    "recording_error",
  ]) {
    assert.match(migration, new RegExp(field))
    assert.match(databaseTypes, new RegExp(field))
  }

  assert.match(migration, /recording_status in \('none', 'recording', 'uploading', 'processing', 'ready', 'failed'\)/)
  assert.match(core, /export const recordingLifecycleStatuses = \["none", "recording", "uploading", "processing", "ready", "failed"\] as const/)
  assert.match(core, /recordingStatus: RecordingLifecycleStatus/)
  assert.match(adapters, /recordingStatus: normalizeRecordingLifecycleStatus/)
  assert.match(adapters, /recordingMimeType: call\.recording_mime_type/)
  assert.match(adapters, /recordingSizeBytes: call\.recording_size_bytes/)
})

test("call capture records a mixed browser-playable replay stream", async () => {
  const capture = await read("src/hooks/use-call-capture.ts")

  assert.match(capture, /function createRecordingStream\(sources: CapturedAudioSource\[\]\): RecordingStreamBundle/)
  assert.match(capture, /createMediaStreamDestination\(\)/)
  assert.match(capture, /createMediaStreamSource\(stream\)/)
  assert.match(capture, /sourceNode\.connect\(gainNode\)/)
  assert.match(capture, /gainNode\.connect\(destination\)/)
  assert.match(capture, /recorder\.start\(1000\)/)
  assert.match(capture, /recorder\.requestData\(\)/)
  assert.match(capture, /"audio\/mp4"[\s\S]*"audio\/webm;codecs=opus"[\s\S]*"audio\/webm"/)
  assert.match(capture, /isRecordableAndPlayableMimeType/)
  assert.match(capture, /MediaRecorder\.isTypeSupported\(mimeType\)/)
  assert.match(capture, /audio\.canPlayType\(mimeType\)/)
})

test("recording upload validates blobs and stores readiness metadata", async () => {
  const data = await read("src/lib/supabase/salesframe-data.ts")
  const capture = await read("src/hooks/use-call-capture.ts")

  assert.match(data, /if \(sizeBytes <= 0\)/)
  assert.match(data, /recording_status: "failed"/)
  assert.match(data, /recording_mime_type: contentType/)
  assert.match(data, /recording_size_bytes: sizeBytes/)
  assert.match(data, /recording_status: "processing"/)
  assert.match(data, /recording_storage_path: path/)
  assert.match(capture, /recording_status: "uploading"/)
  assert.match(capture, /recording_status: "ready"/)
  assert.match(capture, /recording_ready_at: recordingReadyAt/)
  assert.match(capture, /recordingStatus = "failed"/)
})

test("post-call recording card exposes download-only recovery actions", async () => {
  const app = await read("src/App.tsx")
  const replayCard = app.slice(
    app.indexOf("function CallReplayCard("),
    app.indexOf("async function downloadCallAudioFile(")
  )

  assert.match(app, /async function downloadCallAudioFile\(call: CallSummary\)/)
  assert.match(replayCard, /Download audio/)
  assert.match(replayCard, /Download transcript/)
  assert.match(replayCard, /Delete call/)
  assert.match(app, /fetch\(recordingUrl\)/)
  assert.match(app, /response\.blob\(\)/)
  assert.match(app, /URL\.createObjectURL\(blob\)/)
  assert.match(app, /link\.download = getRecordingDownloadFileName\(call\)/)
  assert.match(app, /URL\.revokeObjectURL\(objectUrl\)/)
  assert.doesNotMatch(app, /function CallReplayContent/)
  assert.doesNotMatch(app, /waitForRecordingPlaybackReadiness/)
  assert.doesNotMatch(app, /getAudioPlaybackErrorMessage/)
  assert.doesNotMatch(app, /aria-label=\{isReplayPlaying \? "Pause recording" : "Play recording"\}/)
  assert.doesNotMatch(app, /data-testid="recording-replay-timeline"/)
  assert.doesNotMatch(app, /Recording volume/)
  assert.doesNotMatch(app, /Call notes/)
  assert.doesNotMatch(app, /Replay ready/)
  assert.doesNotMatch(app, /Open recording/)
})
