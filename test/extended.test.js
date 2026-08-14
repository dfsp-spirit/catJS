/**
 * Tests for the extended catR port: ML/BM/WL estimation, priors, bOpt
 * selection, genPattern, checkStopRule and the minimal randomCAT loop.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pi,
  ii,
  ji,
  qnorm,
  uniroot,
  optimizeScalar,
  thetaEst,
  semTheta,
  nextItem,
  genPattern,
  simulateRespondents,
  checkStopRule,
  randomCAT,
} from '../src/index.js';

const easy = { a: 1.0, b: -1.0, c: 0.2, d: 0.95 };
const hard = { a: 1.5, b: 1.0, c: 0.1, d: 0.98 };
const bank = [easy, hard];
// Larger bank so randomCAT can run several steps.
const bigBank = [
  { a: 0.8, b: -2.0, c: 0.10, d: 0.97 },
  { a: 1.1, b: -1.0, c: 0.15, d: 0.98 },
  { a: 1.3, b: 0.0, c: 0.20, d: 0.98 },
  { a: 1.2, b: 1.0, c: 0.15, d: 0.97 },
  { a: 0.9, b: 2.0, c: 0.10, d: 0.96 },
  { a: 1.0, b: 0.5, c: 0.05, d: 0.99 },
];

// --- qnorm / uniroot / optimizeScalar ---
test('qnorm matches known standard normal quantiles', () => {
  // Acklam's approximation is accurate to ~1.15e-9 relative (~2e-9 at |z|~2).
  assert.ok(Math.abs(qnorm(0.5) - 0) < 1e-9);
  assert.ok(Math.abs(qnorm(0.975) - 1.959963984540054) < 1e-8);
  assert.ok(Math.abs(qnorm(0.025) + 1.959963984540054) < 1e-8);
});

test('uniroot finds a simple root', () => {
  const root = uniroot((x) => x * x - 2, 0, 2, 1e-12);
  assert.ok(Math.abs(root - Math.sqrt(2)) < 1e-9);
  assert.throws(() => uniroot((x) => x * x + 1, -1, 1), /opposite signs/);
});

test('optimizeScalar finds min and max', () => {
  const f = (x) => (x - 0.3) ** 2;
  const mn = optimizeScalar(f, -1, 1);
  assert.ok(Math.abs(mn.x - 0.3) < 1e-6);
  const mx = optimizeScalar((x) => -((x - 0.3) ** 2), -1, 1, { maximize: true });
  assert.ok(Math.abs(mx.x - 0.3) < 1e-6);
});

// --- derivatives (Ji) ---
test('ji matches dP*d2P/(P*Q)', () => {
  const { P, dP, d2P } = pi(0.2, hard);
  const expect = (dP * d2P) / (P * (1 - P));
  assert.ok(Math.abs(ji(0.2, hard).Ji - expect) < 1e-15);
});

test('ii returns finite derivatives', () => {
  const { Ii, dIi, d2Ii } = ii(0.2, hard);
  assert.ok(Number.isFinite(Ii) && Number.isFinite(dIi) && Number.isFinite(d2Ii));
});

// --- ML / BM / WL estimation ---
test('ML/BM/WL produce finite estimates that move with responses', () => {
  for (const method of ['ML', 'BM', 'WL']) {
    const it = [easy, hard];
    const up = thetaEst(it, [1, 1], { method });
    const down = thetaEst(it, [0, 0], { method });
    assert.ok(Number.isFinite(up), `${method} up finite`);
    assert.ok(Number.isFinite(down), `${method} down finite`);
    assert.ok(up >= down, `${method}: up(${up}) >= down(${down})`);
  }
});

test('BM agrees with ML under a flat (unif) prior', () => {
  // BM + unif prior reduces to ML over the prior interval in catR.
  const it = [easy, hard];
  const bm = thetaEst(it, [1, 0], { method: 'BM', priorDist: 'unif', priorPar: [-4, 4] });
  const ml = thetaEst(it, [1, 0], { method: 'ML' });
  assert.ok(Math.abs(bm - ml) < 1e-6, `bm=${bm} ml=${ml}`);
});

test('semTheta: ML = 1/sqrt(info), BM(norm) = 1/sqrt(info + 1/sd^2)', () => {
  const it = [easy, hard];
  const th = 0.5;
  let info = 0;
  for (const item of it) info += ii(th, item).Ii;
  assert.ok(Math.abs(semTheta(th, it, [1, 0], { method: 'ML' }) - 1 / Math.sqrt(info)) < 1e-12);
  assert.ok(
    Math.abs(semTheta(th, it, [1, 0], { method: 'BM' }) - 1 / Math.sqrt(info + 1)) < 1e-12,
  );
  assert.ok(Math.abs(semTheta(th, it, [1, 0], { method: 'WL' }) - 1 / Math.sqrt(info)) < 1e-12);
});

// --- EAP with non-default priors ---
test('EAP with unif prior is finite', () => {
  const th = thetaEst([easy, hard], [1, 0], { method: 'EAP', priorDist: 'unif', priorPar: [0, 1] });
  assert.ok(Number.isFinite(th));
});

test('EAP with Jeffreys prior is finite', () => {
  const th = thetaEst([easy, hard], [1, 0], { method: 'EAP', priorDist: 'Jeffreys' });
  assert.ok(Number.isFinite(th));
});

// --- bOpt selection ---
test('bOpt picks the item whose difficulty is closest to theta', () => {
  // At theta=0, easy (b=-1) and hard (b=1) are equidistant -> tie set of both
  const sel = nextItem(bank, 0, [], { criterion: 'bOpt' });
  assert.ok([0, 1].includes(sel.item));
  // At theta=-0.9, easy is strictly closer
  const sel2 = nextItem(bank, -0.9, [], { criterion: 'bOpt' });
  assert.equal(sel2.item, 0);
  // administered items are excluded
  const sel3 = nextItem(bank, -0.9, [0], { criterion: 'bOpt' });
  assert.equal(sel3.item, 1);
});

// --- genPattern / simulateRespondents ---
test('genPattern uses Pi probabilities with an injectable rng', () => {
  // rng always 0 -> always below P -> always correct
  const p0 = genPattern(0, bank, { rng: () => 0 });
  assert.deepEqual(p0, [1, 1]);
  // rng always ~1 -> always above P -> always incorrect
  const p1 = genPattern(0, bank, { rng: () => 0.9999 });
  assert.deepEqual(p1, [0, 0]);
  // matches catR Pi at theta=0
  const p = genPattern(0, bank, { rng: () => 0.5 });
  assert.equal(p[0], pi(0, easy).P >= 0.5 ? 1 : 0);
  assert.equal(p[1], pi(0, hard).P >= 0.5 ? 1 : 0);
});

test('simulateRespondents returns a matrix (respondents x items)', () => {
  const m = simulateRespondents([0, 1], bank, { rng: () => 0.1 });
  assert.equal(m.length, 2);
  assert.equal(m[0].length, 2);
});

// --- checkStopRule ---
test('checkStopRule: length and precision rules', () => {
  assert.equal(checkStopRule(0, 1, 5, { rule: ['length'], thr: [20] }).decision, false);
  assert.equal(checkStopRule(0, 1, 25, { rule: ['length'], thr: [20] }).decision, true);
  assert.equal(checkStopRule(0, 0.1, 5, { rule: ['precision'], thr: [0.2] }).decision, true);
  assert.equal(checkStopRule(0, 0.5, 5, { rule: ['precision'], thr: [0.2] }).decision, false);
});

test('checkStopRule: classification rule excludes the threshold', () => {
  // th=2, se=0.1 -> 95% CI [1.804, 2.196] entirely above 1.5 -> stop
  assert.equal(checkStopRule(2, 0.1, 5, { rule: ['classification'], thr: [1.5] }).decision, true);
  // th=0, se=0.5 -> CI [-0.98, 0.98] straddles 0 -> no stop
  assert.equal(checkStopRule(0, 0.5, 5, { rule: ['classification'], thr: [0] }).decision, false);
  // th=0, se=0.5 -> CI [-0.98, 0.98] entirely below 1.5 -> stop
  assert.equal(checkStopRule(0, 0.5, 5, { rule: ['classification'], thr: [1.5] }).decision, true);
});

test('checkStopRule: minInfo rule requires items', () => {
  assert.equal(
    checkStopRule(0, 0.1, 5, { rule: ['minInfo'], thr: [1e6], items: bank }).decision,
    true,
  );
  assert.throws(() => checkStopRule(0, 0.1, 5, { rule: ['minInfo'], thr: [1] }), /items/);
});

test('checkStopRule returns which rule triggered', () => {
  const r = checkStopRule(0, 0.05, 30, { rule: ['length', 'precision'], thr: [20, 0.1] });
  assert.deepEqual(r.rule.sort(), ['length', 'precision']);
  assert.equal(r.decision, true);
});

// --- randomCAT ---
test('randomCAT replays a fixed response sequence', () => {
  const responses = [1, 0, 1, 0, 1];
  const run = randomCAT(0.5, bigBank, {
    method: 'EAP',
    responses,
    stop: { rule: ['length'], thr: [20] },
    rng: () => 0.5,
  });
  assert.equal(run.nItems, responses.length);
  assert.deepEqual(run.responses, responses);
  assert.equal(run.administered.length, responses.length);
  assert.ok(run.thetaHist.every((t) => Number.isFinite(t)));
  assert.ok(run.seHist.every((s) => Number.isFinite(s)));
});

test('randomCAT stops early on a precision rule', () => {
  const run = randomCAT(0.5, bigBank, {
    method: 'EAP',
    stop: { rule: ['precision'], thr: [1e-9] },
    maxSteps: 50,
    rng: () => 0.5,
  });
  // A very tight precision threshold never triggers on a 6-item bank, so it
  // should run to the bank size.
  assert.equal(run.nItems, bigBank.length);
  assert.equal(run.stopRule, null);
});

test('randomCAT stops at the item-bank size', () => {
  const run = randomCAT(0.5, bigBank, { method: 'EAP', rng: () => 0.5 });
  assert.equal(run.nItems, bigBank.length);
  assert.ok(run.stopRule === null || Array.isArray(run.stopRule));
});
