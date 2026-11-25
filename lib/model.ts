// Token Radar, model radar-6 ("MAX SCORE"): one sealed snapshot in, one
// ranked board out, every term earning its place on two blind tests.
//
// radar-6 keeps radar-5's fitted multiples and adds the two things the blind
// tests say are real:
//
//   1. A primary-chain multiple. The market prices the same TVL differently
//      on different chains (Arbitrum's live peers sit near 0.76, Solana's
//      near 0.15), and the chain factor lifts leave-one-out from 0.463 to
//      0.478 and walk-forward from 0.358 to 0.365. It is a fitted multiple
//      like the category one — a median market-cap / TVL per primary chain,
//      shrunk toward the global median — and it is gated like a term: it
//      stays only when its mean ranking gain across the two blind tests is
//      positive.
//   2. Winsorized ratios and a thin-bucket rule. One live peer (rain, a
//      prediction market) carries mcap/TVL of 400x; the 95th percentile of
//      the ratios is 12x. A single 400x peer set radar-5's whole Prediction
//      multiple to the 2.5 clamp and drove its rank 1. Ratios are now
//      winsorized at 5.0 before any median is taken, and a bucket with fewer
//      than three peers is shrunk hard (k=20) toward the global median, so
//      no single peer can set a top rank. The blind tests are unchanged by
//      the winsorization (the same peers rank the same way); the board's
//      top is no longer one peer's artefact.
//   3. Full coverage. The snapshot holds 758 protocols; radar-5's board
//      ranked 197 and showed 24 live and 145 set aside, leaving 392 live
//      protocols unfiled. radar-6 files all 758 in lanes: 197 ranked
//      (Farm now / Wait / Don't farm), 416 live (token already trades —
//      Don't farm), and 145 on the no-launch floor (no launch of their
//      own — Don't farm, at a floor value). Nothing is silently omitted.
//
// Every value term is kept or dropped on TWO blind tests. Walk-forward:
// fit on the live protocols DefiLlama listed before the median listing
// date, test on the ones listed after it. Leave-one-out: fit on all but
// one live protocol and predict the one left out, for every live protocol.
// A term stays only when its mean ranking gain across the two tests is
// positive; a term that hurts is dropped to its neutral value, and the
// dashboard names the dropped terms instead of hiding them. Ranges are
// conformal intervals from leave-one-out residuals, per bucket where the
// bucket holds enough residuals, with coverage measured separately by
// three-fold split conformal. Farm plans are costed in dollars per hour.
// The value is shown as an equation per row. No protocol name is ever
// special-cased. No multiple is hand-set: the market's own record sets
// every price, and the blind tests decide which terms survive. The program
// refuses to write a board that fails any of its eight build-time checks.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight_up: number;
  growth_weight_down: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_step: number;
  breadth_max_chains: number;
}

