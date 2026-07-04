import type { CallAudioCaptureMode, TranscriptSpeaker } from "@/lib/salesframe-core"

export type AudioSourceKind = "meeting_audio" | "seller_mic" | "mixed_audio" | "in_person_microphone"

export type CapturedAudioSource = {
  confidence: number
  kind: AudioSourceKind
  level: number
  note?: string
  surface?: string
  speakerHint: TranscriptSpeaker
  stream: MediaStream
}

export type AudioPreflightSource = {
  confidence: number
  hasAudioTrack: boolean
  kind: AudioSourceKind
  level: number
  surface?: string
  speakerHint: TranscriptSpeaker
}

export type AudioPreflightResult = {
  mode: CallAudioCaptureMode
  ok: boolean
  statusMessage: string
  requiredCustomerAudio: boolean
  requiredSellerMic: boolean
  sellerMicReady: boolean
  customerAudioReady: boolean
  mixedRoomReady: boolean
  sources: AudioPreflightSource[]
  warnings: string[]
  checkedAt: string
}

const preflightSampleMs = 1200
const preflightPollMs = 80
const preflightVoiceThreshold = 0.018

export async function runAudioPreflight(mode: CallAudioCaptureMode) {
  const sources = await requestAudioSources(mode)
  const measuredSources = await Promise.all(
    sources.map(async (source) => ({
      ...source,
      level: await measureStreamVoiceLevel(source.stream),
    }))
  )
  const result = createAudioPreflightResult(mode, measuredSources)

  if (!result.ok) {
    measuredSources.forEach((source) => {
      source.stream.getTracks().forEach((track) => track.stop())
    })

    throw new Error(getAudioPreflightFailureMessage(result))
  }

  return {
    preflight: result,
    sources: measuredSources,
  }
}

export function summarizeAudioSource(source: CapturedAudioSource): AudioPreflightSource {
  return {
    confidence: source.confidence,
    hasAudioTrack: source.stream.getAudioTracks().length > 0,
    kind: source.kind,
    level: source.level,
    surface: source.surface,
    speakerHint: source.speakerHint,
  }
}

