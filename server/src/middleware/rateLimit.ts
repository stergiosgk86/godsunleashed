import type { Request, Response, NextFunction } from 'express'

interface Bucket { count: number; resetAt: number }

function getIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
    ?? req.socket.remoteAddress
    ?? 'unknown'
}

/**
 * Simple in-memory rate limiter: max `limit` requests per `windowMs` per IP.
 * Each call creates an independent bucket map so limiters don't interfere.
 */
export function rateLimit(limit: number, windowMs: number) {
  const buckets = new Map<string, Bucket>()

  // Periodically clean up stale entries so the map doesn't grow forever
  setInterval(() => {
    const now = Date.now()
    for (const [ip, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(ip)
    }
  }, 60_000).unref()

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getIp(req)
    const now = Date.now()
    let b = buckets.get(ip)
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + windowMs }
      buckets.set(ip, b)
    }
    b.count++
    if (b.count > limit) {
      res.status(429).json({ error: 'Too many requests — try again later' })
      return
    }
    next()
  }
}
