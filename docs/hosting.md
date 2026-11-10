# Public hosting

Decision recorded 10 November 2026. The source repository is public. The hosting
adapter targets a small, account-free, read-only pilot on Cloudflare Workers
with one SQLite-backed Durable Object. The existing Node/SQLite server remains
available for operators who want to run the moderation workflow.

## Why Cloudflare

The React frontend is served as static assets. A thin Worker forwards all API
calls to a single named Durable Object, which reuses the existing normalization,
source-query, validation and caching logic. This keeps the upstream request
queue and geocoder throttle global without running a VM. The source cache
survives deployments and process eviction. No facility-verification reports are
accepted or stored by this adapter; its API always advertises reports disabled.

This architecture is compatible with [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/)
and [SQLite Durable Objects on the free plan](https://developers.cloudflare.com/durable-objects/platform/pricing/).
At the time checked, Workers Free includes 100,000 dynamic requests per day;
static asset requests are free and unlimited. Durable Objects have separate
request, duration, row-read, row-write and storage allowances. Free-plan excess
operations fail rather than activating an upgrade. Allowances are shared with
other apps in the account, so these figures are not a traffic guarantee for
this project. No domain purchase or paid plan upgrade is required.

Deployment uses the operator's existing Cloudflare account. The available
Wrangler OAuth access can deploy but cannot read account subscriptions (the
billing endpoint returns 403). Therefore free-tier compatibility does not prove
that the existing account itself has a zero-dollar bill. This project must not
change the account's plan. On a paid account, shared included allowances and
potential overages still apply; Cloudflare does not provide a hard account
spend cap through this configuration.

## Other hosts checked

| Host | Fit | Decision |
| --- | --- | --- |
| [Lakebed](https://docs.lakebed.dev/support/) | Free-only alpha; a capsule runtime with Preact and restricted imports, not a general Node host | Would require replacing the UI integration and server/storage layer. Its [5-second action runtime and 48 KiB result limit](https://docs.lakebed.dev/limits/) also clash with Overpass requests that can take 25 seconds and return larger results. Keep it for a separate experiment. |
| [Render Free](https://render.com/docs/free) | Can run the current Node app, but sleeps after 15 minutes idle and loses local SQLite files on restart, redeploy or sleep | Usable for a disposable preview with reports disabled. Unsuitable for durable reports without a different datastore; free Postgres expires after 30 days. |
| Cloudflare Workers + SQLite Durable Object | Keeps the current frontend and shared source logic with a small server adapter and durable source cache | Selected for the public read-only pilot. |

## Build, deploy and verify

```sh
npm ci
npm run check
npm run test:smoke
npm run check:worker
# Authenticate Wrangler to your own Cloudflare account first.
npm run deploy:cloudflare
```

`wrangler.jsonc` declares the asset directory, one Durable Object class and its
SQLite migration. Its public User-Agent points to the project and issue tracker
for contact. Endpoint URLs remain deployment configuration. Wrangler's local
state and credentials are ignored by Git. Do not commit credentials or copy a
personal `.env` into the Worker environment.

The deployment outputs a public HTTPS `workers.dev` URL. Check the home page,
`/api/health`, `/api/config`, one nearby search and one submitted place search
without authentication. A health response alone does not prove upstream data
availability. Unknown API routes must return JSON 404, not the SPA HTML shell.
Static security headers are in `public/_headers`; API responses are no-store.
Worker request logging/observability is disabled in this deployment config;
Cloudflare may still retain infrastructure data under its own policies.

## Pilot boundaries

The hosted cache keeps at most 300 entries and removes records older than seven
days on cache writes. Expired entries are never read; dormant expired records
may remain at rest until the next cache write. Entries larger than 1.5 MB are
not persisted, to stay below SQLite row limits. There is no hosted private
report table, moderation endpoint or report backup. Recently seen facility
records are unnecessary while reports are disabled.

Public Nominatim remains limited to submitted searches with one application-wide
upstream request per 1.1 seconds. The throttle survives Durable Object restarts;
cache hits do not spend an upstream request. One active Overpass query is
allowed; source cache and stale-result behavior match the Node implementation.
A bounded in-memory per-client limiter permits 60 requests/minute and resets
when the object is evicted. This is a small-pilot abuse measure, not a promise
of uninterrupted public service. A broad launch still needs dedicated map
providers, real-browser/accessibility checks and field verification.

Roll back code using Wrangler's deployment/version commands and the previous
source commit. Keep the Durable Object name and class binding stable to retain
cache state. Do not delete the Worker or namespace as a rollback: deletion can
remove persistent data. The cache is reconstructible from OSM and contains no
submitted report notes.
