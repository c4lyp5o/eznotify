# Developing eznotify

Bun backend with a React + Vite frontend (`frontend/`), one package at the root.

## Commands

Run from the repo root with [Bun](https://bun.sh).

| Task | Command |
| --- | --- |
| Run the test suite | `bun run test` |
| Lint with Biome | `bun run lint` |
| Apply Biome's safe fixes | `bun run lint:fix` |
| Build | `bun run build` |
| Start in production (PM2 where configured) | `bun run start` |

## Tests

`bun test` runs the suite in `tests/`.

## Linting

[Biome](https://biomejs.dev) 2.6.8 is the only linter. It is pinned at the repo root, so run it from there: `bun run lint` checks, `bun run lint:fix` applies safe fixes. Configuration is `biome.json`; `biome.json` also sets the formatting rules (`bunx biome check --write .` applies them). CI runs the same command.

## Branches and releases

There are two long-lived branches:

| Branch | Role |
| --- | --- |
| `development` | Integration branch. Branch from it (`feat/…`, `fix/…`, `chore/…`) and open every PR against it. |
| `master` | Released code. Only `development` is merged into it, by PR. |

No other long-lived branches (`main`, `dev`, `staging`, …) are kept; delete feature branches once merged.

To release: bump the version in `package.json` and `VERSION`, move the `[Unreleased]` notes in `CHANGELOG.md` under `## [x.y.z] - YYYY-MM-DD`, then merge `development` into `master`. Every push to `master` runs `publish.yml`: `test.yml` first, then `ghcr.io/c4lyp5o/eznotify:<version>`, `:latest` and `:sha-<commit>`. Tagging `vX.Y.Z` afterwards is optional: it checks the tag matches `package.json`, pushes `:<version>` and creates a GitHub Release from that version's changelog section. `development` publishes nothing.

Commits follow [Conventional Commits](https://www.conventionalcommits.org) (`fix(scope): …`) with a body that explains why. Add a `CHANGELOG.md` line under `[Unreleased]` for anything a user would notice. Every behaviour change needs a test; a bug fix needs one that fails without the fix.

## Docker

The image follows the ez standard Dockerfile: a Bun stage builds the frontend, then `oven/bun:1.4.5-alpine` runs the app as `bun` (uid 1000) with a `HEALTHCHECK` on `/healthz`. Keep the Bun version in step with `bun-version` in `.github/workflows/`. `test.yml` builds the image, boots it and waits for healthy; do the same locally (`docker build -t eznotify .`, then `docker run`) after changing the Dockerfile.

## Contributing

Thanks for helping. eznotify is a small, single-process notification hub. Please keep changes small, focused and tested.

### Ground rules
- **Never commit secrets.** Credentials, tokens and passwords go in environment variables or a secret manager, never in code, tests, fixtures or logs. Use obvious fixtures such as `test-only-…` values.
- **Security first.** Any change touching auth, encryption, outbound requests or intake must come with a test that proves the rejection path.
- **Evidence over claims.** A change is only done when the tests, the build and, where relevant, a real run have passed. Say what you did *not* verify.
- **Small surface.** Add one adapter or one feature per change. Keep modules modular so new platforms can be added without touching the core.

### Development setup
Requires Bun 1.4.2 (the version CI and the image use).

```sh
bun install --frozen-lockfile
bun run lint        # Biome check
bun run build       # production frontend
bun test            # backend and contract tests
```

Run the server locally with `EZNOTIFY_ADMIN_TOKEN` (24+ characters) and `EZNOTIFY_ENCRYPTION_KEY` (base64, 32 bytes) set.

### Docker
```sh
docker build -t eznotify:dev .
```
The container runs as uid 1000, reads `EZNOTIFY_DB` for its database path and keeps data in `/data`. Do not bake secrets into the image.

### Adding a destination platform
1. Add the kind to `validateDestination` in `backend/delivery.js`, with a validation test that covers malformed and hostile inputs.
2. Add its send path in `send()`, respecting the platform's length limit. Fail explicitly on oversize messages; do not truncate silently.
3. Add a guide entry in `frontend/src/guides.js` with **real** setup steps and the privacy caveats for that platform.
4. Add a test using a fake transport. Live provider proof is a separate, explicit step, never part of CI.

### Pull requests
- Branch from `development`. Open PRs against `development`; `master` is promoted from it.
- CI must be green: lint, build, tests and the Docker smoke test.
- Describe what changed, how you tested it, and what you did not test.
- No live-platform messages in tests. CI must not send to real Discord, Telegram, Matrix or ntfy servers.

## Release gates

### Implemented and exercised
- Production transport: exact HTTPS origin allowlist, redirects denied; shared by delivery and onboarding.
- Streamed intake byte limit, including Pushover pre-auth parsing.
- Revoked sources explicitly refused at intake.
- 30-day terminal history retention, pending fanout preserved.
- Main SQLite quota 256 MiB, total/pending job caps.
- Worker shutdown waits for the active batch before closing SQLite.
- CSP, no-referrer, nosniff and frame denial headers.

### Still blocking public exposure
- An operator-approved HTTPS reverse proxy configuration with credential-path/query log redaction, request/concurrency limits, authentication attempt throttling, and verified external TLS.
- Egress network isolation covering DNS rebinding and private/metadata addresses; explicitly decide which self-hosted endpoints may be reached.
- Filesystem quota covering WAL, backups and logs, plus disk alerts. SQLite max_page_count only bounds the main DB.
- Independent full security review, dependency audit, and hostile HTTP/load tests. Existing tests do not constitute that audit.
- Real recipient receipt confirmation for every advertised provider; Gotify real-platform proof remains outstanding.
- Strict per-adapter unsupported-field/schema tests, durable destination validation status and safe deletion semantics remain roadmap work.
- Backup/restore drill with the actual deployment storage and encryption key.
- Single-worker operation remains mandatory; multi-replica deployments unsupported.

No public instance was created. A source release and safe Internet exposure are different approvals.
