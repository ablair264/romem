# Archive

## Week of 2026-05-12

Built DigitalTerms scraper (Playwright auto-login, monthly cron, digitalterms_terms table) and fixed Node 22 compat. Designed lease_quotes schema (W2 cycles, ratebook pre-qual); audited spec (10 conflicts) and executed 16 remediations (schema/FKs, provider race, Santander crashes, importer derivation). Wired funder_ratebook writes, restored pre-qual, deployed lease_quotes serving with Redis (builds green). Fixed Santander vehicle matching (5,314/5,359), completed Phase 1 consolidation (mfr/model/transmission/fuel). Integrated Codeweavers enrichment (5,262 vehicles, 92% gap reduction) and Gemini vision extraction for CALAS export.

## Week of 2026-05-05

Completed Santander cap code import (5,314/5,359 matched) and designed 2-phase vehicles cleanup strategy. Executed Phase 1 SQL consolidation (manufacturers/models/transmission/fuel); prepped Phase 2 for Codeweavers enrichment. Ran enrich-specs pipeline (5,262/5,463 enriched, 92% gap reduction); resolved transmission/fuel_type via SQL pattern matching and identified CO2/doors as remaining targets for EVs and commercial vehicles.

## Week of 2026-04-21

Built matrix-parser.ts with stacked-row parsing for Stafford Audi's table-based rate format, fixing incompatibility with Arbury's single-price structure. Integrated Gemini vision extraction for rate PNGs with DOM detection and parallel fallback. Fixed export pipeline: missing saveCalasExportSheet call and Neon 500 errors. Core pattern: format-adaptive parsing paired with vision-based data extraction for document ingestion.
```