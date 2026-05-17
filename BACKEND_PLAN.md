# Backend Implementation Plan

## Stack Decision
- **Database**: PostgreSQL (concurrent writes for multiplayer)
- **HTTP layer**: Express (added to existing game server process)
- **Auth**: Passport.js — local (username/password) + Google OAuth2
- **Password hashing**: bcrypt
- **Sessions**: JWT (jsonwebtoken)
- **Tunnel**: cloudflared (no port forwarding, free HTTPS, hides real IP)

## Architecture
```
Your Machine
├── cloudflared tunnel  →  yourdomain.com (Cloudflare edge, HTTPS)
└── Node.js process (server/)
    ├── Express HTTP
    │   ├── GET  /                      → serves built React app
    │   ├── POST /auth/register         → username/password signup
    │   ├── POST /auth/login            → username/password login
    │   ├── GET  /auth/google           → start Google OAuth
    │   ├── GET  /auth/google/callback  → Google OAuth return
    │   ├── GET  /api/profile           → get active profile
    │   └── POST /api/profile           → save coins / upgrades
    └── WebSocket /ws                   → existing game server (auth-gated)
        └── PostgreSQL
```

---

## Step 1 — PostgreSQL setup
- Install PostgreSQL on the server machine
- Create a database and user for the game
- Define schema:
  - `users` table: id, username, email, password_hash, google_id, created_at
  - `profiles` table: id, user_id, coins, upgrades (jsonb), created_at, updated_at
- Install `pg` npm package in server/

## Step 2 — Express HTTP layer
- Add Express to the existing server/src/index.ts (currently pure WebSocket)
- Serve the built React app from `dist/` as static files
- Add JSON body parser middleware
- Wire up all API routes as separate route files
- Keep WebSocket server running on the same port (Express supports this via `server.on('upgrade', ...)`)

## Step 3 — Auth: username/password
- Install: `passport`, `passport-local`, `bcrypt`, `jsonwebtoken`
- POST /auth/register: validate input, hash password with bcrypt, insert user row, return JWT
- POST /auth/login: find user, compare bcrypt hash, return JWT on success
- JWT payload: `{ userId, username }`
- JWT secret stored in environment variable
- Token expiry: 30 days (game — convenience over strict security)

## Step 4 — Auth: Google OAuth
- Install: `passport-google-oauth20`
- Create Google Cloud project, enable Google+ API, get client ID + secret
- Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to env
- GET /auth/google: redirect to Google consent screen
- GET /auth/google/callback: receive code, exchange for profile, upsert user row (match on google_id or email), return JWT
- Callback URL must match exactly what's registered in Google Cloud Console: `https://yourdomain.com/auth/google/callback`

## Step 5 — Auth middleware
- Express middleware that reads `Authorization: Bearer <token>` header
- Verifies JWT, attaches `req.userId` to the request
- Applied to all /api/* routes
- WebSocket connection: client sends JWT in the connection URL or first message; server verifies before allowing play

## Step 6 — Profile API
- GET /api/profile: query profiles table by user_id, return coins + upgrades
- POST /api/profile: update coins and upgrades for user_id (called on run end / upgrade purchase)
- Replace frontend profileStore localStorage logic with fetch() calls to these endpoints
- Keep Zustand store as local cache — fetch on login, write-through on changes

## Step 7 — WebSocket auth gate
- On WebSocket upgrade request, extract JWT from query param `?token=xxx`
- Verify token before allowing the player into a game room
- Attach userId to the socket so the server knows who is playing
- Unauthenticated connections are rejected with code 4001

## Step 8 — cloudflared tunnel
- Install cloudflared on the server machine
- `cloudflared login` (links to your Cloudflare account + domain)
- `cloudflared tunnel create gods-unleashed`
- Create tunnel config pointing to localhost:PORT
- Enable WebSockets in Cloudflare dashboard (Network tab → WebSockets toggle ON)
- Run cloudflared as a systemd service so it starts on boot
- Update frontend WS URL from `ws://localhost` to `wss://yourdomain.com/ws`

## Step 9 — Frontend wiring
- Add login / register screen (before the main menu, if no JWT in localStorage)
- Store JWT in localStorage on login
- Attach JWT to all /api/profile fetch calls
- Attach JWT to WebSocket connection URL
- Add logout button (clears JWT, returns to login screen)
- Google login button: just a link to `https://yourdomain.com/auth/google`

## Step 10 — Environment & deployment
- Create `.env` file in server/ with:
  - DATABASE_URL=postgresql://user:pass@localhost:5432/godsunleashed
  - JWT_SECRET=long-random-string
  - GOOGLE_CLIENT_ID=...
  - GOOGLE_CLIENT_SECRET=...
  - GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
  - PORT=3000
- Add `.env` to `.gitignore`
- Build frontend: `npm run build` → outputs to dist/
- Run server with `node` or `pm2` (pm2 recommended — restarts on crash, runs on boot)
- Set up pm2 startup: `pm2 startup && pm2 save`

---

## Implementation Order
1. Step 1 (PostgreSQL) — foundation everything else builds on
2. Step 2 (Express) — HTTP layer before any routes
3. Step 3 (local auth) — get login/register working first
4. Step 5 (auth middleware) — secure the API
5. Step 6 (profile API + frontend wiring) — profiles working end to end
6. Step 7 (WebSocket auth gate) — multiplayer secured
7. Step 4 (Google OAuth) — added on top once local auth works
8. Step 8 (cloudflared) — last, once everything works locally
9. Step 10 (env + pm2) — production hardening
