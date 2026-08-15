/**
 * catjs-irt — a faithful JavaScript port of the subset of the R package `catR`
 * used by the EWM adaptive working memory experiment, extended to cover the
 * commonly used parts of catR:
 *
 *   - 4PL IRF + Fisher information (+ derivatives, Ji)   (catR: Pi, Ii, Ji)
 *   - ability estimation: EAP, BM, ML, WL × norm/unif/Jeffreys priors
 *                                                    (catR: thetaEst, semTheta)
 *   - item selection: MFI, bOpt                       (catR: nextItem)
 *   - simulation: genPattern, checkStopRule, randomCAT (catR-inspired)
 *
 * Numbers are computed with the exact same formulas and grid as catR
 * (defaults: D=1, priorDist="norm", priorPar=c(0,1), parInt=c(-4,4,33),
 * trapezoid integration over 33 points), so results match catR to floating
 * point precision for the same inputs.
 *
 * An "item" is `{ a, b, c, d }` (discrimination, difficulty, guessing,
 * inattention). Item indices are 0-indexed throughout the public API.
 */

export { pi, ii, ji } from './irf.js';
export { eapEst, eapSem } from './eap.js';
import { thetaEst, semTheta } from './estimators.js';
import { nextItem } from './selection.js';
export { thetaEst, semTheta } from './estimators.js';
export { nextItem } from './selection.js';
export { genPattern, simulateRespondents, checkStopRule, randomCAT } from './simulation.js';
export { dnorm, linspace, integrateCatR, qnorm, uniroot, optimizeScalar } from './math.js';

/**
 * High-level helper matching the experiment's `estimate_theta_catr(...)`:
 * estimate ability and its standard error from the items administered so far.
 *
 * @param {Array<{a,b,c,d}>} itemBank full item bank
 * @param {number[]} administered 0-indexed administered item indices
 * @param {number[]} responses 0/1 responses for the administered items
 * @param {object} [opts] estimation options (method, priorDist, priorPar, parInt, D, ...)
 * @returns {{theta: number, se: number}}
 */
export function estimateTheta(itemBank, administered, responses, opts = {}) {
  if (administered.length === 0) {
    // Match the experiment's catr.py: empty pattern returns the prior (0, Inf).
    return { theta: 0.0, se: Infinity };
  }
  const it = administered.map((i) => itemBank[i]);
  const theta = thetaEst(it, responses, opts);
  const se = semTheta(theta, it, responses, opts);
  return { theta, se };
}

/**
 * High-level helper matching the experiment's `select_next_item_catr(...)`:
 * select the next item.
 *
 * @param {Array<{a,b,c,d}>} itemBank full item bank
 * @param {number} theta current ability estimate
 * @param {number[]} administered 0-indexed administered item indices
 * @param {object} [opts] selection options (criterion: 'MFI' | 'bOpt')
 * @returns {{item: number, par: object, info: number, criterion: string}}
 */
export function selectNextItem(itemBank, theta, administered, opts = {}) {
  return nextItem(itemBank, theta, administered, { criterion: 'MFI', ...opts });
}
