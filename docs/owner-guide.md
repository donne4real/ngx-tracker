# NGX Tracker — Owner's guide

Everything you need to run, look after and change NGX Tracker. Day to day, **you don't need to do anything** — it updates and republishes itself.

## 1. The moving parts

| Part | What it does | Where you manage it |
|---|---|---|
| **GitHub repository** `donne4real/ngx-tracker` (private) | Holds the code **and every day's prices** (`data/`), and runs the scheduled jobs | github.com → the repo → **Actions**, **Settings** |
| **Kobo Terminal** (free Personal plan) | Today's closing price for every NGX stock — 1 request per day | koboterminal.com |
| **EODHD** (free plan) | About a year of past prices per stock, filled in once | eodhd.com dashboard |
| **Cloudflare Pages** project `ngx-tracker` | Hosts the website at https://ngx-tracker.pages.dev | dash.cloudflare.com → Workers & Pages |
| **Cloudflare Access** app "NGX Tracker" | Email sign-in; only allow-listed addresses get in | one.dash.cloudflare.com (Zero Trust) → Access |
| **Your PC** `ZCodeProject\ngx-tracker` | A working copy of the code, plus `.env` with your keys | — |

## 2. The schedule (all automatic)

| When (UTC) | Lagos time | Job | What it does |
|---|---|---|---|
| Mon–Fri 15:30 | 16:30 | Daily prices | Saves today's closes once Kobo says the market is **closed**, fills in ≤18 stocks of history, republishes |
| Mon–Fri 18:00 | 19:00 | Daily prices (backup) | Same; does nothing if the 15:30 run already saved today |
| Sat & Sun 12:00 | 13:00 | History only | ≤18 more stocks of past-year history from EODHD; no new prices; republishes |

GitHub sometimes starts scheduled jobs 5–20 minutes late; that's normal. Kobo reports the market closed at about **15:26 UTC**, so the 15:30 run occasionally lands too early — it then saves nothing and the 18:00 run does the day's work.

**History fill-up (first ~9 runs):** 18 stocks per run, largest companies first. Tracking started Fri Sep 25, 2026, so all ~146 stocks have their year by about **Sun Oct 4, 2026**. After that, EODHD isn't used again unless a new stock lists.

## 3. Accounts, keys and secrets

| Secret | From | Stored in |
|---|---|---|
| `KOBO_API_KEY` | koboterminal.com/api → key request form (Personal / Learning) | `.env` on your PC + GitHub secret |
| `EODHD_API_KEY` | EODHD dashboard (same key as the old `ngx-screener`) | `.env` + GitHub secret |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → custom token with **Account · Cloudflare Pages · Edit** | `.env` + GitHub secret |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard, account overview | `.env` + GitHub secret |

- **`.env` is git-ignored** and must never be committed or shared. Keep a copy in a password manager.
- GitHub secrets live at **repo → Settings → Secrets and variables → Actions**. GitHub never shows a secret's value again; you can only replace it.

**Replacing a key** (e.g. if it leaked or expired): create the new key at the provider, update `.env`, then either replace it on the GitHub secrets page, or ask Claude to run `gh secret set <NAME>` from `.env`. Revoke the old key at the provider.

## 4. Adding or removing people

1. Open **https://one.dash.cloudflare.com** → **Access** → **Policies** → **Family and friends**.
2. Edit the **Include → Emails** list: add or remove addresses.
3. Save. It takes effect within a minute. Someone removed is locked out when their 24-hour session ends (or sooner if you revoke sessions under **Access → Users**).

The free Zero Trust plan allows up to **50 users**.

## 5. Checking that it's working

- **The site header** shows "Prices as of <date>". On weekdays after ~16:30 Lagos time it should be today (or the last trading day).
- **GitHub → Actions → Daily prices** lists every run with a green ✓ or red ✗. Open a run → **update** → **Fetch prices** to see lines such as:

| Line | Meaning |
|---|---|
| `Outcome: appended (trade date …)` | Today's prices were saved ✓ |
| `Outcome: market-open` | Ran before Kobo reported the close; nothing saved; the next run will do it |
| `Outcome: not-final` | Kobo's data was taken before the close; nothing saved |
| `Outcome: duplicate-date` | Today was already saved (backup run, weekend or holiday) |
| `Outcome: backfill-only` | Weekend history run |
| `Backfill: N ok, M failed` | History filled in this run |
| yellow **EODHD backfill paused** warning | EODHD's daily limit was hit, or it rejected the key / was down — it resumes next run without using up retries |

- **`data/report.json`** in the repo shows the last run's outcome, which stocks were backfilled, and any failures or warnings.
- **`data/stocks.json`** shows each stock's `backfill` status (`pending`, `done`, `failed`) and whether it's `active` or `inactive`.

