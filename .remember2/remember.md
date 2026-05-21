# Handoff

## State
Fixed Santander satellite 500 error: `runProviderWithSatellite` in `Backend/src/lib/auto-quote/service.ts` (lines ~2402-2412) was hardcoding `otrMode: 'custom'` even when `customOtrPence` was null (standard OTR runs). Satellite threw validation error → fell back to local silently. Fix: conditionally use `otrMode: 'standard'` when `customOtrPence === null`.

## Next
1. Deploy Backend to Railway so the fix goes live (git commit + push).
2. Monitor Railway logs for `[auto-quote] satellite santander failed` — should stop appearing.

## Context
The fallback to local meant quotes still worked, but every standard-OTR Santander AutoQuote wasted a satellite round-trip. Fix is surgical — one `service.ts` edit, no schema changes.
