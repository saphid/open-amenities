# Readiness record

Initial build: 10 November 2026. This is a working repository and pilot implementation, **not a launched public utility**. No production host, domain or service was deployed. The product's promise depends on data quality and operations as well as code.

## Implemented and locally checked

- [x] Public repository with MIT application code; separate ODbL attribution for source data.
- [x] Live-source provider, bounded queries/cache, explicit failures and stale fallback.
- [x] Account-free search, optional GPS, opt-in map, complete list, detail provenance, external directions and location sharing.
- [x] Conservative access and potability normalization; strict filters never promote unknown values.
- [x] Private report queue, moderator CLI, idempotent retry, input limits, expiring public summaries and private-note retention.
- [x] Explicit local snapshot, independent offline list and removal control; no tile prefetch.
- [x] Automated checks for domain rules, API boundaries, provider behavior and UI flows.
- [x] Type checking and production asset build.
- [x] Automated structural accessibility checks with axe in jsdom for results and details.
- [x] Runtime dependency audit: no reported vulnerabilities at build time.
- [x] CI workflow for checks, build and runtime audit.

Detailed verification and independent-review receipts are appended below after the frozen build is checked.

## Before a public pilot

- [ ] Choose a host, real HTTPS origin, operator contact, data/privacy route and explicit ownership for ongoing maintenance.
- [ ] Browser QA on current Safari/iOS, Chrome/Android and desktop Firefox: map activation/panning, GPS denial/timeouts, clipboard fallback, shared links, report dialog, offline service-worker reload, storage blocking and 200%/400% zoom.
- [ ] Human VoiceOver / TalkBack / keyboard audit and measured contrast/reflow review. No accessibility conformance claim until these pass.
- [ ] Field-check at least one dense urban and one sparse/regional area, with wheelchair users and people relying on inclusive facilities. Check entrances, overnight/seasonal/key access and water notices; document missing coverage.
- [ ] Staff moderation, set response expectations and privacy/removal route, and only then enable reports. Resolve public contributor-data terms before redistributing report data.
- [ ] Verify reverse-proxy identity/rate limits, log redaction, HTTPS/CSP, database volume permissions, backup/restore and retention for backups.
- [ ] Exercise a deployed outage and offline recovery. Build/run Docker if it is the chosen deployment path.
- [ ] Verify provider capacity/terms with expected traffic. Public Nominatim limit is per entire app, not per user; this design must remain single-process against that endpoint.

## Before broad release

- [ ] Dedicated/contracted geocoding and tiles, regional OSM ingestion / replication, shared abuse controls and monitoring.
- [ ] Versioned schema migrations and load/restore testing.
- [ ] Reviewed government/council source adapters with per-release licences, original provenance, entrance handling, conflicts and update cadence. None is implemented or silently merged now.
- [ ] Localisation and community review for priority languages and specific accessibility needs.
- [ ] Moderation capacity, appeals/takedown workflow and security reporting route verified in practice.

## Scope decisions

No guessed “open now”, water-quality guarantee, accessible routing, crowd cleanliness ranking, automatic OSM writes, public photos or comments, account system, advertising, background GPS, or bulk offline tiles. These choices keep the first version useful and make its limits visible. Geographical coverage comes from OSM and varies; a working global query is not worldwide field validation.

## Verification receipts — 10 November 2026

- `npm run check`: **40 tests passed** across four files, TypeScript passed, production Vite build passed. These use mocked upstream responses; they do not establish current real-world coverage.
- `npm audit --audit-level=high`: **0 vulnerabilities** after updating the test runner to remove vulnerable development dependencies. This is a time-of-check result.
- Static React shell rendered at desktop width for visual inspection. This validates the initial visual structure only; no map, network, GPS, or browser interactions were exercised by that render.
- Live Overpass checks from this Mac **did not succeed**: the default endpoint and a documented alternative timed out / surfaced unavailability; a small independent curl probe also timed out. DNS resolved; no proxy environment was configured. The exact external/network cause was not established. No live result count or completeness claim is made. Mocked success, timeout, partial-200, cache and stale-fallback paths pass their tests. Live provider verification is a pilot gate.
- Node's experimental SQLite warning and jsdom's missing canvas implementation were observed. Axe color-contrast checks were disabled because jsdom cannot measure rendered contrast; human/browser contrast checks remain required.
- `npm run test:smoke`: **passed** using a real production-mode child process and an in-memory database: health, built HTML/JS assets, CSP, configuration, offline files, malformed input, and disabled reports. The child exited after the check. No upstream was queried.
- Phone static shell inspected at 390 CSS pixels as well as desktop 1200 pixels, with no console output from the renderer. This is design inspection, not real-browser functional QA.

