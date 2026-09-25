# NGX Tracker — User guide

A simple guide for family and friends who have been given access.

## 1. What it is

NGX Tracker shows the stocks listed on the **Nigerian Exchange (NGX)**:

- each stock's **latest closing price**, updated once every weekday after the market closes;
- how much each stock has **gone up or down** over several periods;
- the **biggest gainers and losers**;
- a **price chart** for each stock.

It is for information only — it isn't investment advice, and prices are end-of-day, not live.

## 2. Opening the site and signing in

1. Go to **https://ngx-tracker.pages.dev** (on a computer or phone).
2. You'll see a Cloudflare sign-in page. Enter **your email address** — it must be one the owner has added.
3. Check your inbox for an email from Cloudflare with a **one-time code** (check spam/junk if it doesn't arrive within a minute).
4. Type the code in. You're in.

You stay signed in for **24 hours**; after that you'll be asked for a new code. If your email isn't on the list, the sign-in page won't let you in — ask the owner to add you.

**Tip:** on a phone, use your browser's "Add to Home screen" to open it like an app.

## 3. The home page

### Header
"**Prices as of 25 Sept 2026, end of day**" tells you which trading day the prices are from. If the data is more than 4 working days old, a yellow **"Data may be out of date"** banner appears.

### Market summary
| Figure | Meaning |
|---|---|
| **All-Share Index** | The NGX's main index, and its change that day |
| **Rose / Fell / Unchanged** | How many stocks moved up, down or stayed the same (NGX's official figures) |
| **Didn't trade** | Stocks with no shares traded that day |

### Top movers
The 10 biggest **gainers** and **losers**. Use the tabs to choose the period:

| Tab | Compares today's close with… |
|---|---|
| **Day** | the previous trading day |
| **Week** | about 7 days ago |
| **Month** | about 1 month ago |
| **3M / 6M** | about 3 / 6 months ago |
| **YTD** | the last close of last year ("year to date") |
| **1Y** | about 1 year ago |

Stocks that **didn't trade today** are left out of these lists (their price didn't really change).

If you see **"Based on N of M stocks that traded: price history for the rest is still loading"**, the lists only include stocks whose history has been filled in so far — this happens only in the first days of tracking.

**"Not enough history yet"** means there isn't enough past data for that period.

### All stocks table
- **Search** by symbol (e.g. `MTNN`) or company name (e.g. `breweries`).
- **Filter** by sector with the drop-down.
- **Sort** by clicking any column heading; click again to reverse.
- **Show inactive** reveals stocks that haven't appeared on the exchange for 2+ weeks (suspended or delisted).
- **"—"** means that change isn't available yet. **"no trades"** in Volume means nothing traded that day.
- Click a **symbol** to open that stock's page.

On a phone, some columns are hidden to save space; open a stock to see all of its figures.

## 4. A stock's page

- **Name, symbol, sector and board** (Main, Premium, Growth, …).
- **Last close** and its date, plus the change for every period.
- **Price chart** — choose **1M, 3M, 6M, 1Y or All**. Early on, a stock with only a day or two of history shows a flat line; it fills in once its past year is loaded.
- **52-week high / low** and **average daily volume**. If the stock has less than a year of history, these read "High/Low **since** <date>" instead.
- **"History starts <date>"** — how far back the data goes.

## 5. Warning signs

| You see | It means |
|---|---|
| **⚠** next to a mover, or a yellow "Moved more than ±10%" note | The price moved more than NGX's usual daily limit of 10%. Often this is a **bonus issue or share split**, which changes the price without anyone gaining or losing money. Treat that figure with caution. |
| "Data may be out of date" banner | The prices haven't updated for over 4 working days — the owner has probably been emailed about a problem. |
| "Stock not found" | That symbol isn't tracked (check the spelling, or go back to All stocks). |

## 6. Good to know

- **Prices are end-of-day**, published once each weekday, typically in the late afternoon Lagos time. Refresh the page to see the latest.
- **Changes are price-only.** They don't include dividends, and bonus issues or splits can make longer-period figures (3M, 6M, YTD, 1Y) look worse or better than a shareholder's real return.
- **Weekends and public holidays** have no new prices.
- The data comes from Kobo Terminal and EODHD under free personal-use plans — please **don't share the link publicly**.

## 7. Questions

| Question | Answer |
|---|---|
| The code email didn't arrive | Check spam/junk, wait a minute, then request a new code. Make sure you typed the same email the owner added. |
| It asks me to sign in again | Normal — sign-in lasts 24 hours. |
| The prices look old | Check the date in the header. Prices update once each weekday afternoon; refresh the page. |
| A stock is missing | It may have been suspended or delisted — tick **Show inactive**. |
| Is this advice on what to buy? | No. It's information only. |
