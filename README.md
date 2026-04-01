# Agantu

Free-first implementation scaffold for the Agantu 4-player turn-based web PvP game.

## Stack

- Client: Phaser + TypeScript + Vite
- Server: Node.js + Express + Socket.IO + TypeScript
- Auth/DB: Supabase (email/password + Google OAuth)
- Deployment: Cloudflare Pages (client) + Render (server free tier)

## Repo Layout

- `client`: Phaser frontend and socket client bootstrap
- `server`: Authoritative match engine, API routes, socket server
- `server/sql/schema.sql`: Postgres schema for match and event persistence
- `.github/workflows/ci.yml`: CI for lint, test, and build

## Local Setup

1. Install dependencies:
   - `npm install`
2. Configure env files:
   - copy `server/.env.example` -> `server/.env`
   - copy `client/.env.example` -> `client/.env`
3. Run server:
   - `npm run dev -w server`
4. Run client:
   - `npm run dev -w client`

## Supabase Auth Setup

1. In Supabase Auth providers, enable:
   - Email
   - Google
2. Add your Google OAuth client credentials in Supabase dashboard.
3. Set redirect URL for local and production client domains.
4. Set server env:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_JWT_SECRET`

Server validates Supabase JWTs on both REST and Socket.IO handshakes.

### Temporary dev: no login

Use **`VITE_AUTH_BYPASS=true`** in `client/.env`. The server allows anonymous sockets when **`AUTH_BYPASS=true`** in `server/.env`, or automatically in **`NODE_ENV=development`** if **`SUPABASE_JWT_SECRET`** is not set (so you do not get “Missing token” without configuring Supabase). Each tab gets an anonymous user id; open four tabs with the same room code to test. **Do not rely on auth bypass in production.**

## Rule Coverage Implemented

- 4-player enforced rooms and seat assignments
- Server-authoritative turn actions and AP costs
- Preparation phase action validation
- Reward scoring for zone control and round progression
- Winner selection by VP threshold or round limit
- Reconnect token handshake event support

## Next Feature Work

- Full duel system event/skull branches and per-unit target selection UI
- NPC movement and event deck/quest deck resolution
- Tile effect catalog and dynamic modifiers
- Replay/history view backed by `turn_events` and snapshots