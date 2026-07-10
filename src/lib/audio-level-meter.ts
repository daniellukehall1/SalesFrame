const minimumMeterDecibels = -60
const maximumMeterDecibels = -10
const lowSignalDecibels = -42
const highSignalDecibels = -12

export const audibleAudioLevelThreshold = 0.006

export type AudioSignalQuality = "silent" | "low" | "good" | "high"

export type AudioMeterReading = {
  decibels: number
  level: number
  meterPercent: number
  peak: number
  quality: AudioSignalQuality
}

function clampAudioLevel(level: number) {
  return Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0))
}

export function calculateAudioDecibels(level: number) {
  const normalizedLevel = clampAudioLevel(level)

  if (normalizedLevel === 0) return Number.NEGATIVE_INFINITY

  return 20 * Math.log10(normalizedLevel)
}

export function calculateAudioMeterPercent(level: number) {
  const decibels = calculateAudioDecibels(level)

  if (!Number.isFinite(decibels) || decibels <= minimumMeterDecibels) return 0
  if (decibels >= maximumMeterDecibels) return 100

  const scaled = ((decibels - minimumMeterDecibels) / (maximumMeterDecibels - minimumMeterDecibels)) * 100

  return Math.max(0, Math.min(100, Math.round(scaled)))
}

export function getAudioSignalQuality(level: number, peak = level): AudioSignalQuality {
  const decibels = calculateAudioDecibels(level)

  if (!Number.isFinite(decibels) || decibels < minimumMeterDecibels) return "silent"
  if (decibels < lowSignalDecibels) return "low"
  if (decibels >= highSignalDecibels || clampAudioLevel(peak) >= 0.98) return "high"

  return "good"
}

export function createAudioMeterReading(level: number, peak = level): AudioMeterReading {
  const normalizedLevel = clampAudioLevel(level)
  const normalizedPeak = clampAudioLevel(peak)

  return {
    decibels: calculateAudioDecibels(normalizedLevel),
    level: normalizedLevel,
    meterPercent: calculateAudioMeterPercent(normalizedLevel),
    peak: normalizedPeak,
    quality: getAudioSignalQuality(normalizedLevel, normalizedPeak),
  }
}

export function smoothAudioMeterLevel(rawLevel: number, previousLevel: number, elapsedMs = 50) {
  const nextLevel = clampAudioLevel(rawLevel)
  const currentLevel = clampAudioLevel(previousLevel)
  const normalizedElapsedMs = Math.max(1, Math.min(250, Number.isFinite(elapsedMs) ? elapsedMs : 50))
  const timeConstantMs = nextLevel >= currentLevel ? 65 : 260
  const smoothingFactor = 1 - Math.exp(-normalizedElapsedMs / timeConstantMs)
  const smoothedLevel = currentLevel + (nextLevel - currentLevel) * smoothingFactor

  return smoothedLevel < 0.0005 ? 0 : clampAudioLevel(smoothedLevel)
}

export function calculateAudioRms(samples: Uint8Array | Float32Array) {
  if (samples.length === 0) return 0

  let sumSquares = 0

  for (const sample of samples) {
    const centeredSample = samples instanceof Float32Array ? sample : (sample - 128) / 128
    sumSquares += centeredSample * centeredSample
  }

  return Math.sqrt(sumSquares / samples.length)
}

export function calculateAudioPeak(samples: Uint8Array | Float32Array) {
  let peak = 0

  for (const sample of samples) {
    const centeredSample = samples instanceof Float32Array ? sample : (sample - 128) / 128
    peak = Math.max(peak, Math.abs(centeredSample))
  }

  return peak
}

export function calculateRepresentativeAudioLevel(levels: number[]) {
  const validLevels = levels
    .filter((level) => Number.isFinite(level))
    .map(clampAudioLevel)
    .sort((left, right) => left - right)

  if (validLevels.length === 0) return 0

  // The upper quartile reflects sustained voice while rejecting one-frame clicks and picker transients.
  const percentileIndex = Math.floor((validLevels.length - 1) * 0.75)

  return validLevels[percentileIndex]
}
