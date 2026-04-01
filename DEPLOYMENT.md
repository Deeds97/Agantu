# Deployment Notes

## Client (Cloudflare Pages)

1. Create a Pages project from this repository.
2. Set build settings:
   - Root directory: `client`
   - Build command: `npm install && npm run build`
   - Output directory: `dist`
3. Add env var:
   - `VITE_SERVER_URL` -> server base URL

## Server (Render Free Tier)

Use `render.yaml` or create manually:

- Root directory: `server`
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Environment variables:
  - `NODE_ENV=production`
  - `PORT=4000`
  - `CLIENT_ORIGIN` as your Cloudflare Pages domain
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_JWT_SECRET`

## Supabase

1. Apply SQL schema from `server/sql/schema.sql`.
2. Enable Auth providers:
   - Email/password
   - Google
3. Add frontend domain to allowed redirect URLs.

## Baseline Observability

- Use Render logs for runtime diagnostics.
- CI checks run on every PR and push to main via `.github/workflows/ci.yml`.
- Recommended next step: add `@sentry/node` in server startup for production exception capture.
