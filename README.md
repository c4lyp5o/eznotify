# eznotify

One integration per service. eznotify fans a single request out to many notification platforms, so you don't wire the same service up again for each one.

Supported destinations: **Discord** (webhook or bot token), **Telegram**, **Slack** (incoming webhook), **Pushover**, **ntfy**, **Gotify**, and **Matrix** (unencrypted rooms only).

> **Status: 1.0.0, self-hosted.** Not for public exposure. See [Known limits](#known-limits).

## Generic outgoing webhooks

Choose **Generic webhook** to POST a fixed JSON object with `title` and `body`
to an HTTPS receiver. An optional bearer token is encrypted with the URL.
Custom headers, methods and payload templates are deliberately unsupported.
Add the exact receiver origin to `EZNOTIFY_OUTBOUND_ORIGINS` and restart.
The standard trusted-provider origins remain available; arbitrary origins are denied.
Redirects, URL credentials and plaintext HTTP are refused. Egress filtering is
still required against DNS rebinding and access to internal services.

Only 2xx responses count as acceptance. 429 and 5xx responses retry with the
existing bounded backoff; other non-2xx responses fail terminally. Receiver
acceptance is not downstream delivery. Requests may duplicate after ambiguous
acceptance: receivers must handle repeat notifications safely.
Saving/format validation sends nothing; use the explicit test button.

## Email / SMTP

Choose **Email / SMTP** in the destination wizard. Credentials are encrypted with
the other destination configuration; saving or validating sends nothing.
Use a dedicated account/app password, a provider-authorized sender and a single
bare recipient address. OAuth-only accounts, recipient lists and attachments
are not supported. Notifications are plain text.

Allow exact submission endpoints using `EZNOTIFY_SMTP_SERVERS`, for example
`smtp.example.com:587,smtp.example.com:465`, and restart the service after changes.
The default is deny-all. This is separate from the HTTPS origin allowlist.
Port 465 uses implicit TLS; 587 requires STARTTLS. Certificate validation cannot
be disabled. Network egress restrictions are still needed against DNS rebinding.

Use the explicit test button and confirm receipt, including spam. SMTP acceptance
does not guarantee inbox delivery. Configure SPF/DKIM/DMARC with your provider.
Transient failures retry; authentication and permanent 5xx refusals fail terminally.
A retry after ambiguous acceptance can duplicate mail, as with other transports.

## Docker Compose (recommended)

Use the single `compose.yml`; `compose.yml.example` is an identical copyable
example, not an overlay. Copy `.env.example` to `.env`, set generated secrets,
then restrict permissions with `chmod 600 .env`. Validate with
`docker compose config --quiet`; when ready, build/start with
`docker compose up -d --build`.

This builds the local source (no dependency on an unpublished registry image),
persists SQLite in a named volume, drops capabilities and exposes port 5099 only
to its Docker network and a loopback-only test port (5100). Set `TEST_BIND` to a LAN address explicitly for phone testing; never bind it to a public interface. Set `PROXY_NETWORK` to your existing
Traefik network (default `traefik_default`). The network must already exist.

Traefik routing, labels, TLS, middleware and load-balancer specifics are deliberately
left to the operator. Point your proxy at service `eznotify:5099` on that network.
No router is automatically enabled. Resource/log bounds are included; filesystem
quotas, backups and the remaining [release gates](DEVELOPER.md#release-gates) still apply.
Stop grace is 150 seconds to allow the current delivery batch to drain.

## Alternative: Docker CLI

```sh
docker run -d --name eznotify -p 127.0.0.1:5099:5099 \
  -v eznotify-data:/data \
  -e EZNOTIFY_ADMIN_TOKEN="$(openssl rand -hex 24)" \
  -e EZNOTIFY_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  ghcr.io/c4lyp5o/eznotify:latest
```

Open `http://127.0.0.1:5099`, unlock with the admin token, then connect a destination through the setup wizard.

**Keep your secrets.** Store the admin token and encryption key in a secret manager or a mode-600 env file. Losing `EZNOTIFY_ENCRYPTION_KEY` makes stored destination credentials unreadable, so back it up alongside the `/data` volume.

The image runs as uid 1000 and listens on `0.0.0.0` inside the container. Publish it only on loopback or a LAN address, and put HTTPS in front of it before going off-loopback (see [Security](#security)).

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `EZNOTIFY_ADMIN_TOKEN` | yes | Admin bearer token, 24+ characters. Unlocks the UI and the admin API. |
| `EZNOTIFY_ENCRYPTION_KEY` | yes | Base64-encoded 32-byte key. Encrypts destination credentials. |
| `DATA_DIR` | no | Where all state lives. Default `data/` at the repo root; the image uses `/data`. |
| `EZNOTIFY_DB` | no | SQLite file override. Default `$DATA_DIR/eznotify.sqlite`. The directory is created if missing. |
| `HOST` | no | Bind address. Default `127.0.0.1`; the image sets `0.0.0.0`. |
| `PORT` | no | Default `5099`. |

## Run from source

Requires Bun 1.4.2.

```sh
bun install --frozen-lockfile
bun run build
EZNOTIFY_ADMIN_TOKEN=… EZNOTIFY_ENCRYPTION_KEY=… bun start
```

## Destinations

- **Discord webhook:** paste the webhook URL. Anyone with the URL can post to the channel, so keep it secret.
- **Discord bot:** bot token plus channel ID. The bot needs View Channel and Send Messages in that channel. Mentions are suppressed.
- **Telegram:** a dedicated bot token and chat ID. Discovery uses `getUpdates`, which can conflict with another poller. An existing webhook blocks discovery, and eznotify will not remove it.
- **ntfy:** server URL, topic, and an optional access token. A hard-to-guess topic is not access control; configure server-side auth.
- **Slack:** incoming webhook for the intended channel; the entire URL is secret. Plain text only, with link/media unfurling disabled.
- **Pushover:** application API token and user/group key; normal priority only. Maximum 1024 message characters and 250 title characters; oversize messages fail explicitly.
- **Gotify:** HTTPS server URL and an application token (not a client token). Explicitly allow the server origin in `EZNOTIFY_OUTBOUND_ORIGINS`.
- **Matrix:** homeserver URL, a bot access token, and an internal room ID. Use a **private, unencrypted** room. Encrypted rooms are refused before any message is sent.

Each destination has an explicit **Send test** button. Saving never sends a message.

## Sending notifications

Create a source in the UI and attach it to a route (one or more destinations). Then send to one of the intake endpoints:

- `POST /v1/notify` — native JSON, bearer source token.
- `POST /api/webhooks/{sourceId}/{token}` — Discord-shaped publishing.
- `POST /services/{sourceId}/{unused}/{token}` — Slack-shaped publishing.
- `POST /ntfy/{sourceId}` — ntfy-shaped publishing, bearer auth.
- `POST /gotify/message` — Gotify-shaped publishing.
- `POST /1/messages.json` — Pushover-shaped publishing.

Compatibility is limited and fixture-tested. See [Known limits](#known-limits). Send an `Idempotency-Key` header to avoid duplicate fan-out on retries.

## Testing

```sh
bun run lint        # Biome check
bun run build       # production frontend
bun test            # contract, persistence, delivery and startup tests
docker build -t eznotify:dev .
```

The `tests/*-live-proof.js` scripts send real messages to real platforms. They are manual, never run in CI, and not part of `bun test`.

## Overview and attribution

The Overview polls the authenticated state snapshot every five seconds while the
page is visible (ten-second request timeout, no overlapping poll requests). Failed
refreshes retain the last snapshot with a stale-data warning. A 401 locks the UI;
locking aborts polling. No state requests occur before unlock.

Counts describe the **latest 100 jobs**, not lifetime totals. Route outcomes use
the route captured when the notification was accepted, even if the source is
later reassigned. Existing databases gain a nullable route column automatically;
historical notifications remain unattributed rather than guessing their origin.
Count changes receive a brief Motion transition, respecting reduced motion.

Manual live fan-out proof: `bun tests/live-fanout-proof.js`. This sends two real
messages to unique topics on the configured test ntfy server and checks readback;
it is not part of CI. Failure isolation and targeted retry are tested with a
controlled transport in `tests/acceptance.test.js`.

## Security

- The UI shows no data before unlock. Unauthenticated API calls return 401.
- Credentials are encrypted at rest (AES-256-GCM). Source tokens are stored only as SHA-256 hashes.
- Outbound requests refuse redirects.
- The server sends no CORS headers, so browsers on other origins cannot call the API.
- Matrix delivery fails closed on encrypted or unclear room state.
- Off-loopback use needs HTTPS at a reverse proxy. The proxy must redact path and query credentials, because the webhook and ntfy intake paths carry tokens.

## Known limits

- **Test sends prove provider acceptance, not recipient receipt.**
- Compatibility with third-party clients is fixture-tested, not proven against every real app.
- Matrix encrypted rooms are unsupported.
- Messages over the platform limit fail explicitly. Splitting is not implemented.
- Delivery is at least once. A crash after provider acceptance can duplicate a message.
- **One worker only.** Do not run multiple replicas against the same database.
- Terminal notification history expires after 30 days (hourly cleanup); pending fanout is preserved. Idempotency protection expires with history. Jobs are capped at 100,000 total / 10,000 pending, and the SQLite main database at 256 MiB. WAL and filesystem usage still require an operator volume quota and monitoring.
- Production outbound traffic defaults to Discord, Telegram, Slack incoming webhooks and Pushover HTTPS origins only. Set `EZNOTIFY_OUTBOUND_ORIGINS` to a comma-separated list of exact HTTPS origins for self-hosted providers. Redirects are refused. Only allow origins you control: DNS/IP network isolation remains an operator requirement (the origin policy is not a DNS-rebinding firewall). HTTP destinations are denied by the production transport.
- Polling is snapshot-based, not an event stream; intermediate transitions can be missed.

## Roadmap before any public exposure

- Real-platform end-to-end proof for each destination, plus recipient-side receipt checks.
- Stricter per-adapter schemas and rejection of unsupported features.
- Destination deletion and durable validation status.
- Rate pacing, multi-process leases, graceful worker drain.
- Retention, disk quotas, streamed body limits, and a security audit.

## License

MIT. See [LICENSE](LICENSE).

## Development

Setup, commands, tests, linting and the `development` → `master` release flow are in [DEVELOPER.md](DEVELOPER.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).
