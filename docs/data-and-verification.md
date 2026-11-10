# Access, provenance and edge cases

## Ground rules

A location pin is not a promise. The app never equates a fresh download, a database edit, an on-site check, a working outlet, an accessible entrance, and safe drinking water. It does not score user trust or call a place officially verified.

## Implemented behavior

| Case | Behavior |
| --- | --- |
| GPS denied, timed out or inaccurate | Manual place / coordinate entry remains available; approximate accuracy is explained. GPS is never watched continuously. |
| No mapping / no strict filter matches | Distinguish no mapped matches from a data-source outage; do not claim no facilities exist. Clear filters or search elsewhere. |
| Private/no/military access | Excluded, including explicit parent restrictions. |
| Customer, ticket, permit, key, conditional access | Hidden by default; opt-in reveals restrictions as source text. Unknown access is visible and labelled, not treated as confirmed public. |
| Missing fee, accessibility, hours, gender or bottle tags | Unknown. Strict filters require explicit source support; “limited” wheelchair access does not pass a full-access filter. |
| Conditional fee/access/wheelchair or seasonal hours | Conditions retained or treated conservatively as unknown; never unconditionally advertise free / accessible / 24-hour. |
| Opening hours, holidays, timezone, DST, seasonal closures | Display original source hours. There is deliberately no “open now” calculation; that needs full OSM hours semantics plus local context. |
| Generic fountain, water tap, water point or spring | Excluded unless explicitly mapped drinkable. A toilet sink is not automatically a water point. Conditional or non-drinkable water is excluded. |
| Water marked drinkable | Label as mapped drinkable, not tested. On-site signs and public-health advisories take precedence. |
| Inactive/disused records | Obvious disused / abandoned / demolished / construction tags are excluded. Lifecycle-only keys do not match the query. |
| Two genuinely separate nearby facilities | Remain separate; stable OSM type/ID deduplicates repeat query results. There is no unsafe proximity merge that might erase distinct accessible toilets or fountain outlets. |
| Node vs building geometry | Nodes use coordinates; ways/relations use source centers. Centers may not be entrances. No step-free route guarantee. |
| Search near the date line | Radius search uses spherical distance, not a broken west/east bounding box. |
| Polar regions | Reject outside ±85° with a clear message; Leaflet's Web Mercator map has practical latitude limits. |
| Boil notices, vandalism, closed gates, queues | Not known automatically. Recently reviewed cautions are prominent but not a complete real-time alert service. |
| Conflicting reviewed reports | Both remain visible; caution wins prominence. A positive visit never cancels a warning. Cautions remain represented even with many positive reports. |
| Stale cache / offline snapshot | Explicit dated stale label. Offline independent page shows unexpired saved observations and retains expired water warnings as historical cautions; it excludes restricted places. No offline basemap. |
| Tile errors / map import failure | List remains usable; map provides an error/retry path. |
| Rate limiting or partial Overpass output | Error or labelled stale fallback, never silent empty-success. One concurrent upstream query, bounded radius and response bytes. |
| Report retries, invalid/malicious input | UUID idempotency, schema validation, empty spam-trap payload field, 8 KB body limit, request/report rate limits. No public free text or photos. |
| Changing access or disappearing records | Report and correct the OSM source; cached data refreshes after TTL. The app does not silently edit the global map. |

## Source dates

- `fetchedAt`: app download time. It measures cache age only.
- `sourceEditedAt`: OSM element edit timestamp. It is not a visit.
- `sourceCheckedAt`: valid `check_date:opening_hours`, `check_date` or `survey:date` claim. May refer to only part of the record. Future/invalid dates are rejected.
- Community `observedOn`: contributor's claimed visit day, with a moderation date kept separately. Public prominence expires 14 days after that day (UTC).

## Inclusion and accessibility

Target WCAG 2.2 AA, while stating the verification limits. There is a skip link, native labelled controls, pressed states, visible keyboard focus, full list-based selection, focus transfer/restoration, reduced-motion and forced-colour support. Map markers are supplemental rather than hundreds of tab stops. Directions warn that third-party routes may contain barriers. No account, paywall, GPS requirement or app-store installation is needed.

Wheelchair mapping does not establish a Changing Places facility, adult changing bench, hoist, transfer direction, doorway width, hearing loop, sensory suitability, queue length or accessible route. Do not infer these from one boolean. A future detailed accessibility schema needs co-design and field evidence, not automatic guesses. The initial interface is English; worldwide language coverage and translation review remain future work. JavaScript is required for the connected application; the lightweight saved page provides a reduced offline experience.

## Report publication and licences

Notes are private moderation material, not a public review wall. Only the approved category, observation day, review timestamp and expiry enter the public API. Moderate factual observations only; no identity, personal safety judgement, door code or water laboratory claim should be published. For now these are a separate application overlay. Before redistributing a joined database or importing another source, resolve database licensing obligations and define a contributor data licence; the MIT code licence alone is insufficient.
