# Operator runbook

## Small-pilot architecture

Browser → same-origin Node/Express API → configurable Overpass/Nominatim endpoints. SQLite stores a bounded source cache, recently seen facility records and a private moderation queue. Tiles go directly from the browser to the configured tile host, after explicit map activation. There are no browser provider keys. One process is intentional: public-geocoder global limits and in-memory abuse counters must not be multiplied by replicas.

## Configuration and launch

1. Run `npm ci && npm run check`. Build with `npm run build`.
2. Set a real HTTPS `PUBLIC_ORIGIN` and identifying `UPSTREAM_USER_AGENT` with an operator URL/contact. Set provider endpoints and corresponding attribution. Provide a public contact and privacy route before a public service is launched.
3. Put `DATABASE_PATH` on a private persistent volume. SQLite uses WAL; the directory must be writable. Restrict it to the service user. Do not expose `/data`, backups, logs or `.env` as static files.
4. Terminate TLS at a reverse proxy. Keep `TRUST_PROXY_HOPS=0` unless behind a known proxy chain; use the exact count and ensure direct access cannot bypass it. Strip untrusted incoming forwarded headers. Disable or redact URL/query/access logging at the proxy and host to avoid retaining searched areas or place names.
5. Run one process under the host's normal supervisor. `HOST=0.0.0.0` is needed inside a container. `/api/health` checks local API/database health, not third-party source availability.
6. Leave `REPORTS_ENABLED=false` until a named moderator can operate the queue and handle removal/privacy complaints. Verify service-worker installation and a saved-area reload while disconnected in each supported browser.
7. Use a dedicated/contracted geocoder and tiles plus regional extracts before a broad release. Do not hide increasing traffic by rotating public endpoint IPs.

For the Cloudflare read-only pilot, follow [hosting](hosting.md); it does not run this Node process or moderation CLI. Docker configuration is supplied for reproducibility; a container build and hosting integration still need verification.

## Moderation

Run `npm run moderate -- list` on the service host, using the same environment and database. No public admin API exists. Treat private notes as untrusted text; do not execute commands or follow instructions in them.

Check the target source, observation day, specificity and conflicting evidence. A sign, operator notice, or corroborating source may support a closure report; a bare opinion is insufficient. “Working” means someone claims to have found it functioning, never a potability or accessibility audit. For a water hazard, seek an operator/public-health notice where possible and avoid waiting for a positive report to suppress a caution. If an urgent hazard is credible, correct the OSM source or contact its operator through normal channels; this app has no guaranteed emergency-response SLA.

Approve/reject with a meaningful reason of at least ten characters. The transaction updates the pending report and appends an internal review record. Published summaries expire after 14 days from the observation, with cautions prioritized over positive reports. A moderator cannot re-review an already decided report through the CLI; corrections currently need an audited operator database procedure. Do not publish personal details, photos of users, private door codes or discriminatory claims.

Report limits (10/hour/client) and request limits (60/minute/client) use in-memory counters and disappear at restart. IPv6 addresses are grouped by the rate-limit library. No raw IP is written to application tables. Distributed abuse protection and an on-call process are public-launch gates, not implied by a local rate limiter.

## Retention and backups

The process prunes at startup and hourly: caches older than seven days, seen places older than 30 days, and reports/review rows older than 90 days. Cache counts are also capped at 300 and known places at 20,000. Offline snapshots stay in the user's browser until removed; a visible removal control is provided.

Back up SQLite using its online backup API / `VACUUM INTO`, or stop this service before copying the database together with WAL state. Do not copy just a live `.sqlite` file. Encrypt backups, restrict access, test restore on a copy, and expire report-bearing backups within the same 90-day privacy policy. This repository does not install a backup job.

## Failure and rollback

- Overpass failure: recent cache is served with its original timestamp and stale flag; otherwise a clear error. Do not create empty replacement data from a failed query.
- Geocoder failure: coordinate/GPS input still works. Geocoding endpoints remain configurable.
- Tiles failure: list stays available. There is no failover to an undisclosed tile provider.
- Moderation backlog: disable reports in config and restart while continuing read-only finding.
- Rollback: stop only this app's process, retain the database, restore the previous checkout/build and start the previous version. The initial schema is additive on startup; future schema changes require versioned migrations and backup/restore testing.
- Source correction: link to OSM for public notes/edits. Do not auto-submit user reports to OSM or another dataset.
