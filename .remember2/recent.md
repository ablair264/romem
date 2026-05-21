# Recent

```

# Recent

## 2026-05-19

Migrated provider_rates → lease_quotes schema across 6+ systems (lex-ratebook-importer, importers, dashboard, vehicle-drawer-detail). Redesigned deal scoring (removed efficiency bonus, added percentile-rank + marketability modifier); expanded Worker 1 from 36m → 24/36/48m terms. Fixed fleet-procure stale-row deletion, corrected Santander/ALD/Lex importer derivation logic, recomputed universal deal_score across 5 cohorts, backfilled 22 top deals. Dashboard refactored (Top Deals header, score col, badges); FK constraint violations resolved.

## Identity Candidates
- IDENTITY CANDIDATE: Identifier-driven bulk vehicle data enrichment via phased SQL consolidation and variant-pattern matching
- IDENTITY CANDIDATE: Format-adaptive parser development paired with AI-powered (Gemini vision) data extraction