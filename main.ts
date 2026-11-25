// Token Radar, Max Score Edition (Node 22, standard library only).
//
// The program reads the sealed snapshot from /input/snapshot.json (or --input
// <file|dir>), scores every rankable pre-token protocol with the radar-6 model
// in lib/model.ts, writes the ranked board to /output/board.json, and copies this
// repository's dashboard/ and screenshots/ to /output. Last, it writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library.
//
// radar-6 fits each category's TVL multiple from the snapshot's own live-token
// protocols (median market-cap / TVL per bucket, winsorized at 5.0, shrunk
// toward the global median, thin buckets shrunk hard), fits a primary-chain
// multiple the same way, gives every protocol token odds from its bucket's
// record, and then earns every term on two blind tests: walk-forward (fit on
// earlier-listed protocols, test on later-listed ones) and leave-one-out
// (every live protocol predicted from the rest). A term that hurts on the
// blind tests is dropped, and the dashboard names it. Ranges are conformal
// intervals from leave-one-out residuals, per bucket where the bucket holds
// enough residuals, with coverage measured separately by three-fold split
// conformal. Farm plans are costed in expected dollars per farm hour under a
// stated 0.01% farmer share, sized to a minimum viable capital, and every row
// shows its value as an equation. The board ranks the 197 rankable pre-token
// protocols and files all 758 protocols in lanes: 197 ranked, 416 live
// (token already trades), 145 on the no-launch floor. No multiple is hand-set.
//
// The dashboard is a static page, no framework and no network: dashboard/index.html,
// dashboard/app.css and dashboard/app.js read /output/data.js, which this program
// writes from the same board. The board ranks the 197 rankable pre-token protocols
// — the whole watchlist, every other rankable pre-token protocol — and the
// dashboard files all 758 protocols in lanes: the 197 ranked, the 416 that
// already trade, and the 145 set aside on the no-launch floor.
//
// The program refuses to write a board that fails any of its eight build-time
// checks (the cover shows them): the board gate (including 758/758 coverage),
// the conformal coverage, the blind-test term table, the snapshot's integrity,
// the output caps, the walk-forward test, the leave-one-out test, and the farm
// economics.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import type { BuildCheck } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

// Check C5, the output caps, from the source files, before anything is written:
// the dashboard's source must fit the dossier's text whole (65,536 bytes), and
// the screenshots must be 3 or 4 whole images within their caps. It is spliced
// in as the fifth check so the cover reads C1..C8 in order.
const dashboardDir = join(here, 'dashboard');
const dashboardBytes = readdirSync(dashboardDir)
  .filter((n) => !n.startsWith('.'))
  .reduce((sum, n) => sum + statSync(join(dashboardDir, n)).size, 0);
const shotNames = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).filter((n) => !n.startsWith('.'))
  : [];
const shotSizes = shotNames.map((n) => ({ name: n, bytes: statSync(join(here, 'screenshots', n)).size }));
const badShot = shotSizes.find((s) => !IMAGE_NAME.test(s.name) || s.bytes > SCREENSHOT_CAPS.max_bytes);
const capsOk =
  dashboardBytes <= TEXT_MAX_BYTES &&
  shotNames.length >= 3 &&
  shotNames.length <= SCREENSHOT_CAPS.max &&
  badShot === undefined &&
  board.length > 0;
const check5: BuildCheck = {
  id: 'C5-caps',
  name: 'Output caps',
  status: capsOk ? 'pass' : 'fail',
  detail:
    `dashboard source ${dashboardBytes.toLocaleString('en-US')} bytes (cap ${TEXT_MAX_BYTES.toLocaleString('en-US')}), ` +
    `${shotNames.length} screenshots (${shotSizes.map((s) => `${s.name} ${(s.bytes / 1024).toFixed(0)}KB`).join(', ')}, cap ${SCREENSHOT_CAPS.max} at ${(SCREENSHOT_CAPS.max_bytes / 1024).toFixed(0)}KB each), ` +
    `${board.length} board rows` +
    (badShot === undefined ? '' : ` — ${badShot.name} breaks its cap`),
};
radar.checks.splice(4, 0, check5);
radar.kpi.checks_pass = radar.checks.filter((c) => c.status === 'pass').length;
radar.kpi.checks_total = radar.checks.length;

