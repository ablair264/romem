# Archive

## Week of 2026-05-12

Built DigitalTerms scraper (Playwright auto-login, GH Actions cron) and fixed Node 22 tsc compat. Completed vehicles Phase 1 consolidation (5,314/5,359 Santander matched, 5,262 enriched via Codeweavers, 92% gap reduction); integrated CALAS export pipeline and Gemini vision extraction. Designed lease_quotes schema (W2 cycles, ratebook pre-qual); spec audit identified 10 critical conflicts (rates variants, VWFS gaps, infra migrations, duped satellites, Cloudflare→Decodo); executed 16 remediation tasks (fixed quoted_rates schema/FKs/ordering, Santander crashes, wired funder_ratebook writes across Lex/Ogilvie/Santander, restored pre-qual); impl'd lease_quotes serving+Redis, builds live.

## Week of 2026-05-05

Completed Santander cap code import (5,314/5,359 matched) and designed 2-phase vehicles cleanup strategy. Executed Phase 1 SQL consolidation (manufacturers/models/transmission/fuel); prepped Phase 2 for Codeweavers enrichment. Ran enrich-specs pipeline (5,262/5,463 enriched, 92% gap reduction); resolved transmission/fuel_type via SQL pattern matching and identified CO2/doors as remaining targets for EVs and commercial vehicles.

## Week of 2026-04-21

Built matrix-parser.ts with stacked-row parsing for Stafford Audi's table-based rate format, fixing incompatibility with Arbury's single-price structure. Integrated Gemini vision extraction for rate PNGs with DOM detection and parallel fallback. Fixed export pipeline: missing saveCalasExportSheet call and Neon 500 errors. Core pattern: format-adaptive parsing paired with vision-based data extraction for document ingestion.
```