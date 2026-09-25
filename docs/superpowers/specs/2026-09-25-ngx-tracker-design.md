# NGX Tracker — Design

**Date:** 2026-09-25 · **Status:** approved in conversation, awaiting written-spec review

## 1. Goal

A private website that tracks every stock listed on the Nigerian Exchange (NGX),
for the owner and a small group of family and friends who get a link.
It costs $0 to run.

**Success means:** every active NGX equity (~150) shows its latest end-of-day
close, and the day / week / month top gainers and losers are correct.

**Constraints:**
- End-of-day data only, refreshed once per trading day. Not live during trading.
- Free data plans are licensed for personal use, so the site stays private
  (email sign-in, approved addresses only). Going public or commercial would
  need a paid, licensed data plan first.
- Website only; no installable desktop app.
- The existing `ngx-screener` project is left untouched.

**Out of scope for v1:** watchlists, alerts, news, company financials, user
accounts, intraday prices, adjusting for corporate actions.

## 2. Architecture

One private GitHub repository, `ngx-tracker`, with three parts:

```
GitHub Actions (weekdays ~15:00 UTC = 16:00 Lagos, after the 14:30 close)
   │
   ├─ pipeline/  (Node + TypeScript)
   │     Kobo Terminal ── all-stocks snapshot (1 request) ──┐
   │     EODHD ──────── ≤18 history backfills/day ──────────┤
   │                                                        ▼
   │     data/stocks.json          (symbol list + metadata, status)
   │     data/history/<SYMBOL>.json (one file per stock, daily bars)
   │     data/summary.json          (latest close, changes, movers)
   │     data/report.json           (unmatched symbols, warnings, run log)
   │     → committed to the repo (versioned, plain text)
   │
   ├─ web/  (React + TypeScript + Vite) reads data/*.json at build time
   │
   └─ deploy: build web/ with the data → Cloudflare Pages
              Cloudflare Access in front (email one-time code, allow-list)
```

Secrets (Kobo key, EODHD key, Cloudflare token) live in GitHub Actions secrets,
never in the repo or the published site.

## 3. Data pipeline

### 3.1 Sources

| Source | Plan | Used for | Budget |
|---|---|---|---|
| Kobo Terminal `/api/ngxdata/stocks` | Personal (free, 100 req/day) | Daily close for all stocks | 1 request per run |
| EODHD `/api/eod/<SYM>.XNSA` | Free (20 req/day) | ~1 year of history before the first Kobo day | ≤18 requests per run, until every stock is backfilled |

The first implementation step makes a real Kobo request and records the
response shape. Field names in this spec are placeholders until then (see §7).

### 3.2 Daily run (idempotent)

1. **Fetch Kobo snapshot.** Validate it: at least 100 stocks, each with a
   symbol and a numeric close. If validation fails, exit with an error and
   write nothing. GitHub emails the owner about the failed run.
2. **Trading-date check.** If the snapshot's trade date is already stored,
   skip appending (weekend, holiday, or a re-run).
3. **Append** one bar per stock: date, close, and open/high/low/volume when
   available. Stocks with zero volume are stored with `traded: false`.
4. **Symbols.** New symbols are added to `stocks.json` automatically. A symbol
   missing from Kobo for 10 consecutive trading days is marked `inactive`,
   not deleted.
5. **EODHD backfill.** For up to 18 stocks with no backfill yet, request the
   year before that stock's first Kobo date. Store only dates *before* the
   first Kobo date, using EODHD's unadjusted `close`, so the sources never
   overlap. Kobo symbol `X` maps to EODHD `X.XNSA`; failures and mismatches
   go to `report.json` and are retried on the next run. EODHD errors,
   including the daily limit, never fail the run.
6. **Compute** changes and movers (§3.3) into `summary.json`.
7. **Commit** the data files, then build and deploy the site.

### 3.3 Definitions

- **Day change:** latest close vs the previous stored trading day's close.
- **Week change:** latest close vs the last close on or before (latest date − 7 calendar days).
- **Month change:** the same, on or before (latest date − 1 calendar month).
- A change is `null` if history doesn't reach back far enough.
- **Movers:** the top 10 gainers and top 10 losers per horizon, excluding
  stocks that didn't trade on the latest day, stocks marked inactive, and
  `null` changes.
- **Large-move flag:** a day change beyond ±10% (NGX's normal daily limit) is
  flagged as a possible bonus issue or split, because prices are unadjusted.
- **52-week high/low and average volume:** computed over the available
  history, and labelled with the period they actually cover.
- **Stale data:** if the latest trade date is more than 4 trading days
  before the build date, the site shows a "data may be out of date" banner.

## 4. Website

React + TypeScript + Vite, static, hash routing (`#/`, `#/stock/:symbol`).
It works on phones and follows the system light/dark setting. Charts use
TradingView `lightweight-charts` (Apache-2.0).

**Home page**
- "Prices as of <date>, end of day" header, plus the stale-data banner when it applies.
- Market summary: counts of stocks that rose, fell, were unchanged, or didn't trade.
- Top movers: Day / Week / Month tabs, top 10 gainers and top 10 losers side by side.
- All-stocks table: symbol, name, sector, last close (₦), day/week/month %, volume.
  Search by symbol or name, a sector filter, sortable columns. Rows link to the stock page.

**Stock page**
- Name, symbol, sector, last close, day/week/month change.
- Line chart with 1M / 3M / 6M / 1Y / All ranges.
- 52-week high/low and average volume, labelled with their period.
- A "history starts <date>" note, and the large-move flag where it applies.

## 5. Hosting and access

- **Cloudflare Pages** (free) serves the built site, deployed by the GitHub Action.
- **Cloudflare Access** (free tier, up to 50 users) protects the whole site:
  one-time email code, with an allow-list of addresses the owner manages.
- The repository stays private. GitHub Actions minutes on private repos are
  well within the free allowance for one short run per weekday.

## 6. Testing

- **Pipeline unit tests (Vitest)** against recorded real responses:
  - validation (accept and reject cases)
  - trading-date and holiday skip; idempotent re-run
  - change calculations, including `null`s and week/month boundaries
  - movers ranking and exclusions
  - EODHD merge (no overlap, unadjusted close, symbol mapping)
  - inactive marking
- **Web tests:** table search, sort and filter; stock page with short
  history; the build succeeds.
- **Pre-schedule dry run:** run the pipeline locally once with real keys and
  check the output before enabling the schedule.

## 7. Open items resolved during implementation

- **Kobo response format:** exact field names, and whether sector, volume
  and open/high/low are included. Confirmed by the first real request; if
  sector is missing, the sector column and filter are hidden.
- **EODHD free-plan history depth:** assumed about 1 year, based on the
  existing screener cache (about 248 bars per stock). Confirmed on the first
  backfill.
- **Accounts the owner creates:** Kobo Terminal (free Personal key) and
  Cloudflare. The existing EODHD key is reused as a GitHub secret. The key
  currently sits in `ngx-screener/config.json` in plain text and is never
  copied into this repo.
