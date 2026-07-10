export type AudioDeviceOption = {
  deviceId: string
  isDefault: boolean
  kind: "audioinput" | "audiooutput"
  label: string
}

export type AudioDeviceInventory = {
  audioInputs: AudioDeviceOption[]
  audioOutputs: AudioDeviceOption[]
  canSelectAudioOutput: boolean
  canSetAudioSink: boolean
}

const defaultDeviceId = "default"

type SelectAudioOutputCapableMediaDevices = MediaDevices & {
  selectAudioOutput?: (options?: { deviceId?: string }) => Promise<MediaDeviceInfo>
}

type SinkSelectableAudioElement = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>
}

export function getDefaultAudioDeviceId() {
  return defaultDeviceId
}

export function getPreferredAudioInputDeviceId(currentDeviceId: string | undefined, devices: AudioDeviceOption[]) {
  if (currentDeviceId && devices.some((device) => device.deviceId === currentDeviceId)) {
    return currentDeviceId
  }

  const builtInMicrophone =
    devices.find((device) => device.deviceId !== defaultDeviceId && isLikelyBuiltInMicrophoneLabel(device.label)) ??
    devices.find((device) => isLikelyBuiltInMicrophoneLabel(device.label))

  return builtInMicrophone?.deviceId ?? devices.find((device) => device.isDefault)?.deviceId ?? devices[0]?.deviceId ?? defaultDeviceId
}

export function isLikelySafariBrowser() {
  if (typeof navigator === "undefined") return false

  const userAgent = navigator.userAgent

  return /^((?!chrome|android|crios|fxios|edg|opr).)*safari/i.test(userAgent)
}

export function getSharedAudioNoTrackMessage() {
  if (isLikelySafariBrowser()) {
    return "Safari shared the screen without audio. On macOS, use Chrome or Edge for Two channels, or switch to One channel."
  }

  return "That share did not include audio. Choose a tab or screen with Share audio/System audio turned on, or switch to One channel."
}

export function getSharedAudioUnsupportedMessage() {
  if (isLikelySafariBrowser()) {
    return "Safari cannot provide shared meeting audio here. Use Chrome or Edge for Two channels, or switch to One channel."
  }

  return "This browser cannot share meeting audio. Use One channel or try a current desktop browser."
}

export function getSharedAudioBrowserGuidance() {
  if (isLikelySafariBrowser()) {
    return "Safari may share the picture without system audio on macOS. If no shared-audio meter appears, use Chrome or Edge for Two channels, or use One channel."
  }

  return "Share a meeting tab, window, or screen with audio enabled. SalesFrame can only use audio the browser provides."
}

export function resolveConstrainedAudioDeviceId(deviceId?: string) {
  const normalizedDeviceId = deviceId?.trim()

  return normalizedDeviceId && normalizedDeviceId !== defaultDeviceId ? normalizedDeviceId : undefined
}

export function readPreferredAudioInputDeviceId(workspaceId: string) {
  return readStoredDeviceId(getAudioInputStorageKey(workspaceId))
}

export function writePreferredAudioInputDeviceId(workspaceId: string, deviceId: string) {
  writeStoredDeviceId(getAudioInputStorageKey(workspaceId), deviceId)
}

export function readPreferredAudioOutputDeviceId(workspaceId: string) {
  return readStoredDeviceId(getAudioOutputStorageKey(workspaceId))
}

export function writePreferredAudioOutputDeviceId(workspaceId: string, deviceId: string) {
  writeStoredDeviceId(getAudioOutputStorageKey(workspaceId), deviceId)
}

