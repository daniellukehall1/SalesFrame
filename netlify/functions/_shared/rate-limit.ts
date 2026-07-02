import { tooManyRequests } from "./http"

type RateLimitBucket = {
  count: number
  resetAt: number
}

type RateLimitOptions = {
  key: string
  limit: number
  name: string
  windowMs: number
}

const buckets = new Map<string, RateLimitBucket>()
const maxBuckets = 5000

export function assertRateLimit({
  key,
  limit,
  name,
  windowMs,
}: RateLimitOptions) {
  const normalizedKey = key.trim()
  if (!normalizedKey) return

  const now = Date.now()
  const bucketKey = `${name}:${normalizedKey}`
  const bucket = buckets.get(bucketKey)

  if (!bucket || bucket.resetAt <= now) {
    cleanupExpiredBuckets(now)
    buckets.set(bucketKey, {
      count: 1,
      resetAt: now + windowMs,
    })
    return
  }

  if (bucket.count >= limit) {
    const retrySeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    throw tooManyRequests(
      `That is a lot of ${name} activity at once. Wait ${retrySeconds} seconds, then try again.`
    )
  }

  bucket.count += 1
}

function cleanupExpiredBuckets(now: number) {
  if (buckets.size < maxBuckets) return

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }

  if (buckets.size < maxBuckets) return

  const keysToDelete = Math.ceil(maxBuckets * 0.1)
  let deleted = 0
  for (const key of buckets.keys()) {
    buckets.delete(key)
    deleted += 1
    if (deleted >= keysToDelete) return
  }
}
