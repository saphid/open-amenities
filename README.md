# Open Amenities

Find nearby public toilets and drinking water, with the access details and uncertainty visible. An account-free, open-source web app for a need everyone shares.

**Status: working initial implementation; not a publicly deployed service or a field-verified directory.** The repository is public. Source code is MIT; OpenStreetMap data is separately licensed under ODbL. See [research](docs/research.md), [data and verification](docs/data-and-verification.md), and the [launch-readiness record](docs/readiness.md).

[View the initial interface](docs/design.md) (static render, not live-data proof).

## Run locally

Requires **Node.js 24+** (uses built-in SQLite; Node 24 currently emits an experimental SQLite warning).

```sh
npm ci
cp .env.example .env
npm run dev
```

Open `http://127.0.0.1:4173`. The initial area is central Sydney, clearly labelled as a starting area, not your location. GPS and coordinate searches work without keys. Place-name search requires an identifying `UPSTREAM_USER_AGENT` in `.env`. Reports are disabled until `REPORTS_ENABLED=true`; enable them locally to exercise the moderation workflow.

### Public map services have limits

The default place search uses public Nominatim **only after deliberate operator configuration**. Read its [usage policy](https://operations.osmfoundation.org/policies/nominatim/): maximum one request per second for the entire application, no autocomplete, identifying User-Agent, attribution, and cached results. This implementation uses submitted searches, one-process global throttling, a proxy, and a one-day search cache. Do not run replicas against the public endpoint; use a dedicated/contracted geocoder before growing traffic. No personal or confidential addresses should be submitted.

Overpass is also a shared, best-effort source: one active request per process, a 3 km search projected from a shared 4 km grid-cell query, 15-minute fresh cache, bounded responses, and explicit stale fallback. Normal browser caching handles map tiles. There is no tile prefetch or offline tile download. Read the [tile policy](https://operations.osmfoundation.org/policies/tiles/). All providers are configurable without rebuilding the frontend.

## What works

- Live OSM toilets and explicitly mapped potable water / participating refill points, including node, way and relation records.
- A keyboard-usable text list and opt-in interactive map showing the same filtered results. Map panning uses an explicit “Search this area” action.
- Manual place search, direct latitude/longitude input, and optional GPS. Exact GPS coordinates are rounded before network requests.
- Strict filters for no fee, wheelchair access, baby changing, gender-neutral facilities, bottle filling and 24-hour mapping. Missing values never become a yes.
- Private sites excluded; customer/key/permit/conditional access hidden by default, with explicit opt-in. Hours are shown as source text, not an unreliable “open now” claim.
- Source links and separate fetch, edit, and source-check dates; directions and shareable location links.
- Explicitly save one area on this device; recover a dated text list offline after the production service worker installs. The map itself is not saved.
- Anonymous reports stored in SQLite, rate limited, idempotent on retries, and private until a moderator reviews them. A recent working report never cancels a caution. Water-quality testing is never inferred.
- No account, tracking SDK, ad, photo upload, public free-text comments, or public admin endpoint.

## Verify

```sh
npm run check
npm run test:smoke
npm audit --audit-level=high
```

Tests exercise source normalization, unknown and conditional tags, distance/date-line behavior, upstream outages and partial results, caching, report validation/moderation/expiry, keyboard focus, explicit local saves, and structural accessibility with axe in jsdom. Automated checks are not a screen-reader, real-browser, visual-contrast, or field audit. See [readiness](docs/readiness.md) for actual receipts and limitations.

## Reports and moderation

```sh
npm run moderate -- list
npm run moderate -- approve REPORT_UUID 'Checked the dated closure notice against source information'
npm run moderate -- reject REPORT_UUID 'Insufficient detail to support this observation'
npm run moderate -- prune
```

Review types and visit dates are public for **14 days from the observation date**, not the approval date. Free-text notes stay private and are removed after 90 days, along with report audit rows. Moderation decisions are transactionally recorded. Reports older than 90 days, future dates, unknown IDs, and water-safety reports on toilets are rejected. There is no automatic modification of OSM, and no published report claims an official water test. Follow the [moderation runbook](docs/operations.md).

## Deploy when ready

```sh
npm run build
# Set real values in .env first. HTTPS terminates at your reverse proxy.
npm start
```

One Node process serves the built frontend and same-origin JSON API. Set `PUBLIC_ORIGIN`, a real identifying/contact `UPSTREAM_USER_AGENT`, `DATABASE_PATH` on a persistent volume, and exact `TRUST_PROXY_HOPS` if applicable. Bind to `0.0.0.0` only for deployment. A Dockerfile is provided but has not been built in this session. Production startup rejects missing HTTPS origin or identification. Keep reports disabled unless someone operates the queue. See [operations](docs/operations.md) for backups, retention, policy limits, and rollback.

## Layout

| Path | Responsibility |
| --- | --- |
| `src/` | React interface, lazy Leaflet map, reports and details |
| `shared/` | Public model, input schemas, strict filters and evidence rules |
| `server/` | Express API, OSM normalization/proxy, SQLite cache and moderation |
| `scripts/moderate.ts` | Host-only moderation command |
| `public/offline.*`, `public/sw.js` | Small independent offline list; no tile caching |
| `tests/` | Domain, API, provider and UI checks |
| `docs/` | Research, source policy, operations and readiness |

Contributions should improve public access without guessing missing facts. Check field-level provenance and licensing before importing another dataset. Report security issues through the repository's private vulnerability reporting if enabled, otherwise request a private channel without posting sensitive details in an issue.
