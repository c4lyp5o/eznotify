# Changelog

All notable changes to eznotify. Versions follow [Semantic Versioning](https://semver.org/). Pre-1.0 releases may change behaviour between minor versions.

## [Unreleased]

### Changed
- Header, sidebar and sign-in use the shared ez `Brand`: the ez icon and the lowercase name.

## [1.0.0] - 2026-11-22

### Changed
- Dependencies updated (majors kept only where the tests passed), Docker image on oven/bun 1.4.5, Biome as the linter, and the shared ez favicon.

- Generic outgoing HTTPS webhooks with fixed JSON, optional encrypted bearer token, setup guide and existing origin policy/retry handling.

- Email/SMTP destination with guided setup, encrypted credentials, exact host:port allowlist, mandatory TLS (465/587), plain-text messages and sanitized retry handling.

- Slack incoming webhook and Pushover destinations, with guided setup and explicit test sends through the existing management flow.
- Gotify setup now explains the required outbound origin allowlist; provider contract tests cover Gotify, Slack and Pushover, limits and retry classification.

- Overview switchboard with route selection, attention filter and delivery controls.
- Authenticated five-second visible-page polling, freshness/stale indicators,
  session-expiry lock and reduced-motion-aware observed count transitions.
- Immutable intake route attribution with nullable migration for legacy records.
- Controlled failure/retry acceptance test and manual two-destination ntfy readback proof.
- Local non-root container smoke verification; remains local alpha, not public-ready.

## [0.1.0] — 2026-11-16

First local alpha. Not for public exposure.

### Added
- Destinations: Discord webhook, Discord bot token + channel ID, Telegram bot, Gotify, ntfy, and unencrypted Matrix rooms.
- Four-step setup wizard: platform → instructions → configure and validate → save and explicit test.
- Telegram credential check (`getMe`) and non-sending chat discovery (`getUpdates`).
- Routes that fan one source out to several destinations.
- Source intake: native JSON, plus limited Discord, Slack, ntfy, Gotify and Pushover publishing shapes.
- Management: destination rename and replacement, source name and route edits, persisted Active/Revoked status, token rotation, and retry of individual failed deliveries.
- Encrypted destination credentials (AES-256-GCM). Source tokens stored as SHA-256 hashes.
- SQLite queue with atomic fanout, per-destination retries, and idempotency keys.
- Docker image (`ghcr.io/c4lyp5o/eznotify`) running as non-root, with a health check and a `/data` volume.
- CI: lint, build and tests, then a Docker smoke test, then a branch-tagged GHCR push.

### Security
- Admin API requires `EZNOTIFY_ADMIN_TOKEN`; the UI shows no data before unlock.
- Matrix delivery refuses encrypted rooms and unclear encryption state before sending.
- Discord bot delivery suppresses mentions.

### Known limits
- Test sends prove provider acceptance, not recipient receipt.
- Matrix encrypted rooms are unsupported.
- Long Discord and Telegram messages fail explicitly; splitting is not implemented.
- Delivery is at least once: a crash after provider acceptance can duplicate a message.
- Single worker only; do not run multiple replicas.