const failed = radar.checks.filter((c) => c.status === 'fail');
if (failed.length > 0) {
  for (const c of radar.checks) process.stderr.write(`token radar: check ${c.id} ${c.status}: ${c.detail}\n`);
  process.stderr.write(`token radar: ${failed.length} build-time check(s) failed, refusing to write a board\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

const fmtPct = (n: number): string => `${(n * 100).toFixed(1)}%`;
const fmtMult = (m: number | null): string => (m === null ? 'n/a' : `x${m.toFixed(2)}`);
process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.above_floor_size} above the floor, ${radar.set_aside_size} set aside, ${radar.live_size} live); coverage ${radar.coverage.ranked} ranked + ${radar.coverage.live} live + ${radar.coverage.no_launch_floor} no-launch floor = ${radar.coverage.total}/${radar.coverage.total} filed\n` +
    `token radar: fitted multiples from ${radar.fitted.globalPeers} live peers (global median ${radar.fitted.globalMultiple}, winsor ${radar.fitted.winsorCap}, thin buckets n<${radar.fitted.thinBucketN} shrunk k=${radar.fitted.thinShrinkK}): ` +
    radar.fitted.multiples.map((m) => `${m.bucket} ${m.multiple}${m.source === 'global' ? '*' : ''} (n=${m.peers})`).join(', ') + '\n' +
    `token radar: primary-chain multiples (global ${radar.fitted.chain.globalMultiple}): ` +
    radar.fitted.chain.multiples.map((m) => `${m.chain} ${m.multiple} (n=${m.peers})`).join(', ') + '\n' +
    `token radar: walk-forward (fit before ${radar.walk_forward.cutoff}, test after): Spearman ${radar.walk_forward.fullModel.toFixed(3)} vs TVL-only ${radar.walk_forward.tvlOnly.toFixed(3)} (multiplier ${fmtMult(radar.walk_forward.multiplier)}); shipped model ${radar.walk_forward.keptModel?.toFixed(3)} (multiplier ${fmtMult(radar.walk_forward.keptMultiplier ?? null)}); ` +
    radar.walk_forward.terms.map((t) => `${t.term} ${t.delta >= 0 ? '+' : ''}${t.delta.toFixed(3)}`).join(', ') + '\n' +
    `token radar: leave-one-out (n=${radar.loo.n}): Spearman ${radar.loo.spearman.toFixed(3)} vs TVL-only ${radar.loo.tvlOnly.toFixed(3)} (multiplier ${fmtMult(radar.loo.multiplier)}), MAPE ${(radar.loo.mape * 100).toFixed(1)}%; shipped model ${radar.loo.keptModel?.toFixed(3)} (multiplier ${fmtMult(radar.loo.keptMultiplier ?? null)}); ` +
    radar.loo.terms.map((t) => `${t.term} ${t.delta >= 0 ? '+' : ''}${t.delta.toFixed(3)}`).join(', ') + '\n' +
    `token radar: term decisions (mean blind delta): ` +
    radar.term_tests.map((t) => `${t.term} ${t.meanDelta >= 0 ? '+' : ''}${t.meanDelta.toFixed(3)} ${t.kept ? 'KEPT' : 'DROPPED'}`).join(', ') + '\n' +
    `token radar: conformal ranges (target ${fmtPct(radar.conformal.target)}): split coverage ${radar.conformal.splitCoverage.map(fmtPct).join(' / ')} (mean ${fmtPct(radar.conformal.splitMean)}), LOO coverage ${fmtPct(radar.conformal.looCoverage)}, q global ${radar.conformal.qGlobal.toFixed(3)}\n` +
    `token radar: farm economics (farmer share 0.01%): $/hour median $${radar.rows.length > 0 ? [...radar.rows].sort((a, b) => a.economics.ev_per_hour - b.economics.ev_per_hour)[Math.floor(radar.rows.length / 2)]!.economics.ev_per_hour.toFixed(2) : 'n/a'}, range $${Math.min(...radar.rows.map((r) => r.economics.ev_per_hour)).toFixed(2)}–$${Math.max(...radar.rows.map((r) => r.economics.ev_per_hour)).toFixed(2)}; min capital $${Math.min(...radar.rows.map((r) => r.economics.min_capital_usd))}–$${Math.max(...radar.rows.map((r) => r.economics.min_capital_usd))}\n` +
    `token radar: farm calls: Farm now ${radar.call_counts.farm}, Wait ${radar.call_counts.wait}, Don't farm ${radar.call_counts.dont}\n` +
    `token radar: checks: ` + radar.checks.map((c) => `${c.id} ${c.status}`).join(', ') + '\n' +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (3 files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
