# Gods Unleashed — Claude Instructions

## Build & Deploy

- **Always run `npm run build` after every code change**, before reporting the task as done.
- If the build fails, fix all errors before reporting.
- The user tests at **godsunleashed.stergiosgk.com** — served from `dist/` via PM2 + cloudflared. The Vite dev server is irrelevant.
- **After any server-side change, restart PM2:** `pm2 restart gods-unleashed`
- After every meaningful change, **bump the patch version in `package.json`** before building. The version shows in the main menu.
  - Patch is always 2 digits: `0.5.01 → 0.5.02 → ... → 0.5.16`. Never write `0.5.1`.
  - Rollover: `0.5.99 → 0.6.01`.

## Server-Authoritative Architecture

**All game logic lives on the server. The frontend is rendering + input only.**

- Damage, XP, kills, score, upgrades, enemy behavior → server owns it
- Frontend only renders server state and sends player input
- Exception: pure UI/animation concerns that don't affect game state are fine on the client
- When adding a feature, ask: "could a cheater gain an advantage by faking this?" If yes, compute it server-side

## Enemy Stats — Two Files, Both Must Match

Enemy HP, speed, and damage are defined in **two places**. Changing only one has no visible effect in production.

| File | Role |
|---|---|
| `server/src/ServerEnemy.ts` | **Authoritative** — drives all production gameplay via WebSocket |
| `src/game/Enemy.ts` | Client-side fallback only — never used in production |

**Always update `server/src/ServerEnemy.ts` first.** Then mirror the shared types (`basic`, `speeder`, `tank`) in `src/game/Enemy.ts` for consistency.

Enemy types split:
- Server-only: `ranged`, `exploder`, `ghost`, `charger`, `necromancer`, `summoner`, `boss`, `finalBoss`
- Client-only: `veteran`, `brute`, `revenant`, `titan`
- Shared: `basic`, `speeder`, `tank`

> Learned twice the hard way: client-only fixes to HP (v0.5.1–v0.5.2) and speed (v0.5.16) had zero effect because the server kept old values.