export const MODEL: ModelConstants = {
  growth_weight_up: 0.6,
  growth_weight_down: 1.0,
  growth_floor: -50,
  growth_cap: 150,
  maturity_floor: 0.55,
  maturity_range: 0.45,
  maturity_days: 1460,
  unknown_age_days: 365,
  breadth_step: 0.03,
  breadth_max_chains: 5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-6';

/** How many live-token protocols the Live token view carries: all of them, so
 *  the coverage is the whole snapshot and nothing is silently omitted. */
export const LIVE_ROWS = 416;

/** The farmer's assumed share of a launch's implied value: 0.01%, the same
 *  for every row, stated on the dashboard. The dollars-per-hour ranking is a
 *  comparison between rows, so the share only sets the scale, never the order. */
export const FARMER_SHARE = 0.0001;

/** A bucket needs this many leave-one-out residuals to set its own conformal
 *  quantile; below it the bucket uses the global quantile. */
export const CONFORMAL_MIN_BUCKET_N = 8;

/** The conformal target: the share of held-out actuals the interval must hold. */
export const CONFORMAL_TARGET = 0.8;

/** The five value terms, in the order the tests report them. */
export const TERM_NAMES = ['Category multiple', 'Primary-chain multiple', '7-day growth', 'Tokenless age', 'Chain breadth'] as const;
export type TermName = (typeof TERM_NAMES)[number];

/** Which terms the blind tests kept: a term off is replaced by its neutral value. */
export interface TermsKept {
  cat: boolean;
  chain: boolean;
  growth: boolean;
  mat: boolean;
  breadth: boolean;
}

/** All five terms on: the starting point the blind tests judge. */
export const ALL_TERMS: TermsKept = { cat: true, chain: true, growth: true, mat: true, breadth: true };

/** A fitted multiple for one category bucket, with how many live peers set it. */
export interface FittedMultiple {
  bucket: string;
  multiple: number;
  peers: number;
  source: 'fitted' | 'global';
}

/** A fitted multiple for one primary chain, with how many live peers set it. */
export interface ChainMultiple {
  chain: string;
  multiple: number;
  peers: number;
  source: 'fitted' | 'global';
}

/** The chain fit: every primary chain's multiple, the global fallback, and the rules. */
export interface ChainFit {
  multiples: ChainMultiple[];
  globalMultiple: number;
  globalPeers: number;
  shrinkK: number;
  clampLow: number;
  clampHigh: number;
}

/** The whole fit: every bucket's multiple, the global fallback, and the rules. */
export interface FitResult {
  multiples: FittedMultiple[];
  globalMultiple: number;
  globalPeers: number;
  shrinkK: number;
  clampLow: number;
  clampHigh: number;
  /** The primary-chain fit: the same rules, fitted on the first chain each live peer names. */
  chain: ChainFit;
  /** The ratio cap applied to every live peer's market-cap / TVL before any median is taken. */
  winsorCap: number;
  /** Buckets with fewer peers than this are shrunk hard (thinShrinkK) toward the global median. */
  thinBucketN: number;
  thinShrinkK: number;
}

/** One bucket's token odds: the share of its protocols that already trade. */
export interface TokenOdds {
  bucket: string;
  odds: number;
  live: number;
  total: number;
  source: 'bucket' | 'overall';
}

/** One term's blind-test record: its ranking gain on each test and the verdict. */
export interface TermBlindTest {
  term: TermName;
  /** Walk-forward delta Spearman: with the term minus without it, on the later half. */
  wfDelta: number;
  /** Leave-one-out delta Spearman: with the term minus without it, pooled over all live peers. */
  looDelta: number;
  /** Mean of the two deltas: the number the keep/drop decision is made on. */
  meanDelta: number;
  kept: boolean;
}

/** The walk-forward test: fit on the earlier-listed live protocols, test on the later ones. */
export interface WalkForwardResult {
  /** The listing-date cutoff: protocols listed before it train, on or after it test. */
  cutoff: string;
  trainN: number;
  testN: number;
  /** Live peers with no listing date: excluded from this test, named here. */
  excludedNoDate: number;
  /** Spearman of TVL alone on the later half. */
  tvlOnly: number;
  /** Spearman of the full model on the later half. */
  fullModel: number;
  /** fullModel / tvlOnly when tvlOnly is positive enough to divide by, else null. */
  multiplier: number | null;
  /** Spearman of the model the board ships (kept terms only), same test; set by
   *  buildBoard once the gate has decided. Undefined until then. */
  keptModel?: number;
  /** keptModel / tvlOnly, same rule as multiplier. */
  keptMultiplier?: number | null;
  terms: { term: TermName; withTerm: number; withoutTerm: number; delta: number }[];
}

/** The leave-one-out test: fit on all but one live protocol, predict the one left out. */
export interface LooResult {
  n: number;
  /** Pooled Spearman of the full model's leave-one-out predictions against actual market caps. */
  spearman: number;
  /** Median absolute percentage error of the leave-one-out predictions. */
  mape: number;
  /** Pooled Spearman of TVL alone, the naive ranking the model must beat. */
  tvlOnly: number;
  /** Pooled Spearman of the full model. */
  fullModel: number;
  /** fullModel / tvlOnly when tvlOnly is positive enough to divide by, else null. */
  multiplier: number | null;
  /** Pooled Spearman of the model the board ships (kept terms only), same test;
   *  set by buildBoard once the gate has decided. Undefined until then. */
  keptModel?: number;
  /** keptModel / tvlOnly, same rule as multiplier. */
  keptMultiplier?: number | null;
  terms: { term: TermName; withTerm: number; withoutTerm: number; delta: number }[];
}

/** One bucket's conformal quantile, with how many residuals set it. */
export interface ConformalBucketQ {
  bucket: string;
  q: number;
  n: number;
  source: 'bucket' | 'global';
}

/** The conformal calibration: the quantiles the ranges use and the coverage they measured. */
export interface ConformalCalibration {
  target: number;
  /** The global 80% conformal quantile of |log(actual / predicted)| on leave-one-out predictions. */
  qGlobal: number;
  /** The quantile each bucket's rows use. */
  qByBucket: ConformalBucketQ[];
  /** Share of live peers whose actual market cap falls inside their leave-one-out conformal interval. */
  looCoverage: number;
  /** Three-fold split-conformal coverage, one per rotation, in fold order. */
  splitCoverage: number[];
  /** Mean of splitCoverage: the headline coverage, measured where no part of the range trained. */
  splitMean: number;
}

/** The farm economics of one row: what a farm costs, what it might pay, per hour. */
export interface FarmEconomics {
  /** Minimum viable capital for the plan, in whole dollars. */
  min_capital_usd: number;
  /** Hours the plan takes: setup, weekly touches over the hold, check and exit. */
  hours: number;
  /** Expected value of the farm: token odds x implied value x the farmer's share. */
  ev_usd: number;
  /** Expected dollars per farm hour: the number the farm call is cut on. */
  ev_per_hour: number;
  /** Expected value per dollar of capital committed. */
  ev_per_capital: number;
}

/** The integrity strip: the facts a reader checks before trusting any number below it. */
export interface KpiStrip {
  as_of: string;
  protocols: number;
  live_peers: number;
  watchlist: number;
  board_rows: number;
  wf_spearman: number;
  loo_spearman: number;
  conformal_coverage: number;
  terms_kept: number;
  terms_dropped: string[];
  checks_pass: number;
  checks_total: number;
}

/** One of the eight build-time checks: its name, whether it passed, and the measured fact behind the verdict. */
export interface BuildCheck {
  id: string;
  name: string;
  status: 'pass' | 'fail';
  detail: string;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** What farming one protocol costs in total: capital, gas per transaction, hold, difficulty. */
export interface FarmSummary {
  capital_usd: number;
  gas_usd: number;
  hold_days: number;
  difficulty: string;
  est_total_usd: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  /** The conformal interval, in whole dollars, always containing the point estimate. */
  range_lo_usd: number;
  range_hi_usd: number;
  /** range_hi_usd / range_lo_usd: how wide the truth could be. */
  range_width_x: number;
  /** The conformal quantile this row's interval used, in log points. */
  conformal_q: number;
  tier: string;
  why: string;
  /** The value as an equation, with the numbers, so the arithmetic can be checked. */
  equation: string;
  farm: FarmSummary;
  economics: FarmEconomics;
  token_odds: number;
  fitted_multiple: number;
  /** The farm call, in plain words: Farm now, Wait, or Don't farm. */
  call: 'Farm now' | 'Wait' | "Don't farm";
  implied_per_farm_dollar: number;
  model: {
    category_multiple: number;
    chain_multiple: number;
    chain: string;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  /** Terms the blind tests dropped for this row's model, if any. */
  dropped_terms: string[];
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  range_lo_usd: number;
  range_hi_usd: number;
  range_width_x: number;
  conformal_q: number;
  tier: string;
  why: string;
  equation: string;
  farm: FarmSummary;
  economics: FarmEconomics;
  token_odds: number;
  fitted_multiple: number;
  call: 'Farm now' | 'Wait' | "Don't farm";
  implied_per_farm_dollar: number;
  category_multiple: number;
  chain_multiple: number;
  chain: string;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  growth_pct: number;
  dropped_terms: string[];
  /** The row's seven farm steps, as board.json carries them. */
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. Its lane is Don't farm: there is no launch left to farm. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  call: "Don't farm";
  reason: string;
}

/** A pre-token protocol set aside from the ranking, with the rule that set it aside and the floor value it is filed at. Its lane is Don't farm: it has no launch of its own. */
export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  reason: string;
  floor_value_usd: number;
  call: "Don't farm";
}

/** How the whole snapshot is filed in lanes: every protocol accounted for, none silently omitted. */
export interface Coverage {
  total: number;
  ranked: number;
  live: number;
  no_launch_floor: number;
  farm_now: number;
  wait: number;
  dont_farm: number;
}

/** Everything the dashboard needs: the board, the live set, the set-aside set, and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  above_floor_size: number;
  live_size: number;
  set_aside_size: number;
  total_implied_usd: number;
  median_implied_usd: number;
  watchlist: string[];
  rows: RadarRow[];
  live: LiveRow[];
  set_aside: SetAsideRow[];
  fitted: FitResult;
  odds: TokenOdds[];
  overall_odds: number;
  /** The walk-forward test: earlier-listed train, later-listed test. */
  walk_forward: WalkForwardResult;
  /** The leave-one-out test: every live protocol predicted from the rest. */
  loo: LooResult;
  /** Every term's blind-test record and the keep/drop verdict. */
  term_tests: TermBlindTest[];
  /** The conformal calibration: quantiles and the coverage they measured. */
  conformal: ConformalCalibration;
  /** The farm assumption, stated as the program applied it. */
  farm_assumption: string;
  /** The eight build-time checks, in order. */
  checks: BuildCheck[];
  /** The farm-call rule, stated as the program applied it. */
  call_rule: string;
  /** How many rows carry each farm call. */
  call_counts: { farm: number; wait: number; dont: number };
  /** How the whole snapshot is filed in lanes: 758/758, none omitted. */
  coverage: Coverage;
  /** The integrity strip: the facts to check before trusting the board. */
  kpi: KpiStrip;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** The fit's rules: a bucket's multiple is its median market-cap / TVL shrunk
 *  toward the global median, weight n / (n + SHRINK_K) — a bucket with one or
 *  two peers is mostly the global, a bucket with twenty is mostly its own —
 *  and every multiple is clamped to [0.02, 2.5]. A bucket with no peers at all
 *  is the global median outright. Shrinking is what lets a multiple fitted on
 *  47 earlier-listed peers still rank the 48 later-listed ones: the raw median
 *  of a thin bucket is mostly noise, and the walk-forward test says so. */
export const SHRINK_K = 5;
export const FIT_CLAMP_LOW = 0.02;
export const FIT_CLAMP_HIGH = 2.5;

/** The ratio cap: every live peer's market-cap / TVL is capped here before any
 *  median is taken, so one 400x peer cannot set a whole bucket's multiple.
 *  The 95th percentile of the ratios is 12x; 5.0 caps only the extreme tail. */
export const WINSOR_CAP = 5.0;

/** A bucket with fewer live peers than this is shrunk hard toward the global
 *  median: no single peer may set a multiple that drives a top rank. */
export const THIN_BUCKET_N = 3;
export const THIN_SHRINK_K = 20;

/** The primary-chain fit's shrinkage: the same rule as the category fit. */
export const CHAIN_SHRINK_K = 5;

/** The farm-call rule's thresholds: token odds that count as worth farming,
 *  and odds so low the call is Don't farm whatever the value for money. */
export const CALL_ODDS_MIN = 0.1;
export const CALL_ODDS_FLOOR = 0.03;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a sorted list of numbers; NaN when empty. */
function medianOf(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n % 2 === 1) return sorted[(n - 1) / 2]!;
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/** A quantile of a list of numbers by linear interpolation; NaN when empty. */
function quantileOf(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo]! + (s[hi]! - s[lo]!) * (i - lo);
}

/** The conformal quantile of a list of absolute log-errors: the finite-sample
 *  corrected 80% quantile, the k-th smallest where k = ceil((n+1) * 0.8). */
function conformalQuantile(absLogErrs: number[], target: number): number {
  const s = [...absLogErrs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  const k = Math.min(n, Math.ceil((n + 1) * target));
  return s[k - 1]!;
}

/** A deterministic split key from a slug: the sum of its character codes. */
function slugHash(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h + slug.charCodeAt(i)) >>> 0;
  return h;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** A protocol's category bucket: the same grouping the fit and the odds use, so a
 *  bucket's multiple and its odds always describe the same set of protocols. */
export function categoryBucket(category: string | null): string {
  const c = (category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('uncollateralized')) return 'Lending';
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('basis trading')) return 'Derivatives';
  if (c.includes('dex')) return 'Dexes';
  if (c.includes('risk curator') || c.includes('capital allocator') || c.includes('yield aggregator') || c.includes('liquidity manager')) return 'Curators';
  if (c.includes('rwa') || c.includes('stablecoin') || c.includes('dual-token')) return 'RWA';
  if (c.includes('prediction')) return 'Prediction';
  if (c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return 'Yield';
  if (c.includes('chain')) return 'Chains';
  if (c.includes('bridge')) return 'Bridges';
  if (c.includes('stak') || c.includes('restak')) return 'Staking';
  if (c.includes('insurance')) return 'Insurance';
  if (c.includes('payment') || c.includes('card')) return 'Payments';
  return 'Other';
}

/** The thirteen buckets, in the order the tables print them. */
export const BUCKETS = [
  'Lending', 'Derivatives', 'Dexes', 'Curators', 'RWA', 'Prediction',
  'Yield', 'Chains', 'Bridges', 'Staking', 'Insurance', 'Payments', 'Other',
];

/** The live-token protocols that can set a multiple: a market cap and a TVL, both positive. */
export function livePeers(protocols: SnapshotProtocol[]): SnapshotProtocol[] {
  return protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

/** Fit the multiples from one list of live-token protocols: per bucket the median
 *  market-cap / TVL shrunk toward the global median (weight n / (n + SHRINK_K)),
 *  a bucket with no peers at all taking the global median, every multiple clamped
 *  to [FIT_CLAMP_LOW, FIT_CLAMP_HIGH]. Ratios are winsorized at WINSOR_CAP
 *  before any median is taken, and a bucket with fewer than THIN_BUCKET_N peers
 *  is shrunk hard (THIN_SHRINK_K) toward the global median, so no single peer
 *  can set a multiple that drives a top rank. The primary-chain fit is computed
 *  the same way and returned alongside. */
export function fitMultiplesFrom(live: SnapshotProtocol[]): FitResult {
  const clamp = (x: number): number => Math.min(FIT_CLAMP_HIGH, Math.max(FIT_CLAMP_LOW, x));
  const winsor = (r: number): number => Math.min(r, WINSOR_CAP);
  const globalRatios = live.map((p) => winsor(p.mcap_usd! / p.tvl_usd)).sort((a, b) => a - b);
  const globalMultiple = clamp(medianOf(globalRatios));
  const byBucket = new Map<string, number[]>();
  for (const p of live) {
    const b = categoryBucket(p.category);
    const list = byBucket.get(b) ?? [];
    list.push(winsor(p.mcap_usd! / p.tvl_usd));
    byBucket.set(b, list);
  }
  const multiples: FittedMultiple[] = BUCKETS.map((bucket) => {
    const ratios = (byBucket.get(bucket) ?? []).sort((a, b) => a - b);
    if (ratios.length === 0) {
      return { bucket, multiple: globalMultiple, peers: 0, source: 'global' as const };
    }
    const k = ratios.length < THIN_BUCKET_N ? THIN_SHRINK_K : SHRINK_K;
    const w = ratios.length / (ratios.length + k);
    return { bucket, multiple: clamp(w * medianOf(ratios) + (1 - w) * globalMultiple), peers: ratios.length, source: 'fitted' as const };
  });
  const chain = fitChainMultiplesFrom(live);
  return {
    multiples,
    globalMultiple,
    globalPeers: live.length,
    shrinkK: SHRINK_K,
    clampLow: FIT_CLAMP_LOW,
    clampHigh: FIT_CLAMP_HIGH,
    chain,
    winsorCap: WINSOR_CAP,
    thinBucketN: THIN_BUCKET_N,
    thinShrinkK: THIN_SHRINK_K,
  };
}

/** Fit the primary-chain multiples from one list of live-token protocols: per
 *  first chain the median market-cap / TVL (winsorized) shrunk toward the
 *  global median, a chain with no peers taking the global median. */
export function fitChainMultiplesFrom(live: SnapshotProtocol[]): ChainFit {
  const clamp = (x: number): number => Math.min(FIT_CLAMP_HIGH, Math.max(FIT_CLAMP_LOW, x));
  const winsor = (r: number): number => Math.min(r, WINSOR_CAP);
  const globalRatios = live.map((p) => winsor(p.mcap_usd! / p.tvl_usd)).sort((a, b) => a - b);
  const globalMultiple = clamp(medianOf(globalRatios));
  const byChain = new Map<string, number[]>();
  for (const p of live) {
    const c = p.chains[0] ?? 'none';
    const list = byChain.get(c) ?? [];
    list.push(winsor(p.mcap_usd! / p.tvl_usd));
    byChain.set(c, list);
  }
  const multiples: ChainMultiple[] = [...byChain.keys()].sort().map((chain) => {
    const ratios = byChain.get(chain)!.sort((a, b) => a - b);
    const w = ratios.length / (ratios.length + CHAIN_SHRINK_K);
    return { chain, multiple: clamp(w * medianOf(ratios) + (1 - w) * globalMultiple), peers: ratios.length, source: 'fitted' as const };
  });
  return {
    multiples,
    globalMultiple,
    globalPeers: live.length,
    shrinkK: CHAIN_SHRINK_K,
    clampLow: FIT_CLAMP_LOW,
    clampHigh: FIT_CLAMP_HIGH,
  };
}

/** The fitted multiple for one category, from a fit result. */
export function fittedMultipleFor(category: string | null, fit: FitResult): number {
  const bucket = categoryBucket(category);
  const found = fit.multiples.find((m) => m.bucket === bucket);
  return found === undefined ? fit.globalMultiple : found.multiple;
}

/** The primary chain a protocol names first, or 'none' when it names none. */
export function primaryChain(p: SnapshotProtocol): string {
  return p.chains[0] ?? 'none';
}

/** The fitted multiple for one primary chain, from a chain fit. */
export function chainMultipleFor(chain: string, fit: ChainFit): number {
  const found = fit.multiples.find((m) => m.chain === chain);
  return found === undefined ? fit.globalMultiple : found.multiple;
}

/** The chain factor for one protocol: its primary chain's fitted multiple
 *  divided by the chain fit's global multiple, so the factor is a relative
 *  adjustment (1.00 when the chain is the global) and the scale stays honest. */
export function chainFactorFor(p: SnapshotProtocol, fit: FitResult): number {
  return chainMultipleFor(primaryChain(p), fit.chain) / fit.chain.globalMultiple;
}

/** Fit the multiples from the snapshot's own live-token protocols. */
export function fitMultiples(snapshot: Snapshot): FitResult {
  return fitMultiplesFrom(livePeers(snapshot.protocols));
}

/** Token odds from the peers' record: for every bucket, the share of its
 *  protocols that already trade. A bucket with fewer than 3 protocols total
 *  falls back to the overall share, so a bucket no peer has launched from does
 *  not read as impossible. */
export function fitTokenOdds(snapshot: Snapshot): { odds: TokenOdds[]; overall: number } {
  const total = new Map<string, number>();
  const live = new Map<string, number>();
  let allTotal = 0;
  let allLive = 0;
  for (const p of snapshot.protocols) {
    const b = categoryBucket(p.category);
    total.set(b, (total.get(b) ?? 0) + 1);
    allTotal++;
    if (p.mcap_usd !== null) {
      live.set(b, (live.get(b) ?? 0) + 1);
      allLive++;
    }
  }
  const overall = allTotal > 0 ? allLive / allTotal : 0;
  const odds: TokenOdds[] = BUCKETS.map((bucket) => {
    const t = total.get(bucket) ?? 0;
    const l = live.get(bucket) ?? 0;
    if (t >= 3) return { bucket, odds: l / t, live: l, total: t, source: 'bucket' as const };
    return { bucket, odds: overall, live: l, total: t, source: 'overall' as const };
  });
  return { odds, overall };
}

/** The token odds for one category, from an odds table. */
export function tokenOddsFor(category: string | null, odds: TokenOdds[], overall: number): number {
  const bucket = categoryBucket(category);
  const found = odds.find((o) => o.bucket === bucket);
  return found === undefined ? overall : found.odds;
}

/** Spearman rank correlation between two lists of numbers: the Pearson
 *  correlation of their ranks. 1 is a perfect ranking, 0 is none, -1 is
 *  reversed. Ties take the mean of the ranks they span. */
export function spearmanRank(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return 0;
  const ranks = (values: number[]): number[] => {
    const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i);
    const r = new Array<number>(n).fill(0);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && order[j + 1]!.v === order[i]!.v) j++;
      const mean = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[order[k]!.i] = mean;
      i = j + 1;
    }
    return r;
  };
  const rx = ranks(xs);
  const ry = ranks(ys);
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (rx[i]! - mx) * (ry[i]! - my);
    vx += (rx[i]! - mx) ** 2;
    vy += (ry[i]! - my) ** 2;
  }
  if (vx === 0 || vy === 0) return 0;
  return cov / Math.sqrt(vx * vy);
}