## 6. When something goes wrong

GitHub emails you whenever a run **fails**. Most failures are one-offs and the next run fixes them.

| Symptom | Likely cause | What to do |
|---|---|---|
| Email: run failed at **Fetch prices** with `Kobo HTTP 401/403` | Kobo key revoked/expired | Get a new Kobo key; replace `KOBO_API_KEY` (section 3) |
| Failed at **Fetch prices** with `Kobo response has no stocks array` / `Only N valid stocks` | Kobo outage or changed its data format | Wait for the next run. If it persists for days, check koboterminal.com; the code may need updating |
| Failed at **Deploy to Cloudflare Pages** | Cloudflare hiccup or token expired | Actions → Daily prices → **Run workflow** (a manual run always republishes). If it keeps failing, replace `CLOUDFLARE_API_TOKEN` |
| Failed at **Commit data** (push rejected) | Someone pushed to `main` during the run | Nothing — the next run redoes it |
| "Data may be out of date" banner on the site | No successful run for 4+ working days | Check Actions for red runs and read the error |
| Yellow "EODHD backfill paused" for days | EODHD key rejected or plan changed | Check the EODHD dashboard; replace `EODHD_API_KEY` |
| A stock never gets history (`backfill: failed`) | EODHD doesn't carry that symbol | Nothing — it builds history from Kobo, one day at a time |
| Everyone suddenly can't sign in | Access app or policy changed | Zero Trust → Access → Applications → NGX Tracker; check the policy is attached |

**Republish without fetching new data:** repo → **Actions** → **Daily prices** → **Run workflow** → Run. (On a weekday this also checks Kobo; if today is already saved it just rebuilds and republishes.)

**Pause everything:** Actions → Daily prices → **⋯ → Disable workflow**. Re-enable the same way.

## 7. Costs and limits

| Service | Plan | Limit that matters | Current use |
|---|---|---|---|
| Kobo Terminal | Personal (free) | 100 requests/day, personal use | 1–2 per weekday |
| EODHD | Free | 20 requests/day; ~1 year of history | ≤18/day until history is complete, then ~0 |
| GitHub | Free, private repo | 2,000 Actions minutes/month | ~2 minutes per run → roughly 150 min/month |
| Cloudflare Pages | Free | 500 builds/month | ~30/month |
| Cloudflare Access | Zero Trust Free | 50 users | your allow-list |

**Licensing:** the free Kobo and EODHD plans are for **personal use**. Sharing privately with family and friends is the intended use here. **Before making the site public, or charging for it, switch to a paid plan that licenses redistribution** (e.g. Kobo Professional or Mansa Markets' $50/month tier) — the design already allows swapping sources.

## 8. Known limitations

- **End-of-day only**, once per weekday — not live.
- **Price-only changes** — dividends aren't included; bonus issues and splits aren't adjusted for (flagged ⚠ when a single day moves more than ±10%).
- **The ±10% flag only covers one-day moves**; a split inside a week/month/year window can distort those figures without a flag.
- **Market summary counts** (Rose/Fell/Unchanged) are NGX's official figures and won't necessarily add up to the table's total.
- **A stock missing from Kobo for up to 9 days** still shows its last known price, without a date marker (after 10 days it becomes inactive).
- Minor rough edges noted for later: a malformed link like `#/stock/%E0` shows a blank page; an expired sign-in can show "Failed to fetch" (reload to sign in again); chart colours don't switch if you change light/dark mode while the page is open.

## 9. Maintenance to-do

- **GitHub Actions versions:** GitHub warns that `actions/checkout@v4` and `actions/setup-node@v4` run on a deprecated Node version. Update both workflows to the current major versions before GitHub's deadline.
- **Local branches** `build/v1` and `feat/longer-periods` are merged into `main` and can be deleted.
- Once a year, check dependency updates: `npm outdated`, update, run `npm test`, push.

## 10. Making changes

The simplest way is to ask Claude (in this project folder) for the change. For hands-on work, see the [Developer guide](developer-guide.md). Useful commands from `ZCodeProject\ngx-tracker`:

| Command | Does |
|---|---|
| `npm ci` | Install everything (once, or after pulling changes) |
| `npm test` | Run all tests |
| `npm run pipeline -- --data-dir ../.dryrun --backfill 1` | Try the daily job without touching `data/` (spends 1 Kobo + ≤1 EODHD request) |
| `npm run dev -w web` | Run the site locally with the latest `data/` |
| `git pull` | Bring down the bot's daily data commits before making changes |

Always `git pull` before editing — the bot commits to `main` every day.
