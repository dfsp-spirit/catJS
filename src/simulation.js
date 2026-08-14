/**
 * Simulation helpers: response generation, a simple CAT runner and stopping
 * rules. These mirror the *pieces* of catR (`genPattern`, `checkStopRule`)
 * and provide a minimal, catR-inspired `randomCAT` loop.
 *
 * Note: `randomCAT` here is deliberately a lightweight, documented loop — it
 * is NOT a bit-for-bit port of catR's `randomCAT()` (which has a much larger
 * option surface). Its building blocks (selection, estimation, SE) are the
 * same functions that validate to machine precision against catR.
 */

import { pi, ii } from './irf.js';
import { thetaEst, semTheta } from './estimators.js';
import { nextItem } from './selection.js';
import { qnorm } from './math.js';

/**
 * Generate a dichotomous 0/1 response pattern for one or more abilities,
 * mirroring catR's `genPattern(th, it, model=NULL, D=1)` for the
 * dichotomous case: each item is a Bernoulli draw with probability Pi(th).
 *
 * @param {number|number[]} theta ability level(s)
 * @param {Array<{a,b,c,d}>} items items to respond to
 * @param {object} [opts] { D, rng } — `rng` injectable for determinism
 * @returns {number[]|number[][]} one 0/1 pattern, or a matrix (theta x items)
 */
export function genPattern(theta, items, { D = 1, rng = Math.random } = {}) {
  const thetas = Array.isArray(theta) ? theta : [theta];
  const rows = thetas.map((th) =>
    items.map((item) => (rng() < pi(th, item, D).P ? 1 : 0)),
  );
  return Array.isArray(theta) ? rows : rows[0];
}

/**
 * Simulate response patterns for several respondents. Thin wrapper around
 * `genPattern`; returns a matrix of shape (respondents x items).
 *
 * This is our own minimal helper (not a catR function).
 */
export function simulateRespondents(thetas, itemBank, opts = {}) {
  return genPattern(thetas, itemBank, opts);
}

/**
 * Stopping rule, mirroring catR's `checkStopRule(th, se, N, it, stop)`.
 *
 * @param {number} th current ability estimate
 * @param {number} se current standard error
 * @param {number} n number of administered items
 * @param {object} opts
 *   { rule: string[], thr: number[], alpha: number, items?: item[], D?: number }
 *   Rules (OR-combined): "length" (n >= thr), "precision" (se <= thr),
 *   "classification" (CI for th excludes thr), "minInfo" (max item info <= thr).
 * @returns {{decision: boolean, rule: string[]}}
 */
export function checkStopRule(th, se, n, { rule = ['length'], thr = [20], alpha = 0.05, items = null, D = 1 } = {}) {
  let decision = false;
  const triggered = [];
  for (let i = 0; i < rule.length; i++) {
    const r = rule[i];
    if (r === 'length') {
      if (n >= thr[i]) {
        decision = true;
        triggered.push(r);
      }
    } else if (r === 'precision') {
      if (se <= thr[i]) {
        decision = true;
        triggered.push(r);
      }
    } else if (r === 'classification') {
      const z = qnorm(1 - alpha / 2);
      if (th - z * se >= thr[i] || th + z * se <= thr[i]) {
        decision = true;
        triggered.push(r);
      }
    } else if (r === 'minInfo') {
      if (!items) throw new Error('checkStopRule: "minInfo" rule requires `items`');
      let maxI = -Infinity;
      for (const item of items) maxI = Math.max(maxI, ii(th, item, D).Ii);
      if (maxI <= thr[i]) {
        decision = true;
        triggered.push(r);
      }
    } else {
      throw new Error(`checkStopRule: unknown rule '${r}'`);
    }
  }
  return { decision, rule: triggered };
}

/**
 * Minimal CAT runner (catR-inspired). Selects items, (optionally) simulates
 * responses, and estimates ability after each step until a stopping rule
 * triggers or the item bank / maxSteps is exhausted.
 *
 * @param {number} trueTheta true ability (only used when simulating responses)
 * @param {Array<{a,b,c,d}>} itemBank
 * @param {object} [opts]
 *   - method / priorDist / priorPar / D / range / parInt: estimation options
 *   - itemSelect: 'MFI' | 'bOpt'
 *   - startTheta: ability used for the first selection (default 0)
 *   - stop: { rule, thr, alpha } passed to checkStopRule
 *   - minItems: minimum number of items before stopping is considered
 *   - maxSteps: hard cap on administered items (default bank length)
 *   - responses: optional fixed 0/1 response sequence to replay instead of
 *     simulating (for parity testing against catR)
 *   - rng: injectable RNG for response simulation
 * @returns {object} run result with per-step history and final estimate
 */
export function randomCAT(
  trueTheta,
  itemBank,
  {
    method = 'BM',
    priorDist = 'norm',
    priorPar = [0, 1],
    D = 1,
    range = [-4, 4],
    parInt = [-4, 4, 33],
    itemSelect = 'MFI',
    startTheta = 0,
    stop = { rule: ['length'], thr: [20], alpha: 0.05 },
    minItems = 0,
    maxSteps = null,
    responses = null,
    rng = Math.random,
  } = {},
) {
  const estOpts = { method, priorDist, priorPar, D, range, parInt };
  const administered = [];
  const resp = responses ? [...responses] : [];
  const thetaHist = [];
  const seHist = [];
  const selected = [];
  const infoHist = [];
  const nSteps = maxSteps ?? itemBank.length;
  // Never exceed the bank size (catR also stops once all items are used).
  const steps = Math.min(responses ? resp.length : nSteps, itemBank.length);

  let theta = startTheta;
  let se = Infinity;
  let stopRule = null;

  for (let s = 0; s < steps; s++) {
    if (administered.length >= minItems) {
      const stopRes = checkStopRule(theta, se, administered.length, {
        rule: stop.rule,
        thr: stop.thr,
        alpha: stop.alpha,
        items: itemBank,
        D,
      });
      if (stopRes.decision) {
        stopRule = stopRes.rule;
        break;
      }
    }

    const sel = nextItem(itemBank, theta, administered, { criterion: itemSelect, D });
    selected.push(sel.item);
    infoHist.push(sel.info);

    let r;
    if (responses) {
      r = resp[administered.length];
    } else {
      const P = pi(trueTheta, itemBank[sel.item], D).P;
      r = rng() < P ? 1 : 0;
      resp.push(r);
    }
    administered.push(sel.item);

    const it = administered.map((i) => itemBank[i]);
    theta = thetaEst(it, resp.slice(0, administered.length), estOpts);
    se = semTheta(theta, it, resp.slice(0, administered.length), estOpts);
    thetaHist.push(theta);
    seHist.push(se);
  }

  return {
    administered, // 0-indexed item indices
    responses: resp,
    selected,
    infoHist,
    thetaHist,
    seHist,
    stopRule,
    finalTheta: theta,
    finalSe: se,
    nItems: administered.length,
    method,
    itemSelect,
  };
}
