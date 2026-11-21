# AGENTS.md — working notes for AI agents on eznotify

Read this before changing code.

## What this repo is
eznotify is a Bun + Elysia + SQLite notification hub. One source sends one request; eznotify fans it out to destinations (Discord, Telegram, Gotify, ntfy, Matrix). It is a local alpha. Do not expose it publicly.

## Layout
- `backend/server.js` — entrypoint. Reads env, opens the DB, starts the HTTP server and the delivery worker.
- `backend/app.js` — REST routes and the SPA fallback.
- `backend/delivery.js` — destination validation, per-platform send paths, the queue worker.
- `backend/intake.js` — normalizers for incoming webhook shapes.
- `backend/store.js` — SQLite schema, encryption (AES-256-GCM), source hashing.
- `backend/management.js`, `backend/onboarding.js` — management actions and provider validation.
- `frontend/src/` — React SPA. `guides.js` holds the platform setup instructions.
- `tests/` — Bun tests. `*-live-proof.js` files are manual scripts that send to real platforms. They are NOT part of `bun test` and must never run in CI.

## Rules for agents
1. **Never commit or push without the owner's explicit OK.** Patch, test, report.
2. **Never print or log secrets.** No tokens, passwords, webhook URLs or room credentials in chat, logs, fixtures or commit messages. Stage credentials in a mode-600 file and delete them after use.
3. **Never send to real platforms from automated tests.** Live proofs need explicit owner direction.
4. **Run the gates after every change:** `bun run lint`, `bun run build`, `bun test`. Report the actual numbers.
5. **Respect the Docker constraints:** the container runs as uid 1000 from `/app`; all writable state goes under `EZNOTIFY_DB`'s directory (`/data`). Never write to a relative path.
6. **Single worker.** Do not add replicas or multi-process queue leases without a design discussion.
7. **Matrix safety:** delivery must fail closed on encrypted or unclear room state. Do not weaken `delivery.js`'s encryption check.
8. **Discord bot delivery must keep mentions suppressed** (`allowed_mentions: { parse: [] }`).

## Common tasks
- Add a platform: see DEVELOPER.md. Validation tests first.
- Change the schema: add a migration in `store.js`; never drop user data silently.
- Release: bump `package.json` and `VERSION` together, update CHANGELOG, then tag `vX.Y.Z` after owner approval.

## Verification commands
```sh
bun run lint && bun run build && bun test
docker build -t eznotify:dev .
```