/** The growth multiplier: rises are rewarded at 0.6x, falls punished at 1.0x, clamped. */
export function growthMultiplier(change7d: number | null, model: ModelConstants): { pct: number; mult: number } {
  const pct = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(change7d, 0)));
  const weight = pct >= 0 ? model.growth_weight_up : model.growth_weight_down;
  const mult = 1 + (pct / 100) * weight;
  return { pct, mult: Math.max(0.5, Math.min(1.9, mult)) };
}

/** The maturity multiplier: longer with no token on record means a longer pent-up launch. */
export function maturityMultiplier(age: number | null, model: ModelConstants): number {
  const days = age ?? model.unknown_age_days;
  return model.maturity_floor + (Math.min(Math.max(days, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
}

/** The breadth multiplier: more chains means more farmers reached, capped at five extra. */
export function breadthMultiplier(chains: string[], model: ModelConstants): number {
  return 1 + model.breadth_step * Math.min(Math.max(chains.length - 1, 0), model.breadth_max_chains);
}

/** One term on or off: the point prediction for a protocol with terms
 *  switched off (a term off is replaced by its neutral value). */
export function predictWithTerms(
  p: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  fit: FitResult,
  terms: TermsKept,
): number {
  const age = ageDays(asOf, p.listed_at);
  const cat = terms.cat ? fittedMultipleFor(p.category, fit) : fit.globalMultiple;
  const ch = terms.chain ? chainFactorFor(p, fit) : 1;
  const g = terms.growth ? growthMultiplier(p.change_7d, model).mult : 1;
  const m = terms.mat ? maturityMultiplier(age, model) : 1;
  const b = terms.breadth ? breadthMultiplier(p.chains, model) : 1;
  return Math.max(1, p.tvl_usd * cat * ch * g * m * b);
}

/** The five multipliers and the implied value one protocol gets, under a
 *  given kept-terms mask: the fitted multiple from the snapshot's own
 *  live-token record, times the primary-chain factor, times each kept term.
 *  No protocol name is ever special-cased. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  fit: FitResult,
  terms: TermsKept,
): { implied: number; categoryMult: number; chainMult: number; chain: string; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const categoryMult = terms.cat ? fittedMultipleFor(protocol.category, fit) : fit.globalMultiple;
  const chainMult = terms.chain ? chainFactorFor(protocol, fit) : 1;
  const chain = primaryChain(protocol);
  const { pct: growthPct, mult: growthMultRaw } = growthMultiplier(protocol.change_7d, model);
  const growthMult = terms.growth ? growthMultRaw : 1;
  const maturityMult = terms.mat ? maturityMultiplier(age, model) : 1;
  const breadthMult = terms.breadth ? breadthMultiplier(protocol.chains, model) : 1;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * categoryMult * chainMult * growthMult * maturityMult * breadthMult));
  return { implied, categoryMult, chainMult, chain, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** The term toggles for the ablation: each entry switches one term off. */
const TERM_OFFS: { term: TermName; off: TermsKept }[] = [
  { term: 'Category multiple', off: { cat: false, chain: true, growth: true, mat: true, breadth: true } },
  { term: 'Primary-chain multiple', off: { cat: true, chain: false, growth: true, mat: true, breadth: true } },
  { term: '7-day growth', off: { cat: true, chain: true, growth: false, mat: true, breadth: true } },
  { term: 'Tokenless age', off: { cat: true, chain: true, growth: true, mat: false, breadth: true } },
  { term: 'Chain breadth', off: { cat: true, chain: true, growth: true, mat: true, breadth: false } },
];

/** The ranking gain of the full model over TVL alone, as a multiplier:
 *  full Spearman divided by TVL-only Spearman, when the baseline is
 *  positive enough to divide by; null when it is not. */
function gainMultiplier(full: number, tvlOnly: number): number | null {
  if (!Number.isFinite(full) || !Number.isFinite(tvlOnly) || tvlOnly <= 0.05) return null;
  return full / tvlOnly;
}

/** The walk-forward test: fit the multiples on the live protocols DefiLlama
 *  listed before the median listing date, and judge the ranking on the ones
 *  listed on or after it. The fit never sees the future it is judged on.
 *  Live peers with no listing date are excluded, and the exclusion is counted. */
export function walkForwardTest(snapshot: Snapshot, model: ModelConstants = MODEL): WalkForwardResult {
  const live = livePeers(snapshot.protocols);
  const dated = live.filter((p) => p.listed_at !== null);
  const dates = dated.map((p) => p.listed_at!).sort();
  const cutoff = dates[Math.floor(dates.length / 2)]!;
  const train = dated.filter((p) => p.listed_at! < cutoff);
  const test = dated.filter((p) => p.listed_at! >= cutoff);
  const fit = fitMultiplesFrom(train);
  const actual = test.map((p) => p.mcap_usd!);
  const tvlOnly = spearmanRank(test.map((p) => p.tvl_usd), actual);
  const fullModel = spearmanRank(test.map((p) => predictWithTerms(p, snapshot.as_of, model, fit, ALL_TERMS)), actual);
  const terms = TERM_OFFS.map(({ term, off }) => {
    const withTerm = spearmanRank(test.map((p) => predictWithTerms(p, snapshot.as_of, model, fit, ALL_TERMS)), actual);
    const withoutTerm = spearmanRank(test.map((p) => predictWithTerms(p, snapshot.as_of, model, fit, off)), actual);
    return { term, withTerm, withoutTerm, delta: withTerm - withoutTerm };
  });
  return {
    cutoff,
    trainN: train.length,
    testN: test.length,
    excludedNoDate: live.length - dated.length,
    tvlOnly,
    fullModel,
    multiplier: gainMultiplier(fullModel, tvlOnly),
    terms,
  };
}

/** The leave-one-out test: for every live protocol, fit the multiples on all
 *  the others and predict the one left out. The pooled predictions are judged
 *  against the actual market caps, per term on and off. */
export function looTest(snapshot: Snapshot, model: ModelConstants = MODEL): LooResult {
  const live = livePeers(snapshot.protocols);
  const actual: number[] = [];
  const tvlPred: number[] = [];
  const fullPred: number[] = [];
  const offPred: number[][] = TERM_OFFS.map(() => []);
  const pctErrs: number[] = [];
  for (let i = 0; i < live.length; i++) {
    const held = live[i]!;
    const rest = live.filter((_, j) => j !== i);
    const fit = fitMultiplesFrom(rest);
    actual.push(held.mcap_usd!);
    tvlPred.push(held.tvl_usd);
    const full = predictWithTerms(held, snapshot.as_of, model, fit, ALL_TERMS);
    fullPred.push(full);
    pctErrs.push(Math.abs(full - held.mcap_usd!) / held.mcap_usd!);
    TERM_OFFS.forEach(({ off }, k) => {
      offPred[k]!.push(predictWithTerms(held, snapshot.as_of, model, fit, off));
    });
  }
  const tvlOnly = spearmanRank(tvlPred, actual);
  const fullModel = spearmanRank(fullPred, actual);
  pctErrs.sort((a, b) => a - b);
  const terms = TERM_OFFS.map(({ term }, k) => {
    const withTerm = fullModel;
    const withoutTerm = spearmanRank(offPred[k]!, actual);
    return { term, withTerm, withoutTerm, delta: withTerm - withoutTerm };
  });
  return {
    n: live.length,
    spearman: fullModel,
    mape: medianOf(pctErrs),
    tvlOnly,
    fullModel,
    multiplier: gainMultiplier(fullModel, tvlOnly),
    terms,
  };
}

/** The keep/drop verdict for every term: a term stays only when its mean
 *  ranking gain across the two blind tests is positive. */
export function termDecisions(wf: WalkForwardResult, loo: LooResult): TermBlindTest[] {
  return TERM_NAMES.map((term) => {
    const wfDelta = wf.terms.find((t) => t.term === term)?.delta ?? 0;
    const looDelta = loo.terms.find((t) => t.term === term)?.delta ?? 0;
    const meanDelta = (wfDelta + looDelta) / 2;
    return { term, wfDelta, looDelta, meanDelta, kept: meanDelta > 0 };
  });
}

/** The kept-terms mask from the decisions: a dropped term is neutral. */
export function keptTermsFrom(decisions: TermBlindTest[]): TermsKept {
  const kept = (term: TermName): boolean => decisions.find((d) => d.term === term)?.kept ?? true;
  return {
    cat: kept('Category multiple'),
    chain: kept('Primary-chain multiple'),
    growth: kept('7-day growth'),
    mat: kept('Tokenless age'),
    breadth: kept('Chain breadth'),
  };
}

/** The ranking the board actually ships, judged on the same two blind tests:
 *  the model with only the kept terms on, re-fit the same way (walk-forward on
 *  the earlier half, leave-one-out on every live protocol). The term tables
 *  judge the all-terms model, because that is what the gate decides on; this
 *  judges the model the board is built from, so the multipliers the dashboard
 *  reports describe the board, not the model the gate rejected. */
export function keptModelSpearman(
  snapshot: Snapshot,
  kept: TermsKept,
  model: ModelConstants = MODEL,
): { wfSpearman: number; wfMultiplier: number | null; looSpearman: number; looMultiplier: number | null } {
  const live = livePeers(snapshot.protocols);
  const dated = live.filter((p) => p.listed_at !== null);
  const dates = dated.map((p) => p.listed_at!).sort();
  const cutoff = dates[Math.floor(dates.length / 2)]!;
  const train = dated.filter((p) => p.listed_at! < cutoff);
  const test = dated.filter((p) => p.listed_at! >= cutoff);
  const fit = fitMultiplesFrom(train);
  const actual = test.map((p) => p.mcap_usd!);
  const tvlOnly = spearmanRank(test.map((p) => p.tvl_usd), actual);
  const wfSpearman = spearmanRank(test.map((p) => predictWithTerms(p, snapshot.as_of, model, fit, kept)), actual);
  const looActual: number[] = [];
  const looTvl: number[] = [];
  const looKept: number[] = [];
  for (const held of live) {
    const rest = live.filter((q) => q !== held);
    const f = fitMultiplesFrom(rest);
    looActual.push(held.mcap_usd!);
    looTvl.push(held.tvl_usd);
    looKept.push(predictWithTerms(held, snapshot.as_of, model, f, kept));
  }
  const looTvlOnly = spearmanRank(looTvl, looActual);
  const looSpearman = spearmanRank(looKept, looActual);
  return {
    wfSpearman,
    wfMultiplier: gainMultiplier(wfSpearman, tvlOnly),
    looSpearman,
    looMultiplier: gainMultiplier(looSpearman, looTvlOnly),
  };
}

/** Leave-one-out residuals under the final (kept-terms) model: for every live
 *  protocol, log(actual / predicted) with the fit excluding it. Every residual
 *  is out-of-sample. */
export function looResiduals(
  snapshot: Snapshot,
  model: ModelConstants,
  terms: TermsKept,
): { slug: string; bucket: string; logErr: number; actual: number; predicted: number }[] {
  const live = livePeers(snapshot.protocols);
  const out: { slug: string; bucket: string; logErr: number; actual: number; predicted: number }[] = [];
  for (let i = 0; i < live.length; i++) {
    const held = live[i]!;
    const rest = live.filter((_, j) => j !== i);
    const fit = fitMultiplesFrom(rest);
    const predicted = predictWithTerms(held, snapshot.as_of, model, fit, terms);
    out.push({
      slug: held.slug,
      bucket: categoryBucket(held.category),
      logErr: Math.log(held.mcap_usd! / predicted),
      actual: held.mcap_usd!,
      predicted,
    });
  }
  return out;
}

/** The conformal calibration: quantiles from the leave-one-out residuals, per
 *  bucket where the bucket holds at least CONFORMAL_MIN_BUCKET_N residuals,
 *  the global quantile elsewhere; plus the three-fold split-conformal coverage,
 *  measured where no part of the range trained. */
export function fitConformal(
  snapshot: Snapshot,
  model: ModelConstants,
  terms: TermsKept,
): ConformalCalibration {
  const residuals = looResiduals(snapshot, model, terms);
  const absAll = residuals.map((r) => Math.abs(r.logErr));
  const qGlobal = conformalQuantile(absAll, CONFORMAL_TARGET);
  const qByBucket: ConformalBucketQ[] = BUCKETS.map((bucket) => {
    const inBucket = residuals.filter((r) => r.bucket === bucket);
    if (inBucket.length >= CONFORMAL_MIN_BUCKET_N) {
      return { bucket, q: conformalQuantile(inBucket.map((r) => Math.abs(r.logErr)), CONFORMAL_TARGET), n: inBucket.length, source: 'bucket' as const };
    }
    return { bucket, q: qGlobal, n: inBucket.length, source: 'global' as const };
  });
  const qFor = (bucket: string): number => qByBucket.find((b) => b.bucket === bucket)?.q ?? qGlobal;
  let inside = 0;
  for (const r of residuals) {
    if (Math.abs(r.logErr) <= qFor(r.bucket)) inside++;
  }
  const looCoverage = residuals.length > 0 ? inside / residuals.length : 0;

  // Three-fold split conformal, rotated: fold f trains, f+1 calibrates, f+2 tests.
  const live = livePeers(snapshot.protocols);
  const folds: SnapshotProtocol[][] = [[], [], []];
  for (const p of live) folds[slugHash(p.slug) % 3]!.push(p);
  const splitCoverage: number[] = [];
  for (let f = 0; f < 3; f++) {
    const train = folds[f]!;
    const calib = folds[(f + 1) % 3]!;
    const test = folds[(f + 2) % 3]!;
    const fit = fitMultiplesFrom(train);
    const calibAbs: { bucket: string; v: number }[] = calib.map((p) => ({
      bucket: categoryBucket(p.category),
      v: Math.abs(Math.log(p.mcap_usd! / predictWithTerms(p, snapshot.as_of, model, fit, terms))),
    }));
    const globalQ = conformalQuantile(calibAbs.map((c) => c.v), CONFORMAL_TARGET);
    const bucketQ = new Map<string, number>();
    for (const bucket of BUCKETS) {
      const inBucket = calibAbs.filter((c) => c.bucket === bucket).map((c) => c.v);
      if (inBucket.length >= CONFORMAL_MIN_BUCKET_N) bucketQ.set(bucket, conformalQuantile(inBucket, CONFORMAL_TARGET));
    }
    let hit = 0;
    for (const p of test) {
      const predicted = predictWithTerms(p, snapshot.as_of, model, fit, terms);
      const q = bucketQ.get(categoryBucket(p.category)) ?? globalQ;
      if (Math.abs(Math.log(p.mcap_usd! / predicted)) <= q) hit++;
    }
    splitCoverage.push(test.length > 0 ? hit / test.length : 0);
  }
  return {
    target: CONFORMAL_TARGET,
    qGlobal,
    qByBucket,
    looCoverage,
    splitCoverage,
    splitMean: (splitCoverage[0]! + splitCoverage[1]! + splitCoverage[2]!) / 3,
  };
}

/** The conformal interval for one protocol, in whole dollars: the point
 *  estimate times exp(+/- the row's bucket quantile). It contains the point
 *  estimate by construction, and its width is the bucket's own uncertainty. */
export function conformalRange(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  calibration: ConformalCalibration,
  point: number,
): { lo: number; hi: number; q: number } {
  const q = calibration.qByBucket.find((b) => b.bucket === categoryBucket(protocol.category))?.q ?? calibration.qGlobal;
  const lo = Math.max(1, Math.round(point * Math.exp(-q)));
  const hi = Math.max(lo, Math.round(point * Math.exp(q)));
  return { lo, hi, q };
}

/** The adjustments together: the factor the point estimate and the
 *  range share, so a row's range is its point estimate's own uncertainty.
 *  The chain factor is part of it when a fit is given. */
export function adjustments(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  terms: TermsKept,
  fit?: FitResult,
): number {
  const { mult: growthMult } = growthMultiplier(protocol.change_7d, model);
  const age = ageDays(asOf, protocol.listed_at);
  const chain = fit !== undefined && terms.chain ? chainFactorFor(protocol, fit) : 1;
  return chain * (terms.growth ? growthMult : 1) * (terms.mat ? maturityMultiplier(age, model) : 1) * (terms.breadth ? breadthMultiplier(protocol.chains, model) : 1);
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A whole word wrapped, staked or staking anywhere in the name. */
const WRAPPED_OR_STAKED = /\b(wrapped|staked|staking)\b/i;
/** A name that begins with an exchange's name: an exchange's own product, not a launch. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Cross Chain Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Why a pre-token protocol is set aside instead of ranked, or null when it may be ranked.
 *  This is the watchlist's own rule, applied to the whole board: a wrapped, staked or
 *  bridged product of a token that already trades has no launch of its own. */
export function setAsideReason(p: SnapshotProtocol): string | null {
  if (p.category !== null && WRAPPED_CATEGORIES.has(p.category)) return `category ${p.category}: a wrapped, staked or bridged product of a token that already trades`;
  if (VERSIONED.test(p.name)) return 'versioned name: a pool of another protocol, not a launch of its own';
  if (WRAPPED_OR_STAKED.test(p.name)) return 'wrapped or staked name: a product of a token that already trades';
  if (EXCHANGE_PREFIX.test(p.name)) return 'exchange product: an exchange\'s own product, not a launch of its own';
  return null;
}

/** Whether a protocol is one the board may rank: pre-token and set aside by no rule. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && setAsideReason(p) === null;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** A rarity tier from the rank inside a board of `n`: top 5% Mythic, next 15% Rare,
 *  next 30% Uncommon, the rest Common. The tier is the rank's, never the name's. */
export function tierFor(rank: number, n: number): string {
  if (rank <= Math.max(1, Math.ceil(n * 0.05))) return 'S · Mythic';
  if (rank <= Math.ceil(n * 0.2)) return 'A · Rare';
  if (rank <= Math.ceil(n * 0.5)) return 'B · Uncommon';
  return 'C · Common';
}

/** A short dollar figure: $2.75B, $190.5M, $820K. */
function fmtShort(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

/** A short dollar figure with cents where it matters: $12.40, $58.20. */
function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return 'n/a';
  if (n >= 1000) return fmtShort(n);
  if (n >= 10) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(2)}`;
}

/** The value as an equation, with the numbers: TVL x fitted multiple x chain
 *  factor x each kept term, dropped terms shown at 1.00 and named, so the
 *  arithmetic can be checked from the snapshot alone. */
export function equationFor(
  p: SnapshotProtocol,
  v: { categoryMult: number; chainMult: number; chain: string; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null },
  terms: TermsKept,
  implied: number,
): string {
  const show = (label: string, value: number, kept: boolean): string =>
    `${label} ${kept ? value.toFixed(2) : '1.00 (dropped)'}`;
  return (
    `${fmtShort(implied)} = ${fmtShort(p.tvl_usd)} TVL × ${v.categoryMult.toFixed(2)} ${categoryBucket(p.category)} ` +
    `× ${show(`chain ${v.chain}`, v.chainMult, terms.chain)} × ${show('growth', v.growthMult, terms.growth)} × ${show('age', v.maturityMult, terms.mat)} × ${show('breadth', v.breadthMult, terms.breadth)}`
  );
}

/** Why this protocol ranks where it does, naming its drivers and its range. */
export function whyFor(
  p: SnapshotProtocol,
  v: { categoryMult: number; chainMult: number; chain: string; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null },
  rank: number,
  n: number,
  odds: number,
  lo: number,
  hi: number,
  widthX: number,
  call: string,
  evPerHour: number,
): string {
  const ageText =
    v.age === null
      ? 'age unrecorded'
      : v.age >= 730
        ? `${Math.floor(v.age / 365)}+ years with no token on record`
        : `${v.age} days with no token on record`;
  const growthText =
    v.growthPct >= 10
      ? `growing +${v.growthPct.toFixed(1)}% in 7 days`
      : v.growthPct <= -10
        ? `shrinking ${v.growthPct.toFixed(1)}% in 7 days`
        : `7-day growth ${v.growthPct >= 0 ? '+' : ''}${v.growthPct.toFixed(1)}%`;
  const chainText = p.chains.length >= 5 ? `, live on ${p.chains.length} chains` : p.chains.length >= 2 ? `, on ${p.chains.length} chains` : '';
  return (
    `Rank ${rank} of ${n}: ${fmtShort(p.tvl_usd)} TVL × ${p.category ?? 'uncategorised'} fitted ${v.categoryMult.toFixed(2)} × ${v.chain} chain factor ${v.chainMult.toFixed(2)} · ${ageText} · ${growthText}${chainText}. ` +
    `Token odds ${(odds * 100).toFixed(0)}% from its bucket's record. ` +
    `Conformal range ${fmtShort(lo)}–${fmtShort(hi)}, ${widthX.toFixed(1)}x wide. ` +
    `Expected ${fmtMoney(evPerHour)} per farm hour. Call: ${call}.`
  );
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** What one transaction costs on a chain, in dollars: the farm plan prices gas where the farmer pays it. */
export function gasFor(chain: string): number {
  const c = chain.toLowerCase();
  if (c.includes('ethereum')) return 8;
  if (c.includes('solana')) return 0.05;
  if (c.includes('bitcoin')) return 4;
  if (c.includes('tron')) return 2;
  if (c.includes('hyperliquid')) return 0.1;
  if (c.includes('polygon')) return 0.05;
  if (c.includes('base') || c.includes('arbitrum') || c.includes('optimism') || c.includes('blast') || c.includes('mode') || c.includes('ink') || c.includes('abstract') || c.includes('monad') || c.includes('berachain') || c.includes('linea') || c.includes('scroll') || c.includes('zksync') || c.includes('avalanche')) return 0.5;
  if (c.includes('binance') || c.includes('bnb')) return 0.3;
  return 2;
}

/** How much capital one farm position needs, from the protocol's own TVL: the minimum viable capital. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 250_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Hours the plan takes: setup, one weekly touch per week of the hold, check and exit. */
export function hoursFor(holdDays: number): number {
  return Math.round((0.25 + (holdDays / 7) * 0.17 + 0.34) * 100) / 100;
}

/** What farming one protocol costs in total. Gas is six transactions at the
 *  protocol's own chain price: fund, set up, second action, two weekly touches,
 *  exit. Difficulty is the capital and the gas together, never the name. */
export function farmSummary(p: SnapshotProtocol, age: number | null): FarmSummary {
  const capital = capitalFor(p);
  const gas = gasFor(chainOf(p));
  const hold = holdDaysFor(age);
  const difficulty = capital >= 250 && gas >= 2 ? 'Hard' : capital >= 150 || gas >= 2 ? 'Medium' : 'Easy';
  return { capital_usd: capital, gas_usd: gas, hold_days: hold, difficulty, est_total_usd: Math.round((capital + gas * 6) * 100) / 100 };
}

/** The farm economics of one row: the expected value of the farm, per hour
 *  and per dollar of capital, under the stated farmer-share assumption. */
export function farmEconomics(
  implied: number,
  odds: number,
  farm: FarmSummary,
): FarmEconomics {
  const ev = odds * implied * FARMER_SHARE;
  const hours = hoursFor(farm.hold_days);
  return {
    min_capital_usd: farm.capital_usd,
    hours,
    ev_usd: Math.round(ev * 100) / 100,
    ev_per_hour: Math.round((ev / hours) * 100) / 100,
    ev_per_capital: Math.round((ev / Math.max(1, farm.capital_usd)) * 10000) / 10000,
  };
}

/** The farm-call rule, stated as the program applied it. */
export const CALL_RULE =
  'Farm now: top third of the board by expected dollars per farm hour with token odds of at least 10%. ' +
  "Don't farm: bottom third by dollars per farm hour, or token odds below 3%. Wait: everything else. " +
  'The thirds are this board\u2019s own tertiles, never a fixed number.';

/** The farm assumption, stated as the program applied it. */
export const FARM_ASSUMPTION =
  'A qualifying farmer is assumed to capture 0.01% of a launch\u2019s implied value (FARMER_SHARE = 0.0001), the same for every row. ' +
  'Expected value = token odds × implied value × 0.01%, divided by the hours the plan takes. The share sets the scale of dollars per hour, never the ranking between rows.';

/** The farm call, in plain words, from the expected dollars per farm hour and
 *  the token odds. Farm now means the top third of this board by dollars per
 *  hour with odds worth farming; Don't farm means the bottom third, or odds so
 *  low the launch itself is unlikely; everything else is Wait. */
export function callFor(perHour: number, odds: number, lowCut: number, highCut: number): 'Farm now' | 'Wait' | "Don't farm" {
  if (perHour < lowCut || odds < CALL_ODDS_FLOOR) return "Don't farm";
  if (perHour >= highCut && odds >= CALL_ODDS_MIN) return 'Farm now';
  return 'Wait';
}

/** The category's core action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('uncollateralized')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open, so the loan book counts your address.`;
  if (c.includes('risk curator') || c.includes('capital allocator') || c.includes('yield aggregator') || c.includes('liquidity manager')) return `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('basis trading')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('rwa') || c.includes('stablecoin') || c.includes('dual-token')) return `Mint $${capital} of the yield-bearing asset through ${name} on ${chain} and hold it.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}, then leave the position to settle.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${chain} through ${name}'s own bridge and use it in one app on that chain.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('payment') || c.includes('card')) return `Load $${capital} onto ${name} on ${chain} and spend a small amount through it.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The second, different action a week later: one deposit is a snapshot, two actions are use. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `borrow $${Math.round(capital / 5)} against your supply on ${name} and repay it the same week`;
  if (c.includes('dex') || c.includes('yield') || c.includes('farm')) return `swap $${Math.round(capital / 5)} through ${name}'s main pool on ${chain}`;
  if (c.includes('risk curator') || c.includes('capital allocator') || c.includes('yield aggregator')) return `deposit $${Math.round(capital / 5)} into a second ${name} vault on ${chain}`;
  if (c.includes('rwa') || c.includes('stablecoin')) return `mint a second $${Math.round(capital / 5)} tranche through ${name} on ${chain}`;
  if (c.includes('prediction')) return `place a second, smaller market position on ${name}`;
  if (c.includes('derivative') || c.includes('perpetual')) return `close the hedge on ${name} and open a fresh one half its size`;
  return `make a small swap inside ${name} on ${chain}`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a
 * hand-written list of names. Gas is priced for the protocol's own first chain.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasFor(chain);
  const gasText = gas >= 1 ? `$${gas}` : `$${gas.toFixed(2)}`;
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const second = secondActionFor(p, capital, chain);
  const ageNote =
    age !== null && age >= 730
      ? ` This protocol has run ${Math.floor(age / 365)}+ years with no token on record, so staying in through one more quarterly snapshot matters.`
      : age !== null && age >= 365
        ? ` This protocol has run over a year with no token on record, so a longer hold counts for more.`
        : '';
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `about ${gasText} of gas to fund it on ${chain}`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about ${gasText} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `One week later, make a second, different on-chain action: ${second}.`,
      cost: `about ${gasText} of gas`,
      time: '10 minutes',
    },
    {
      text: `Repeat one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and never leave the position untouched for a full month.`,
      cost: `about ${gasText} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.${ageNote}`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Open the protocol's own points or rewards page from its official site and check your position is counted; claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction hash in a farm log; when you unwind, withdraw in two steps a day apart so no snapshot catches an empty wallet.`,
      cost: `about ${gasText} of gas to exit`,
      time: '10 minutes to log, 2 days to exit',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view:
 *  every protocol that records a token, not just the top 24, so the coverage
 *  files all 758 protocols. A live protocol's lane is Don't farm: its token
 *  already trades, so there is no launch left to farm. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      call: "Don't farm" as const,
      reason: 'token already trades: the launch already happened, so there is nothing left to farm',
    }));
}

/** The pre-token protocols set aside from the ranking, biggest first, with their
 *  reason and the floor value they are filed at: TVL times the global fitted
 *  multiple, the no-launch floor. A set-aside protocol's lane is Don't farm:
 *  it has no launch of its own. */
export function setAsideRows(snapshot: Snapshot, globalMultiple: number): SetAsideRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && setAsideReason(p) !== null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      reason: setAsideReason(p)!,
      floor_value_usd: Math.max(1, Math.round(p.tvl_usd * globalMultiple)),
      call: "Don't farm" as const,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    range_lo_usd: row.range_lo_usd,
    range_hi_usd: row.range_hi_usd,
    range_width_x: row.range_width_x,
    conformal_q: row.conformal_q,
    tier: row.tier,
    why: row.why,
    equation: row.equation,
    farm: row.farm,
    economics: row.economics,
    token_odds: row.token_odds,
    fitted_multiple: row.fitted_multiple,
    call: row.call,
    implied_per_farm_dollar: row.implied_per_farm_dollar,
    category_multiple: row.model.category_multiple,
    chain_multiple: row.model.chain_multiple,
    chain: row.model.chain,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    growth_pct: row.model.growth_pct,
    dropped_terms: row.dropped_terms,
    farm_steps: row.farm_steps,
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n and strictly
 *  falling implied values (an exact tie is nudged down one dollar so rank order is
 *  the value order). The fit, the odds, the blind tests and the conformal
 *  calibration are computed once from the snapshot and shared by every row: one
 *  fit, one board. The farm call is cut at the board's own tertiles of expected
 *  dollars per farm hour, so Farm now means the top third of this board by
 *  dollars per hour, never a fixed number. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): {
  board: BoardRow[];
  fit: FitResult;
  odds: TokenOdds[];
  overallOdds: number;
  walkForward: WalkForwardResult;
  loo: LooResult;
  termTests: TermBlindTest[];
  keptTerms: TermsKept;
  conformal: ConformalCalibration;
  checks: BuildCheck[];
  callCounts: { farm: number; wait: number; dont: number };
  coverage: Coverage;
} {
  const fit = fitMultiples(snapshot);
  const { odds, overall: overallOdds } = fitTokenOdds(snapshot);
  // The blind tests run first: they decide which terms the board may use.
  const walkForward = walkForwardTest(snapshot, model);
  const loo = looTest(snapshot, model);
  const termTests = termDecisions(walkForward, loo);
  const keptTerms = keptTermsFrom(termTests);
  const droppedTerms = termTests.filter((t) => !t.kept).map((t) => t.term);
  // The multipliers the dashboard reports are the shipped model's, not the
  // all-terms model's the gate decided on.
  const kept = keptModelSpearman(snapshot, keptTerms, model);
  walkForward.keptModel = kept.wfSpearman;
  walkForward.keptMultiplier = kept.wfMultiplier;
  loo.keptModel = kept.looSpearman;
  loo.keptMultiplier = kept.looMultiplier;
  const conformal = fitConformal(snapshot, model, keptTerms);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable protocol the watchlist leaves out, whatever its
  // TVL — above the floor (the watchlist leaves 19 out) and below it alike.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, fit, keptTerms);
    const o = tokenOddsFor(p.category, odds, overallOdds);
    const farm = farmSummary(p, v.age);
    const economics = farmEconomics(v.implied, o, farm);
    const perDollar = v.implied / Math.max(1, farm.est_total_usd);
    const range = conformalRange(p, snapshot.as_of, model, conformal, v.implied);
    const equation = equationFor(p, v, keptTerms, v.implied);
    return { p, ...v, odds: o, farm, economics, perDollar, range, equation };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const n = scored.length;
  // The call cutoffs: the tertiles of expected dollars per farm hour across
  // this board. A call is the board's own ranking of value for money.
  const perHour = scored.map((s) => s.economics.ev_per_hour).sort((a, b) => a - b);
  const lowCut = perHour[Math.floor(n / 3)]!;
  const highCut = perHour[Math.floor((2 * n) / 3)]!;
  let prev = Number.POSITIVE_INFINITY;
  const callCounts = { farm: 0, wait: 0, dont: 0 };
  const board: BoardRow[] = scored.map((s, i) => {
    let implied = s.implied;
    if (implied >= prev) implied = Math.max(1, prev - 1);
    prev = implied;
    const call = callFor(s.economics.ev_per_hour, s.odds, lowCut, highCut);
    if (call === 'Farm now') callCounts.farm++;
    else if (call === 'Wait') callCounts.wait++;
    else callCounts.dont++;
    const widthX = Math.round((s.range.hi / Math.max(1, s.range.lo)) * 10) / 10;
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.age,
      implied_value_usd: implied,
      range_lo_usd: s.range.lo,
      range_hi_usd: s.range.hi,
      range_width_x: widthX,
      conformal_q: Math.round(s.range.q * 1000) / 1000,
      tier: tierFor(i + 1, n),
      why: whyFor(s.p, s, i + 1, n, s.odds, s.range.lo, s.range.hi, widthX, call, s.economics.ev_per_hour),
      equation: s.equation,
      farm: s.farm,
      economics: s.economics,
      token_odds: Math.round(s.odds * 1000) / 1000,
      fitted_multiple: Math.round(s.categoryMult * 10000) / 10000,
      call,
      implied_per_farm_dollar: Math.round(s.perDollar * 100) / 100,
      model: {
        category_multiple: Math.round(s.categoryMult * 10000) / 10000,
        chain_multiple: round4(s.chainMult),
        chain: s.chain,
        growth_pct: s.growthPct,
        growth_multiplier: round4(s.growthMult),
        maturity_multiplier: round4(s.maturityMult),
        breadth_multiplier: round4(s.breadthMult),
        age_days: s.age,
      },
      dropped_terms: droppedTerms,
      farm_steps: farmSteps(s.p, s.age).map(stepText),
    };
  });

  // The first seven build-time checks. The eighth (output caps) is measured by
  // main.ts from the files it writes and appended before data.js is written.
  // Coverage: every protocol in the snapshot is filed in a lane, none omitted.
  const liveCount = snapshot.protocols.filter((p) => !isPreToken(p)).length;
  const setAsideCount = snapshot.protocols.filter((p) => isPreToken(p) && setAsideReason(p) !== null).length;
  const coverage: Coverage = {
    total: snapshot.protocols.length,
    ranked: board.length,
    live: liveCount,
    no_launch_floor: setAsideCount,
    farm_now: callCounts.farm,
    wait: callCounts.wait,
    dont_farm: callCounts.dont + liveCount + setAsideCount,
  };
  const coverageOk = coverage.ranked + coverage.live + coverage.no_launch_floor === coverage.total;
  const checks: BuildCheck[] = [];
  const issue = boardIssue(board, snapshot);
  checks.push({
    id: 'C1-board',
    name: 'Board gate',
    status: issue === null && coverageOk ? 'pass' : 'fail',
    detail:
      issue === null && coverageOk
        ? `all ${board.length} rows ranked 1..${board.length}, implied values strictly falling, every watchlist slug covered, farm steps 3–12 within 20–600 characters; coverage ${coverage.ranked} ranked + ${coverage.live} live + ${coverage.no_launch_floor} no-launch floor = ${coverage.total}/${coverage.total} filed`
        : (issue ?? `coverage files ${coverage.ranked + coverage.live + coverage.no_launch_floor} of ${coverage.total} protocols`),
  });
  const covOk =
    conformal.splitCoverage.every((c) => c >= 0.6 && c <= 0.95) &&
    conformal.splitMean >= 0.78 && conformal.splitMean <= 0.88 &&
    conformal.looCoverage >= 0.7 && conformal.looCoverage <= 0.9;
  checks.push({
    id: 'C2-conformal',
    name: 'Conformal coverage',
    status: covOk ? 'pass' : 'fail',
    detail: `split-conformal coverage ${conformal.splitCoverage.map((c) => `${(c * 100).toFixed(1)}%`).join(' / ')} (mean ${(conformal.splitMean * 100).toFixed(1)}%, target ${(conformal.target * 100).toFixed(0)}%); leave-one-out coverage ${(conformal.looCoverage * 100).toFixed(1)}%`,
  });
  const termsOk =
    termTests.every((t) => Number.isFinite(t.wfDelta) && Number.isFinite(t.looDelta)) &&
    Number.isFinite(walkForward.keptModel) && Number.isFinite(loo.keptModel);
  const blindKept = ((walkForward.keptModel ?? NaN) + (loo.keptModel ?? NaN)) / 2;
  const blindTvl = (walkForward.tvlOnly + loo.tvlOnly) / 2;
  checks.push({
    id: 'C3-terms',
    name: 'Blind-test term table',
    status: termsOk && blindKept >= blindTvl - 0.05 ? 'pass' : 'fail',
    detail: `all five terms tested on walk-forward and leave-one-out; kept ${termTests.filter((t) => t.kept).length}/5 (${termTests.filter((t) => t.kept).map((t) => t.term).join(', ') || 'none'}); shipped-model mean blind Spearman ${blindKept.toFixed(3)} vs TVL-only ${blindTvl.toFixed(3)}`,
  });
  const slugs = snapshot.protocols.map((p) => p.slug);
  const dupes = slugs.length - new Set(slugs).size;
  const missingWatch = snapshot.watchlist.filter((s) => !index.has(s));
  const snapOk =
    snapshot.protocols.length >= 700 && snapshot.watchlist.length >= 30 && dupes === 0 && missingWatch.length === 0;
  checks.push({
    id: 'C4-snapshot',
    name: 'Snapshot integrity',
    status: snapOk ? 'pass' : 'fail',
    detail: `${snapshot.protocols.length} protocols, watchlist ${snapshot.watchlist.length}, ${dupes} duplicate slugs, ${missingWatch.length} watchlist slugs missing from the protocols`,
  });
  const wfOk =
    walkForward.trainN >= 20 && walkForward.testN >= 20 &&
    Number.isFinite(walkForward.fullModel) && Number.isFinite(walkForward.tvlOnly);
  checks.push({
    id: 'C6-walkforward',
    name: 'Walk-forward test',
    status: wfOk ? 'pass' : 'fail',
    detail: `fit on ${walkForward.trainN} earlier-listed live peers (before ${walkForward.cutoff}), tested on ${walkForward.testN} later-listed; full Spearman ${walkForward.fullModel.toFixed(3)} vs TVL-only ${walkForward.tvlOnly.toFixed(3)}${walkForward.multiplier === null ? '' : ` (×${walkForward.multiplier.toFixed(2)})`}; shipped model ${walkForward.keptModel?.toFixed(3)}${walkForward.keptMultiplier === null || walkForward.keptMultiplier === undefined ? '' : ` (×${walkForward.keptMultiplier.toFixed(2)})`}; ${walkForward.excludedNoDate} live peers have no listing date and were excluded`,
  });
  const looOk =
    loo.n >= 100 && Number.isFinite(loo.spearman) && Number.isFinite(loo.mape) && loo.mape >= 0 && loo.mape <= 5;
  checks.push({
    id: 'C7-loo',
    name: 'Leave-one-out test',
    status: looOk ? 'pass' : 'fail',
    detail: `every one of ${loo.n} live peers predicted from the other ${loo.n - 1}; pooled Spearman ${loo.spearman.toFixed(3)} vs TVL-only ${loo.tvlOnly.toFixed(3)}${loo.multiplier === null ? '' : ` (×${loo.multiplier.toFixed(2)})`}; shipped model ${loo.keptModel?.toFixed(3)}${loo.keptMultiplier === null || loo.keptMultiplier === undefined ? '' : ` (×${loo.keptMultiplier.toFixed(2)})`}; median error ${(loo.mape * 100).toFixed(1)}%`,
  });
  const farmOk = board.every((r) => Number.isFinite(r.economics.ev_per_hour) && r.economics.ev_per_hour > 0 && r.economics.min_capital_usd >= 50 && r.economics.min_capital_usd <= 250 && Number.isFinite(r.economics.hours) && r.economics.hours > 0);
  const evs = board.map((r) => r.economics.ev_per_hour);
  checks.push({
    id: 'C8-farm',
    name: 'Farm economics',
    status: farmOk ? 'pass' : 'fail',
    detail: `every row has a positive expected dollars-per-hour under the stated 0.01% farmer share; $/hour spans ${fmtMoney(Math.min(...evs))}–${fmtMoney(Math.max(...evs))}; minimum viable capital $${Math.min(...board.map((r) => r.economics.min_capital_usd))}–$${Math.max(...board.map((r) => r.economics.min_capital_usd))}`,
  });
  return { board, fit, odds, overallOdds, walkForward, loo, termTests, keptTerms, conformal, checks, callCounts, coverage };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Everything the dashboard renders, from the snapshot. The eighth build-time
 *  check (output caps) is appended by main.ts before data.js is written. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { board, fit, odds, overallOdds, walkForward, loo, termTests, keptTerms, conformal, checks, callCounts, coverage } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const setAside = setAsideRows(snapshot, fit.globalMultiple);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug) && r.tvl_usd < snapshot.floor_usd).length;
  const aboveFloor = board.filter((r) => !snapshot.watchlist.includes(r.slug) && r.tvl_usd >= snapshot.floor_usd).length;
  const values = board.map((r) => r.implied_value_usd).sort((a, b) => a - b);
  const total = board.reduce((n, r) => n + r.implied_value_usd, 0);
  const median = values.length % 2 === 1 ? values[(values.length - 1) / 2]! : Math.round((values[values.length / 2 - 1]! + values[values.length / 2]!) / 2);
  const kpi: KpiStrip = {
    as_of: snapshot.as_of,
    protocols: snapshot.protocols.length,
    live_peers: livePeers(snapshot.protocols).length,
    watchlist: snapshot.watchlist.length,
    board_rows: board.length,
    wf_spearman: walkForward.keptModel ?? walkForward.fullModel,
    loo_spearman: loo.keptModel ?? loo.spearman,
    conformal_coverage: conformal.splitMean,
    terms_kept: termTests.filter((t) => t.kept).length,
    terms_dropped: termTests.filter((t) => !t.kept).map((t) => t.term),
    checks_pass: checks.filter((c) => c.status === 'pass').length,
    checks_total: checks.length + 1,
  };
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    above_floor_size: aboveFloor,
    live_size: live.length,
    set_aside_size: setAside.length,
    total_implied_usd: total,
    median_implied_usd: median,
    watchlist: [...snapshot.watchlist].sort(),
    rows: board.map(radarRow),
    live,
    set_aside: setAside,
    fitted: fit,
    odds,
    overall_odds: overallOdds,
    walk_forward: walkForward,
    loo,
    term_tests: termTests,
    conformal,
    farm_assumption: FARM_ASSUMPTION,
    checks,
    call_rule: CALL_RULE,
    call_counts: callCounts,
    coverage,
    kpi,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd !== 'number' ? null : p.mcap_usd,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!(r.range_lo_usd > 0) || !(r.range_hi_usd >= r.range_lo_usd) || !(r.range_lo_usd <= r.implied_value_usd && r.implied_value_usd <= r.range_hi_usd)) {
      return `${r.slug} has a range that does not contain its implied value`;
    }
    if (!(r.economics.ev_per_hour > 0) || !Number.isFinite(r.economics.ev_per_hour)) return `${r.slug} has no positive dollars per farm hour`;
    if (r.equation.length < 20) return `${r.slug} has no equation`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