function createAudioPreflightResult(
  mode: CallAudioCaptureMode,
  sources: CapturedAudioSource[]
): AudioPreflightResult {
  const sellerSources = sources.filter((source) =>
    source.kind === "seller_mic" || source.kind === "mixed_audio" || source.kind === "in_person_microphone"
  )
  const meetingSources = sources.filter((source) => source.kind === "meeting_audio")
  const mixedSources = sources.filter((source) => source.kind === "mixed_audio" || source.kind === "in_person_microphone")
  const sellerMicReady = sellerSources.some((source) => source.stream.getAudioTracks().length > 0)
  const customerAudioTrackReady = meetingSources.some((source) => source.stream.getAudioTracks().length > 0)
  const customerAudioReady = customerAudioTrackReady
  const mixedRoomReady = mixedSources.some((source) => source.stream.getAudioTracks().length > 0)
  const requiredCustomerAudio = mode === "meeting_audio"
  const ok =
    sellerMicReady &&
    (!requiredCustomerAudio || customerAudioReady) &&
    (mode !== "in_person_microphone" || mixedRoomReady)
  const warnings: string[] = []

  if (mode === "microphone") {
    warnings.push("Microphone-only mode can miss the buyer if their audio is playing through headphones or another device.")
  }
  if (mode === "in_person_microphone") {
    warnings.push("In-person mode uses mixed room audio, so speaker labels are lower confidence and remain editable.")
  }
  if (mode === "meeting_audio" && customerAudioTrackReady) {
    const hasVoiceDuringPreflight = meetingSources.some((source) => source.level >= preflightVoiceThreshold)

    if (!hasVoiceDuringPreflight) {
      warnings.push(
        "Customer audio is connected, but no customer-side speech was detected during preflight. Keep the Zoom, Teams, Meet, or tab audio active if buyer transcript does not appear."
      )
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    customerAudioReady,
    mixedRoomReady,
    mode,
    ok,
    requiredCustomerAudio,
    requiredSellerMic: true,
    sellerMicReady,
    sources: sources.map(summarizeAudioSource),
    statusMessage: getAudioPreflightStatusMessage({
      customerAudioReady,
      mode,
      mixedRoomReady,
      sellerMicReady,
    }),
    warnings,
  }
}

function getAudioPreflightStatusMessage({
  customerAudioReady,
  mixedRoomReady,
  mode,
  sellerMicReady,
}: {
  customerAudioReady: boolean
  mixedRoomReady: boolean
  mode: CallAudioCaptureMode
  sellerMicReady: boolean
}) {
  if (mode === "meeting_audio") {
    return customerAudioReady
      ? "Customer audio detected: start call."
      : "Native app audio is not available through this browser. Use browser-based Zoom/Teams/Meet, in-person mic mode, or install SalesFrame Audio Connector."
  }
  if (mode === "in_person_microphone") {
    return mixedRoomReady
      ? "Room microphone detected: start call."
      : "Room microphone audio was not detected. Keep the browser open, allow microphone access, and try again."
  }

  return sellerMicReady
    ? "Microphone detected: start call."
    : "Microphone audio was not detected. Allow microphone access and try again."
}

function getAudioPreflightFailureMessage(preflight: AudioPreflightResult) {
  if (preflight.mode === "meeting_audio" && !preflight.customerAudioReady) {
    return "Native app audio is not available through this browser. Use browser-based Zoom/Teams/Meet, in-person mic mode, or install SalesFrame Audio Connector."
  }
  if (!preflight.sellerMicReady) {
    return "SalesFrame needs access to your microphone before the call can start."
  }
  if (preflight.mode === "in_person_microphone" && !preflight.mixedRoomReady) {
    return "SalesFrame cannot hear the room audio. Keep the browser open, allow microphone access, and try again."
  }

  return "SalesFrame needs one more audio check before the call can start."
}

async function requestAudioSources(mode: CallAudioCaptureMode): Promise<CapturedAudioSource[]> {
  const mediaDevices = navigator.mediaDevices
  if (!mediaDevices) {
    throw new Error("Audio capture is not available in this browser.")
  }

  const sources: CapturedAudioSource[] = []

  if (mode === "meeting_audio") {
    if (!("getDisplayMedia" in mediaDevices)) {
      throw new Error(
        "Native app audio is not available through this browser. Use browser-based Zoom/Teams/Meet, in-person mic mode, or install SalesFrame Audio Connector."
      )
    }

    try {
      const displayStream = await mediaDevices.getDisplayMedia(getMeetingAudioDisplayOptions())
      const displaySurface = displayStream.getVideoTracks()[0]?.getSettings?.().displaySurface

      if (displayStream.getAudioTracks().length > 0) {
        sources.push({
          confidence: displaySurface === "browser" ? 0.9 : 0.84,
          kind: "meeting_audio",
          level: 0,
          note:
            "Customer-side audio captured from the shared browser tab, app window, or system audio. SalesFrame uses only the audio track for transcript and recording.",
          surface: displaySurface,
          speakerHint: "Customer",
          stream: displayStream,
        })
      } else {
        displayStream.getTracks().forEach((track) => track.stop())
        throw new Error(
          "SalesFrame cannot hear customer audio from that share. Choose a browser tab or Entire Screen with Share audio/System audio turned on, or switch to in-person microphone mode."
        )
      }
    } catch (caughtError: unknown) {
      stopCapturedSources(sources)
      if (caughtError instanceof Error && caughtError.message.includes("SalesFrame cannot hear customer audio")) {
        throw caughtError
      }
      if (isDisplayCapturePermissionError(caughtError)) {
        throw new Error(
          "SalesFrame needs customer-side audio before this call can start. Share a meeting tab or Entire Screen with Share audio/System audio turned on, or switch to in-person microphone mode."
        )
      }

      throw new Error(
        "Native app audio is not available through this browser. Use browser-based Zoom/Teams/Meet, in-person mic mode, or install SalesFrame Audio Connector."
      )
    }
  }

  if (!mediaDevices.getUserMedia) {
    if (sources.length > 0) return sources
    throw new Error("Microphone capture is not available in this browser.")
  }

  try {
    const hasMeetingAudio = sources.some((source) => source.kind === "meeting_audio")
    const microphoneStream = await mediaDevices.getUserMedia({
      audio: getMicrophoneAudioConstraints({
        hasMeetingAudio,
        mode,
      }),
    })
    const isInPersonMicrophone = mode === "in_person_microphone" && sources.length === 0
    const microphoneSourceKind: AudioSourceKind = sources.length > 0
      ? "seller_mic"
      : isInPersonMicrophone
        ? "in_person_microphone"
        : "mixed_audio"
    const microphoneSpeakerHint: TranscriptSpeaker = microphoneSourceKind === "seller_mic" ? "Seller" : "Unknown"

    sources.push({
      confidence: sources.length > 0 ? 0.94 : isInPersonMicrophone ? 0.58 : 0.66,
      kind: microphoneSourceKind,
      level: 0,
      note:
        sources.length > 0
          ? "Seller microphone captured separately for seller-side attribution."
          : isInPersonMicrophone
            ? "In-person microphone capture is listening through this device. Keep the browser open and the phone awake; speaker labels use AI attribution and low-confidence labels stay editable."
            : "Only microphone audio is available. SalesFrame will listen for both seller and buyer speech from this mic; speaker labels use AI attribution and low-confidence labels stay editable.",
      speakerHint: microphoneSpeakerHint,
      stream: microphoneStream,
    })
  } catch (caughtError: unknown) {
    if (mode === "meeting_audio") {
      stopCapturedSources(sources)
      throw new Error("SalesFrame can hear customer audio, but still needs your microphone before the call can start.")
    }

    throw caughtError
  }

  if (sources.length === 0) {
    throw new Error("No audio source was available for this call.")
  }

  return sources
}

function stopCapturedSources(sources: CapturedAudioSource[]) {
  sources.forEach((source) => {
    source.stream.getTracks().forEach((track) => track.stop())
  })
}

function isDisplayCapturePermissionError(error: unknown) {
  return (
    error instanceof DOMException &&
    ["AbortError", "NotAllowedError", "PermissionDeniedError"].includes(error.name)
  )
}

function getMeetingAudioDisplayOptions(): DisplayMediaStreamOptions {
  return {
    audio: getSupportedAudioConstraints({
      autoGainControl: false,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: true,
      sampleRate: 48000,
      sampleSize: 16,
    }),
    video: true,
    monitorTypeSurfaces: "include",
    preferCurrentTab: false,
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
    systemAudio: "include",
    windowAudio: "system",
  } as DisplayMediaStreamOptions
}

function getMicrophoneAudioConstraints({
  hasMeetingAudio,
  mode,
}: {
  hasMeetingAudio: boolean
  mode: CallAudioCaptureMode
}): MediaTrackConstraints {
  const isDedicatedSellerMic = hasMeetingAudio
  const shouldUseEchoCancellation = isDedicatedSellerMic || mode === "microphone"

  return getSupportedAudioConstraints({
    autoGainControl: false,
    channelCount: 1,
    echoCancellation: shouldUseEchoCancellation,
    latency: mode === "in_person_microphone" ? 0.08 : 0.06,
    noiseSuppression: true,
    sampleRate: 48000,
    sampleSize: 16,
  })
}

function getSupportedAudioConstraints(
  constraints: Record<string, boolean | number>
): MediaTrackConstraints {
  const supportedConstraints = navigator.mediaDevices?.getSupportedConstraints?.() ?? {}

  return Object.fromEntries(
    Object.entries(constraints).filter(([key]) => supportedConstraints[key as keyof MediaTrackSupportedConstraints])
  ) as MediaTrackConstraints
}

async function measureStreamVoiceLevel(stream: MediaStream) {
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextCtor || stream.getAudioTracks().length === 0) return 0

  const audioContext = new AudioContextCtor()
  if (audioContext.state === "suspended") {
    await audioContext.resume().catch(() => undefined)
  }

  const sourceNode = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 1024
  sourceNode.connect(analyser)

  const samples = new Uint8Array(analyser.fftSize)
  let maxLevel = 0
  const startedAt = Date.now()

  await new Promise<void>((resolve) => {
    const timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples)
      maxLevel = Math.max(maxLevel, calculateAudioRms(samples))
      if (Date.now() - startedAt >= preflightSampleMs) {
        window.clearInterval(timer)
        resolve()
      }
    }, preflightPollMs)
  })

  try {
    sourceNode.disconnect()
    analyser.disconnect()
    await audioContext.close()
  } catch {
    // The stream can be closed by browser permissions while preflight exits.
  }

  return Number(maxLevel.toFixed(4))
}

export function calculateAudioRms(samples: Uint8Array) {
  const sumSquares = samples.reduce((sum, sample) => {
    const centeredSample = (sample - 128) / 128

    return sum + centeredSample * centeredSample
  }, 0)

  return Math.sqrt(sumSquares / samples.length)
}
