# Public-release gates — not an exposure approval

## Implemented and exercised
- Production transport: exact HTTPS origin allowlist, redirects denied; shared by delivery and onboarding.
- Streamed intake byte limit, including Pushover pre-auth parsing.
- Revoked sources explicitly refused at intake.
- 30-day terminal history retention, pending fanout preserved.
- Main SQLite quota 256 MiB, total/pending job caps.
- Worker shutdown waits for the active batch before closing SQLite.
- CSP, no-referrer, nosniff and frame denial headers.

## Still blocking public exposure
- An operator-approved HTTPS reverse proxy configuration with credential-path/query log redaction, request/concurrency limits, authentication attempt throttling, and verified external TLS.
- Egress network isolation covering DNS rebinding and private/metadata addresses; explicitly decide which self-hosted endpoints may be reached.
- Filesystem quota covering WAL, backups and logs, plus disk alerts. SQLite max_page_count only bounds the main DB.
- Independent full security review, dependency audit, and hostile HTTP/load tests. Existing tests do not constitute that audit.
- Real recipient receipt confirmation for every advertised provider; Gotify real-platform proof remains outstanding.
- Strict per-adapter unsupported-field/schema tests, durable destination validation status and safe deletion semantics remain roadmap work.
- Backup/restore drill with the actual deployment storage and encryption key.
- Single-worker operation remains mandatory; multi-replica deployments unsupported.

No public instance was created. A source release and safe Internet exposure are different approvals.
