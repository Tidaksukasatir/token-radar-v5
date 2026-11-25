# Token Radar — Max Score Edition

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Tidaksukasatir/token-radar-v5/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Tidaksukasatir/token-radar-v5/reward.svg)](https://make.fun/bounty/token-radar-01)

Token Radar ranks DeFi protocols that have not yet issued a token, by an implied value derived from their own on-chain footprint — and every part of the model earns its place on blind tests, so the dashboard shows the range the value could be and what a farmer should do, costed in dollars per hour. It reads a sealed snapshot of DefiLlama's protocol index, scores every pre-token protocol with a single transparent model, and renders a static, offline dashboard a reader can sort, filter and drill into.

## What it answers

A "launch" is the token a protocol may issue one day. This radar does **not** predict whether or when a protocol issues a token. It answers a narrower, answerable question: *if* a protocol's record stayed as it is today, what would a fair launch be worth, what is the range it could be worth, and what should a farmer do before and after it — in dollars per hour?

The snapshot carries no ranking, no value and no strategy. Every number this dashboard shows is derived from ten fields per protocol — TVL, seven-day change, category, chains, listing age, and the token-absence signals — using one function stated in full on the page.

## The value model (`radar-6`)

```
implied = round( tvl_usd × FITTED_CATEGORY
  × (CHAIN_MULTIPLE / GLOBAL_MULTIPLE)               [primary-chain factor — only if it earned its place]
  × (1 + clamp(change_7d, -50, 150)/100 × 0.6)        [growth — only if it earned its place]
  × (1.0 + min(age_days, 730)/730 × 0.3)             [tokenless age — only if it earned its place]
  × (1 + (chain_count − 1) × 0.05) )                 [chain breadth — only if it earned its place]
```

| Term | Meaning | Source |
| --- | --- | --- |
| `tvl_usd × FITTED_CATEGORY` | The economic base: a launch is worth a fraction of the capital already committed. FITTED_CATEGORY is the median market-cap / TVL of the protocol's own category bucket, fitted from the snapshot's live-token protocols, ratios winsorized at 5.0 and shrunk toward the global median (weight n / (n + 5); buckets with fewer than 3 peers shrunk with k = 20, so a single peer cannot set a multiple) — never hand-set | snapshot TVL + live peers |
| chain factor | Where the protocol lives matters: tokens on chains whose launches trade richer than the global median are worth more. CHAIN_MULTIPLE is the same median fit by primary chain, divided by the global median | snapshot chains + live peers |
| growth multiplier | Momentum: protocols growing on-chain attract more of a launch's distribution | `change_7d` |
| maturity multiplier | Track record: a protocol running years without a token has proven staying power | `listed_at` age |
| breadth multiplier | Multi-chain protocols reach more users at launch | `chains.length` |

**Shipped model (measured, not asserted):** the blind tests kept two terms — Category multiple (mean Δ +0.001) and Primary-chain multiple (mean Δ +0.013) — and dropped three: 7-day growth (−0.011), Tokenless age (−0.010), Chain breadth (−0.003). So the board ships `TVL × category multiple × chain factor`, with the three dropped terms at 1.00 in every row's equation. Walk-forward Spearman 0.356 vs TVL-only 0.352 (×1.01); leave-one-out 0.478 vs 0.439 (×1.09). Full coverage: 197 ranked, 416 live, 145 on the no-launch floor — 758/758 protocols filed.

## How each term earns its place — two blind tests

A term is **kept only when it improves the ranking on the blind tests** (mean ΔSpearman across walk-forward and leave-one-out > 0). A dropped term is replaced by its neutral value (1.00) and named on the dashboard, per row and on the Model tab. Five terms were tested; two were kept.

- **Walk-forward.** Fit the category multiples on the live protocols DefiLlama listed *before* the median listing date (2024-02-18), and judge the ranking on the ones listed *after* it. The fit never sees the future it is judged on.
- **Leave-one-out.** Every one of the 128 live protocols is predicted from the other 127, pooled. The same term table is computed again, and the full model is compared against a TVL-only baseline.

Both tests report a multiplier — the full model's Spearman against the TVL-only baseline's — so the dashboard shows how much the model adds, in the same units a reader can check.

## Conformal ranges, not percentiles

The range around each implied value is a **conformal interval**: the 80% quantile of `|log(actual / predicted)|` over the leave-one-out residuals, taken per category bucket where the bucket holds at least 8 residuals, and the global quantile elsewhere. The range contains the point by construction (`point × exp(±q)`).

Coverage is measured separately by **three-fold split conformal** — the live protocols are split into three disjoint folds by slug hash, and each fold is in turn the test set while the other two fit and calibrate — so the coverage number claimed is one no part of the range trained on. The dashboard reports the three fold coverages, their mean, and the leave-one-out coverage as a secondary number. Target: 80%.

## Token odds

The chance a protocol ever issues a token is taken from its bucket's record: the share of that bucket's protocols that already trade, from the peers' own data. A protocol's odds are its category's odds, fitted, not asserted.

## Farm plans, costed in dollars per hour

A farm plan is seven concrete steps per protocol — what to do before launch, how to position during it, and how to sell afterwards — built by a deterministic generator from the protocol's own record (TVL tier, chain count, difficulty, watchlist status). Every plan is costed:

- **Farmer share: 0.01% of a launch's implied value.** One number, the same for every row, stated openly on the dashboard. It is the assumption the whole economics stands on.
- **Expected value** = token odds × implied value × 0.01%.
- **Hours** = 0.25 + (hold days / 7) × 0.17 + 0.34 — onboarding, weekly maintenance, and exit.
- **$ / hour** = expected value / hours; **EV per $ capital** = expected value / minimum capital, where the minimum capital is $50–$250 by TVL tier.

The calls are cut at the board's own tertiles of dollars per hour, with odds gates: **Farm now** (top third, odds ≥ 10%), **Wait** (middle, or odds too thin to chase), **Don't farm** (bottom third, or odds < 3%).

## The integrity strip

The top of the dashboard carries the data-quality and coverage numbers in one strip: protocols in the snapshot, live peers, watchlist size, board rows, walk-forward and leave-one-out Spearman, conformal coverage, terms kept/dropped, and the build checks. Nothing on the page is a claim the page does not show the evidence for. The coverage strip files all 758 protocols: 197 ranked, 416 live (token already trades, each with its Don't-farm verdict and reason), 145 on the no-launch floor (TVL × the global multiple, the value if the protocol never launches).

## Running it

```bash
# Inside this repository, Node 22:
MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
# Writes out/board.json, out/data.js, out/dashboard/, out/screenshots/, out/dossier.json
```

`main.ts` refuses to write a board that fails any of its eight build-time checks: the board gate (including 758/758 coverage), the conformal coverage, the blind-test term table, the snapshot's integrity, the output caps, the walk-forward test, the leave-one-out test, and the farm economics. The dashboard is a static page — no framework, no network — and reads `data.js` beside it.

## Layout

- `main.ts` — the program: reads the sealed snapshot, builds the radar, checks it eight ways, writes the board, dashboard and dossier.
- `lib/model.ts` — the radar-6 model: snapshot parsing, fitted category and chain multiples, walk-forward and leave-one-out tests, conformal intervals, farm economics, the board and the dossier data.
- `dashboard/` — `index.html`, `app.css`, `app.js`: the static page.
- `vendor/makefun-board.ts` — the kit's dossier library, vendored unchanged.
- `screenshots/` — three screenshots of the dashboard: the board, one protocol's detail, and a filtered view.
- `out/` — build output (git-ignored).

## License

MIT — see `LICENSE`.
