# Contributing to eznotify

Thanks for helping. eznotify is a small, single-process notification hub. Please keep changes small, focused and tested.

## Ground rules
- **Never commit secrets.** Credentials, tokens and passwords go in environment variables or a secret manager, never in code, tests, fixtures or logs. Use obvious fixtures such as `test-only-…` values.
- **Security first.** Any change touching auth, encryption, outbound requests or intake must come with a test that proves the rejection path.
- **Evidence over claims.** A change is only done when the tests, the build and, where relevant, a real run have passed. Say what you did *not* verify.
- **Small surface.** Add one adapter or one feature per change. Keep modules modular so new platforms can be added without touching the core.

## Development setup
Requires Bun 1.4.2 (the version CI and the image use).

```sh
bun install --frozen-lockfile
bun run lint        # Biome check
bun run build       # production frontend
bun test            # backend and contract tests
```

Run the server locally with `EZNOTIFY_ADMIN_TOKEN` (24+ characters) and `EZNOTIFY_ENCRYPTION_KEY` (base64, 32 bytes) set.

## Docker
```sh
docker build -t eznotify:dev .
```
The container runs as uid 1000, reads `EZNOTIFY_DB` for its database path and keeps data in `/data`. Do not bake secrets into the image.

## Adding a destination platform
1. Add the kind to `validateDestination` in `backend/delivery.js`, with a validation test that covers malformed and hostile inputs.
2. Add its send path in `send()`, respecting the platform's length limit. Fail explicitly on oversize messages; do not truncate silently.
3. Add a guide entry in `frontend/src/guides.js` with **real** setup steps and the privacy caveats for that platform.
4. Add a test using a fake transport. Live provider proof is a separate, explicit step, never part of CI.

## Pull requests
- Branch from `development`. Open PRs against `development`; `master` is promoted from it.
- CI must be green: lint, build, tests and the Docker smoke test.
- Describe what changed, how you tested it, and what you did not test.
- No live-platform messages in tests. CI must not send to real Discord, Telegram, Matrix or ntfy servers.