export async function enumerateAudioDevices(): Promise<AudioDeviceInventory> {
  const mediaDevices = navigator.mediaDevices
  const devices = mediaDevices?.enumerateDevices ? await mediaDevices.enumerateDevices() : []

  return {
    audioInputs: buildDeviceOptions(devices, "audioinput", "Microphone"),
    audioOutputs: buildDeviceOptions(devices, "audiooutput", "Speaker"),
    canSelectAudioOutput: typeof (mediaDevices as SelectAudioOutputCapableMediaDevices | undefined)?.selectAudioOutput === "function",
    canSetAudioSink: typeof document !== "undefined" && "setSinkId" in HTMLMediaElement.prototype,
  }
}

export async function selectAudioOutputDevice(currentDeviceId?: string): Promise<AudioDeviceOption | null> {
  const mediaDevices = navigator.mediaDevices as SelectAudioOutputCapableMediaDevices | undefined

  if (typeof mediaDevices?.selectAudioOutput !== "function") return null

  const selectedDevice = await mediaDevices.selectAudioOutput(
    resolveConstrainedAudioDeviceId(currentDeviceId)
      ? { deviceId: resolveConstrainedAudioDeviceId(currentDeviceId) }
      : undefined
  )

  return {
    deviceId: selectedDevice.deviceId || defaultDeviceId,
    isDefault: !selectedDevice.deviceId || selectedDevice.deviceId === defaultDeviceId,
    kind: "audiooutput",
    label: selectedDevice.label || "Selected speaker",
  }
}

export async function playAudioOutputTest(deviceId?: string) {
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextCtor) {
    throw new Error("This browser cannot play the speaker test.")
  }

  const audioContext = new AudioContextCtor()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  const destination = audioContext.createMediaStreamDestination()
  const audio = new Audio() as SinkSelectableAudioElement

  oscillator.type = "sine"
  oscillator.frequency.value = 660
  gainNode.gain.value = 0.04
  oscillator.connect(gainNode)
  gainNode.connect(destination)
  audio.srcObject = destination.stream

  const resolvedDeviceId = resolveConstrainedAudioDeviceId(deviceId)
  if (resolvedDeviceId && typeof audio.setSinkId === "function") {
    await audio.setSinkId(resolvedDeviceId)
  }

  await audio.play()
  oscillator.start()

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 650)
  })

  oscillator.stop()
  audio.pause()
  audio.srcObject = null
  destination.stream.getTracks().forEach((track) => track.stop())
  await audioContext.close().catch(() => undefined)
}

function buildDeviceOptions(
  devices: MediaDeviceInfo[],
  kind: "audioinput" | "audiooutput",
  fallbackLabel: string
): AudioDeviceOption[] {
  const matchingDevices = devices.filter((device) => device.kind === kind)
  const seenIds = new Set<string>()

  return matchingDevices
    .map((device, index) => {
      const deviceId = device.deviceId || (index === 0 ? defaultDeviceId : "")
      if (!deviceId || seenIds.has(deviceId)) return null

      seenIds.add(deviceId)

      return {
        deviceId,
        isDefault: deviceId === defaultDeviceId || index === 0,
        kind,
        label: device.label || `${fallbackLabel} ${index + 1}`,
      } satisfies AudioDeviceOption
    })
    .filter((device): device is AudioDeviceOption => Boolean(device))
}

function isLikelyBuiltInMicrophoneLabel(label: string) {
  const normalizedLabel = label.toLowerCase()

  return (
    /macbook.*microphone/.test(normalizedLabel) ||
    /built[\s-]?in.*microphone/.test(normalizedLabel) ||
    /internal.*microphone/.test(normalizedLabel)
  )
}

function getAudioInputStorageKey(workspaceId: string) {
  return `salesframe:${workspaceId}:audio-input-device`
}

function getAudioOutputStorageKey(workspaceId: string) {
  return `salesframe:${workspaceId}:audio-output-device`
}

function readStoredDeviceId(storageKey: string) {
  if (typeof window === "undefined") return defaultDeviceId

  return window.localStorage.getItem(storageKey) || defaultDeviceId
}

function writeStoredDeviceId(storageKey: string, deviceId: string) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(storageKey, deviceId || defaultDeviceId)
}
