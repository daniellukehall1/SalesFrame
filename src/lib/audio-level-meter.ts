const meterNoiseFloor = 0.0025
const meterMaxLevel = 0.045
export const audibleAudioLevelThreshold = 0.006

export function calculateAudioMeterPercent(level: number) {
  const normalizedLevel = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0))

  if (normalizedLevel <= meterNoiseFloor) return 0
  if (normalizedLevel >= meterMaxLevel) return 100

  const decibels = 20 * Math.log10(Math.max(normalizedLevel, 0.00001))
  const minDecibels = -45
  const maxDecibels = -27
  const scaled = ((decibels - minDecibels) / (maxDecibels - minDecibels)) * 100

  return Math.max(6, Math.min(100, Math.round(scaled)))
}

export function smoothAudioMeterLevel(rawLevel: number, previousLevel: number) {
  const nextLevel = Math.max(0, Math.min(1, Number.isFinite(rawLevel) ? rawLevel : 0))
  const currentLevel = Math.max(0, Math.min(1, Number.isFinite(previousLevel) ? previousLevel : 0))

  if (nextLevel >= currentLevel) return nextLevel

  return currentLevel * 0.82 + nextLevel * 0.18
}
