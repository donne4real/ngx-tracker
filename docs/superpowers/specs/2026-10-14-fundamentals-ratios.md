# Fundamentals Ratios via Kobo — Spec

**Date:** 2026-10-14 · **Status:** SUPERSEDED — owner ruled out all paid plans (free app, ₦0 budget). See §8 for the free-only pivot.
**Context:** v1 design (`2026-09-25-ngx-tracker-design.md` §1) put company financials out of scope. Owner chose ratios-via-Kobo on 2026-10-14 after a live probe confirmed both free keys are blocked (Kobo `/fundamentals` → 403 "Starter tier or above"; EODHD `/fundamentals/MTNN.XNSA` → 403 "Only EOD data allowed for free users"). Pricing check: Kobo Starter API is ₦29,000/mo (website Starter ₦7,500/mo does NOT include API) — rejected, budget is ₦0.

## 1. Goal

Show per-stock valuation/profitability/dividend ratios on the tracker: PE, forward PE, EPS, DPS + yield, ROA/ROE, PB, debt/equity, margins, beta, 52w change. No full statements (that needs EODHD paid Fundamentals; XNSA statement depth is thin anyway).

**Blocker:** requires a Kobo Starter (or higher) API key. Until the key is upgraded, the pipeline must treat 403 as skip-with-warning, not failure.

## 2. Source

| Endpoint | Shape (per-symbol, documented) | Budget |
|---|---|---|
| `GET /api/ngxdata/fundamentals` (bulk, all ~145 in one request; `?symbols=` filter available) | `{ success, fundamentals: { symbol, pe_ratio, forward_pe, eps, dividend_per_share, dividend_yield, beta, 52w_change, roa, roe, pb_ratio, debt_equity, profit_margin, gross_margin, …extended } }` | +1 Kobo request per run (Personal allows 100/day; Starter same or higher) |

**Unknown:** exact bulk envelope (array vs keyed object). Verify with one live call after the key upgrade and pin the shape in a fixture before implementing the parser.

## 3. Pipeline

- New `pipeline/src/fundamentals.ts`: `fetchFundamentals()` + `parseFundamentals()` with strict validation (unknown fields ignored, missing ratios → null, never throw on partial rows; throw `ValidationError` only if the whole envelope is wrong).
- `runDaily`: call after the Kobo snapshot append, before `buildSummary`. On 403 → push `report.warnings` ("fundamentals skipped: key needs Starter tier") and continue with previously stored ratios. Other HTTP errors → same skip-with-warning (ratios are enrichment, never block prices).
- Store: new `data/fundamentals.json` → `{ asOf: ISODate, stocks: Record<symbol, Ratios|null> }`, pretty-printed like `stocks.json`. Written atomically via `DataStore.writeText` (tmp+rename, already in place).
- `report.json`: add `fundamentals: { updated: boolean, count: number }` next to `backfill`.
- Cadence: ratios move slowly — fetch daily is fine at 1 call, but a weekly refresh is enough. Start daily (simpler, same code path); revisit if Starter quota is tight.

## 4. Web

- Phase 1 (display): PE, EPS, Div yield columns in `StockTable` (hidden on small screens like other extra columns); valuation card on `StockPage` with `—` for missing values (reuse `formatPct`/new `formatRatio` guards).
- Phase 2 (later): sort/filter by PE, yield, ROE. Not in this change.
- Types: extend `SummaryRow` with `ratios: Ratios | null`; `api.ts` validation accepts old files (ratios absent → null) so the current `summary.json` keeps loading.

## 5. Tests

- `fundamentals.test.ts`: bulk-envelope parse, partial-row nulls, 403 skip path in `runDaily` (free key keeps old ratios, run still `appended`).
- Fixture: real bulk response saved after the key upgrade (redacted key, obviously).

## 6. Rollout

1. Owner upgrades Kobo key (local `.env` + `KOBO_API_KEY` GitHub secret).
2. One live `curl` of the bulk endpoint → confirm envelope → save fixture.
3. Implement parser + store + report + web phase 1 behind the 403-tolerant path.
4. `npm test`, `typecheck`, daily-run dry-run (`--data-dir ../.dryrun`), commit, push.

## 7. Open questions

- Starter quota details (requests/day) — confirm 1 extra call/run is negligible.
- Whether extended metrics (F-score, RSI, consensus) are worth storing or just the core ratios above.

## 8. Free-only pivot (2026-10-14, after the ₦0 decision)

Live probes on the free key found two usable sources, no upgrade needed:

1. **Unused `/stocks` fields (0 extra calls).** The live snapshot already returns `previous_close`, `change_percent`, `official_change_percent`, `pct_change_7d`, `shares_outstanding` — the pipeline stores only close/volume. Note: `pe_ratio` is documented but **absent** from the live response (0/146 rows), so no free PE.
2. **`/dividends/:symbol` works on free (200).** GTCO returned 11 records: `ex_dividend_date`, `record_date`, `pay_date`, `dividend_per_share`, `currency`, `raw_declared_text` (interim/final + announcement ref), `company_name`. Per-symbol, 1 call each → batch like the EODHD backfill (e.g. ~20/run inside the 100/day free budget; full universe in ~8 runs, then refresh stale/new only since dividends change rarely).

Proposed scope: store snapshot extras in `stocks.json`/history bars + `data/dividends/<SYM>.json` with trailing-12m DPS and computed yield (DPS ÷ latest close) surfaced in the table and stock page. Full fundamentals spec above stays as the paid-upgrade path if the budget ever changes.
