# NGX Tracker

A private website showing every Nigerian Exchange (NGX) stock's latest end-of-day close, day/week/month changes, top gainers and losers, and price history.

- **Data:** Kobo Terminal (free Personal plan) for the daily all-stocks close; EODHD (free plan) for about a year of history before tracking began. Both free plans are for **personal use**: keep the site private.
- **How it runs:** a GitHub Actions job on weekdays (15:30 and 18:00 UTC) saves the day's prices once Kobo reports the market closed, commits them to `data/`, and deploys the static site to Cloudflare Pages behind Cloudflare Access.
- **Design:** `docs/superpowers/specs/2026-09-25-ngx-tracker-design.md`

## Local setup

1. Node 22 or later. `npm ci`
2. Copy `.env.example` to `.env` and fill in `KOBO_API_KEY` and `EODHD_API_KEY`. `.env` is git-ignored: never commit it.
3. Tests: `npm test` · types: `npm run typecheck`
4. Try the pipeline without touching `data/`: `npm run pipeline -- --data-dir ../.dryrun --backfill 1`
5. Site: `npm run dev -w web` (reads `data/`, copied into `web/public/data`).

## GitHub secrets

`KOBO_API_KEY`, `EODHD_API_KEY`, `CLOUDFLARE_API_TOKEN` (a token with **Account → Cloudflare Pages → Edit**), `CLOUDFLARE_ACCOUNT_ID`.

## Private access (Cloudflare Access)

In the Cloudflare dashboard: **Zero Trust → Access → Applications → Add an application → Self-hosted**.
- Application domains: `ngx-tracker.pages.dev` **and** `*.ngx-tracker.pages.dev` (the second covers per-deploy preview URLs, which are otherwise public).
- Policy: **Allow**, include **Emails**: the addresses you want to let in. Login method: **One-time PIN**.
- To add or remove someone later, edit that policy's email list.

## Daily data

- `data/summary.json`: everything the home page needs
- `data/history/<SYMBOL>.json`: one file per stock, one bar per line
- `data/stocks.json`: tracked stocks, status (active/inactive) and backfill progress
- `data/report.json`: the last run's outcome, backfill results and warnings

A run where Kobo says the market is still open, or the trade date is already stored, changes nothing. GitHub emails you if a run fails. If a deploy fails, start the workflow by hand (Actions → Daily prices → Run workflow): a manual run always rebuilds and redeploys.
