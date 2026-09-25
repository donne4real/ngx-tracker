# NGX Tracker — Documentation

NGX Tracker is a private website that tracks every stock listed on the Nigerian Exchange (NGX): each stock's latest end-of-day closing price, how it has performed over the last day, week, month, 3 months, 6 months, year-to-date and year, and which stocks gained or lost the most.

**Site:** https://ngx-tracker.pages.dev (sign-in required) · **Code:** github.com/donne4real/ngx-tracker (private) · **Running cost:** $0

## Which guide do I need?

| If you are… | Read | It covers |
|---|---|---|
| **Someone using the site** | [User guide](user-guide.md) | Signing in, reading the pages, what the numbers and warnings mean |
| **The owner** | [Owner's guide](owner-guide.md) | How it runs by itself, accounts and keys, adding people, what to do when something fails, costs and limits |
| **A developer** (or an AI assistant) maintaining it | [Developer guide](developer-guide.md) | Architecture, data sources and files, every calculation, code layout, tests, deployment, security, design decisions |

## The one-minute version

```
Every weekday, ~16:30 Lagos time                 Weekends, 13:00 Lagos time
┌──────────────────────────────┐                 ┌──────────────────────────────┐
│ GitHub Actions (daily job)   │                 │ GitHub Actions (history job) │
│  1. ask Kobo Terminal for    │                 │  EODHD: past year for up to  │
│     today's closing prices   │                 │  18 more stocks              │
│  2. EODHD: past year for up  │                 └──────────────┬───────────────┘
│     to 18 more stocks        │                                │
│  3. work out changes & movers│◄───────────────────────────────┘
│  4. save to data/ in the repo│
│  5. publish the website      │──► Cloudflare Pages ──► Cloudflare Access (email sign-in) ──► you
└──────────────────────────────┘
```

- **Kobo Terminal** supplies each day's closing price for all ~146 stocks (one request a day).
- **EODHD** supplies about a year of past prices for each stock, once, when tracking starts (≤18 stocks a day on its free plan).
- Every day's prices are kept for good in the private GitHub repository, so history grows automatically.
- Only people whose email address is on the allow-list can open the site.

## Other documents

- **Word version** of these guides: [`NGX-Tracker-Handbook.docx`](NGX-Tracker-Handbook.docx) — regenerate with `node docs/build-handbook.cjs` after editing the Markdown, then update fields in Word.
- **Web version** (private page): https://claude.ai/artifact/PPRbVSY3ohF4QbCSM83mxM
- Design specification: [`superpowers/specs/2026-09-25-ngx-tracker-design.md`](superpowers/specs/2026-09-25-ngx-tracker-design.md)
- Original implementation plan: [`superpowers/plans/2026-09-25-ngx-tracker.md`](superpowers/plans/2026-09-25-ngx-tracker.md)
- Project README (quick setup): [`../README.md`](../README.md)

*Documentation written September 25, 2026, for the version live on that date (3M/6M/YTD/1Y periods and weekend history runs included).*
