/**
 * Unit tests for the catR port. Uses Node's built-in test runner (no deps).
 *
 * Reference values are computed from the catR source formulas in
 * ~/builds_and_patches/catR/R (eapEst.R, eapSem.R, Pi.R, Ii.R, nextItem.R,
 * integrate.catR.R). For true end-to-end parity against the real R package,
 * run `npm run gen:reference` + `npm run validate`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pi,
  ii,
  eapEst,
  eapSem,
  thetaEst,
  semTheta,
  nextItem,
  estimateTheta,
  selectNextItem,
  dnorm,
  linspace,
  integrateCatR,
} from '../src/index.js';

// A couple of items with normal parameters
const easy = { a: 1.0, b: -1.0, c: 0.2, d: 0.95 };
const hard = { a: 1.5, b: 1.0, c: 0.1, d: 0.98 };

test('dnorm matches the standard normal density', () => {
  assert.ok(Math.abs(dnorm(0) - 0.3989422804014327) < 1e-15);
  assert.ok(Math.abs(dnorm(1) - 0.24197072451914337) < 1e-15);
});

test('linspace matches R seq', () => {
  assert.deepEqual(linspace(0, 1, 5), [0, 0.25, 0.5, 0.75, 1]);
  const x = linspace(-4, 4, 33);
  assert.equal(x.length, 33);
  assert.equal(x[0], -4);
  assert.equal(x[32], 4);
  assert.equal(x[16], 0);
});

test('integrateCatR integrates a constant (trapezoid)', () => {
  const x = [0, 1, 2, 3];
  const y = [2, 2, 2, 2];
  assert.equal(integrateCatR(x, y), 6);
});

test('pi matches the 4PL formula with catR clamping', () => {
  const { P, dP } = pi(0, easy);
  // e = exp(1 * 1.0 * (0 - (-1))) = e^1
  const e = Math.exp(1);
  const Pexpect = 0.2 + (0.95 - 0.2) * (e / (1 + e));
  const dPexpect = (1 * 1.0 * e * (0.95 - 0.2)) / (1 + e) ** 2;
  assert.ok(Math.abs(P - Pexpect) < 1e-15);
  assert.ok(Math.abs(dP - dPexpect) < 1e-15);
  // monotonic in theta
  assert.ok(pi(-5, hard).P < pi(0, hard).P && pi(0, hard).P < pi(5, hard).P);
  // bounds
  const pLo = pi(-100, hard).P;
  const pHi = pi(100, hard).P;
  assert.ok(pLo >= hard.c && pHi <= hard.d);
});

test('pi clamps P==0 like catR (and matches its overflow behavior)', () => {
  // Item with c=0 and theta far below b: exp underflows to 0 -> P=0 exactly,
  // which catR clamps to 1e-10.
  const item = { a: 1, b: 0, c: 0, d: 1 };
  const farLow = pi(-1000, item).P;
  assert.equal(farLow, 1e-10);
  // theta far above b: exp overflows to Inf -> Inf/(1+Inf) = NaN, exactly as
  // in R/catR (the Pi==1 clamp is effectively unreachable for the logistic).
  const farHigh = pi(1000, item).P;
  assert.ok(Number.isNaN(farHigh), 'catR gives NaN on logistic overflow');
});

test('ii matches dP^2 / (P*Q)', () => {
  const { P, dP } = pi(0.5, hard);
  const expect = (dP * dP) / (P * (1 - P));
  assert.ok(Math.abs(ii(0.5, hard).Ii - expect) < 1e-15);
});

test('eapEst returns ~prior mean with a single weak response', () => {
  // One easy item, correct answer: EAP should be > 0 but small
  const th = eapEst([easy], [1]);
  assert.ok(th > 0 && th < 2, `expected small positive, got ${th}`);
  // all-correct vs all-incorrect on the same item must move in the right direction
  const up = eapEst([easy], [1]);
  const down = eapEst([easy], [0]);
  assert.ok(up > down, `expected up(${up}) > down(${down})`);
});

test('eapSem is finite and positive for a real pattern', () => {
  const it = [easy, hard];
  const x = [1, 0];
  const th = eapEst(it, x);
  const se = eapSem(th, it, x);
  assert.ok(Number.isFinite(se) && se > 0);
});

test('thetaEst / semTheta mirror eapEst / eapSem', () => {
  const it = [easy, hard];
  const x = [1, 0];
  assert.equal(thetaEst(it, x, { method: 'EAP' }), eapEst(it, x));
  const th = thetaEst(it, x);
  assert.equal(semTheta(th, it, x, { method: 'EAP' }), eapSem(th, it, x));
});

test('thetaEst rejects non-EAP methods (not implemented)', () => {
  assert.throws(() => thetaEst([easy], [1], { method: 'ML' }), /not implemented/);
});

test('nextItem picks the item with maximum information at theta', () => {
  // At theta very negative, easy (-1) has more info than hard (+1)
  const bank = [hard, easy];
  const sel = nextItem(bank, -5, [], { criterion: 'MFI' });
  assert.equal(sel.item, 1); // easy item
  const sel2 = nextItem(bank, 5, [], { criterion: 'MFI' });
  assert.equal(sel2.item, 0); // hard item
});

test('nextItem never re-selects an administered item', () => {
  const bank = [easy, hard];
  const sel = nextItem(bank, 0, [1], { criterion: 'MFI' });
  assert.notEqual(sel.item, 1);
});

test('estimateTheta with no items returns the prior (0, Inf)', () => {
  const { theta, se } = estimateTheta([], [], []);
  assert.equal(theta, 0.0);
  assert.equal(se, Infinity);
});

test('estimateTheta matches thetaEst + semTheta on a pattern', () => {
  const bank = [easy, hard];
  const res = estimateTheta(bank, [0, 1], [1, 0]);
  const th = thetaEst([easy, hard], [1, 0]);
  const se = semTheta(th, [easy, hard], [1, 0]);
  assert.equal(res.theta, th);
  assert.equal(res.se, se);
});

test('selectNextItem wraps nextItem with MFI', () => {
  const bank = [hard, easy];
  const sel = selectNextItem(bank, -5, []);
  assert.equal(sel.item, 1);
});
