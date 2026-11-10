# Existing work and the product decision

Research checked 10 November 2026. This is a bounded landscape review, not a claim that these are the only products. Product descriptions below come from their own websites, not hands-on audits. No competitor dataset or UI code was copied.

## What exists

| Service | What it already does | Implication for this project |
| --- | --- | --- |
| [Toilet Zone](https://toilet.zone/en-us/about) | Combines nearby restrooms and drinking water on OSM; fee labels, restricted venues, directions and sharing | Combining two POI types is already established. Build for clarity and verifiability, not a novelty claim. |
| [Australian National Public Toilet Map](https://www.health.gov.au/resources/apps-and-tools/national-public-toilet-map-app) | Government service with more than 19,000 publicly available toilets, opening hours, accessibility, baby change and other facility details | Strong Australian alternative and candidate enrichment source. Link to it now rather than implying our global OSM subset is more complete. |
| [REFUGE Restrooms](https://www.refugerestrooms.org/about) | Trans-led service for safe restroom access for transgender, intersex and gender-nonconforming people; community listings and feedback | Inclusion needs specific access information and community care. A unisex tag alone does not establish safety. |
| [Wheelmap](https://wheelmap.org/) | Finds wheelchair-accessible places | Disability access is a distinct problem from public access. Do not reduce it to a marketing badge. |
| [Refill Return](https://www.refill.org.uk/) | Public fountains and participating businesses offering water refills, plus other reuse options | Shops can be useful, but participating refill access and purchase/customer conditions must remain explicit. |
| [Wayside](https://wayside.cc/) | OSM-based map including toilets, drinking water and other outdoor amenities | Another combined-map precedent; avoid reproducing a broad travel directory. |

## Initial direction

A small global web app, beginning with a clearly labelled Sydney starting area. It requires no account or installation. The list is a complete alternative to the map. User GPS is optional and only requested on a button press. The map is opt-in to reduce data use and third-party disclosure. All public listing details link to their source. Unknown details remain unknown, even when that means fewer matches under strict filters.

The meaningful bet is that honest evidence, access conditions, low-friction use, and a careful correction workflow can improve the experience. This remains a product hypothesis. No interviews or field trials occurred in this build.

## Sources and licensing

1. **OpenStreetMap** is the only implemented facility source. [ODbL and attribution](https://www.openstreetmap.org/copyright) apply to the source database and extractions, independently of the MIT application code. Preserve attribution and applicable share-alike obligations for database redistribution. Read the [toilet tag](https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dtoilets), [toilets subkeys](https://wiki.openstreetmap.org/wiki/Key:toilets), and [drinking water tag](https://wiki.openstreetmap.org/wiki/Tag:amenity%3Ddrinking_water) before changing normalization. Missing access and wheelchair fields are common; water potability may be disputed or stale.
2. **Australian National Public Toilet Map**: its [copyright page](https://toiletmap.gov.au/copyright) directs reusers to the monthly data.gov.au release and that release's licence. The website itself has more restrictive reproduction language. [Brisbane's derived release](https://data.brisbane.qld.gov.au/explore/dataset/public-toilets-in-brisbane/) identifies CC BY 3.0 Australia for its source. Do not assume that licence from one derivative applies automatically to every release. Record and retain the current national resource URL, licence, attribution, schema and update timestamp before enabling an adapter. No government data is imported in this version.
3. **Council data**: [Melbourne toilets](https://data.melbourne.vic.gov.au/explore/dataset/public-toilets/) illustrate a possible local feed. Each dataset needs its own licence/schema/freshness check, stable source ID, entrance/geometry treatment and conflict policy. No blanket scraping.
4. **REFUGE / Refill**: open-source software does not automatically grant rights to another service's database. Link rather than merge until the specific database licence, API terms, update path and community consent expectations have been checked.

## Infrastructure decision

For development and a small pilot, use a configurable Overpass proxy, a single Node process and SQLite. [Overpass public instances](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances) have shared capacity; a failed or partial query is not “no facilities”. Public [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) requires app-wide throttling, explicit submit (no autocomplete), caching and identifying headers. Public [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/) prohibits bulk/offline tile prefetch and requires attribution and normal cache headers. This design follows those boundaries; none is a production SLA.

For a wider release, prefer a scheduled regional OSM extract into PostGIS, a contracted or self-hosted geocoder and a tile provider with agreed capacity. A shared rate limiter becomes mandatory before adding API replicas. Preserve the source-facing adapter boundary and replace provider configuration instead of changing the user flow.

## Prior-work checks

The bounded account repository scan and 45-entry portfolio registry did not identify an existing toilet/water product. PA Memory returned related mapping work (Dinner With Kids and Family Stay Finder) rather than a matching amenity project. These are limited, potentially incomplete signals; no existing repository was replaced or modified.