Work continues in [#1](https://github.com/saphid/open-amenities/issues/1) for public pilot readiness.

## Independent review and corrections

First review completed through T3 by provider `claudeAgent`, actual model `claude-opus-5-5`, effort `high`, status `completed`. Task ID: `node:delegated-task:command%3Amcp%3A99fcf49b-272c-4962-b534-4f19598e6232%3Adelegate-task%3Aafdd70b0-a53b-4d1b-a4a8-f41a1041e0c7`.

The reviewer inspected `shared/`, `server/`, `src/`, `public/`, `scripts/`, the Dockerfile and CI. No coding-standards file exists in this new repository. Nine actionable findings were verified and corrected:

1. Added a composite index for report lookups, with a query-plan regression check.
2. Preserved unexpired water warnings in the independent offline page; expired saved water warnings remain explicitly historical cautions.
3. Used the conservative `aroundTheClock` result on list cards rather than raw `24/7` source text.
4. Restored known-place records when serving cached/stale searches, so eviction cannot make visible places permanently unreportable.
5. Distinguished coordinate share links from ordinary `#about` / `#results` fragments.
6. Prevented an older GPS callback from overriding a later manual search.
7. Combined caller cancellation with the request deadline.
8. Normalized and validated the production origin to avoid trailing-slash report failures.
9. Shared a coarser grid cache while projecting results and distances back to each rounded user center. Queries cover 4 km to contain each requested 3 km radius without trimming cell-edge results.

After corrections: **55 tests in seven files passed**, TypeScript/Vite build passed, and the real production smoke passed. A fresh review of the corrected target follows before commit/push.

Second review completed by the same actual provider/model (`claudeAgent` / `claude-opus-5-5`, high), status `completed`, task `node:delegated-task:command%3Amcp%3A99fcf49b-272c-4962-b534-4f19598e6232%3Adelegate-task%3Ac734a6e4-1847-4ca2-a9a4-c85528cfc90d`. It verified eight of the nine original fixes and found three remaining edge cases. All were corrected:

- Historical unsafe-water cautions now appear in both the independent offline page and the in-app saved-area list/details.
- Client deadlines use a linked AbortController and timer, compatible with browsers that lack `AbortSignal.any` or `AbortSignal.timeout`.
- The 2,000-place user-result cap is applied after the requested 3 km projection, rather than to the larger shared cache cell. Upstream element count and byte limits still bound the cell response.

Final focused checks after these corrections: **57 tests in seven files**, TypeScript/Vite build and the actual production smoke passed.

Third focused review completed (`claudeAgent`, actual `claude-opus-5-5`, high; status `completed`), task `node:delegated-task:command%3Amcp%3A99fcf49b-272c-4962-b534-4f19598e6232%3Adelegate-task%3A9793271c-02b8-423c-bc8a-a52fba5be785`. It reproduced an HTTP-200/body-read timeout being returned as fake result data and found historical warning text taking prominence over a separate active closure. Both were corrected. JSON parse failures now reject, preserving timeout/cancellation errors; map and place-search responses and saved snapshots are validated before use. Active cautions and historical unsafe-water cautions have separate labels and notices.

Latest verification: **61 tests across seven files**, TypeScript/Vite build and production smoke all passed. Tests now cover captive-portal/non-JSON success responses, timeouts during body reading, invalid JSON payload shape, and simultaneous active closure / historical water warnings. No live-provider or field-verification claim is made.

Final fresh review: provider `claudeAgent`, actual model `claude-opus-5-5`, effort `high`, final status **completed**. Task ID: `node:delegated-task:command%3Amcp%3A99fcf49b-272c-4962-b534-4f19598e6232%3Adelegate-task%3A01031227-6722-4d35-b4b3-26ae99d1e137`.

**No actionable findings** in the exact corrected target: `src/api.ts`, new schemas in `shared/model.ts`, response/restore validation and caution tags in `src/App.tsx`, caution notices in `src/components/Details.tsx`, and related tests. The independent reviewer also ran 61 tests across seven files and TypeScript successfully. The complete initial code scope had been reviewed earlier; the fresh passes verified subsequent corrections. Production build and server smoke were verified by the parent. Public live-provider connectivity, real-browser/assistive-technology behavior and field accuracy remain unverified as recorded above.
