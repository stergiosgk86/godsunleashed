import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET!

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, SECRET) as { userId: number; username: string }
    req.userId   = payload.userId
    req.username = payload.username
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}
