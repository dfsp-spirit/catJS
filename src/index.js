/**
 * catJS — a faithful JavaScript port of the subset of the R package `catR`
 * used by the EWM adaptive working memory experiment:
 *
 *   - 4PL Item Response Function + Fisher information   (catR: Pi, Ii)
 *   - EAP ability estimation + standard error           (catR: thetaEst, semTheta, method="EAP")
 *   - MFI item selection                                (catR: nextItem, criterion="MFI")
 *
 * Numbers are computed with the exact same formulas and grid as catR
 * (defaults: D=1, priorDist="norm", priorPar=c(0,1), parInt=c(-4,4,33),
 * trapezoid integration over 33 points), so results match catR to floating
 * point precision for the same inputs.
 *
 * An "item" is `{ a, b, c, d }` (discrimination, difficulty, guessing,
 * inattention). Item indices are 0-indexed throughout the public API.
 */

export { pi, ii } from './irf.js';
export { eapEst, eapSem } from './eap.js';
import { thetaEst, semTheta } from './estimators.js';
import { nextItem } from './selection.js';
export { thetaEst, semTheta } from './estimators.js';
export { nextItem } from './selection.js';
export { dnorm, linspace, integrateCatR } from './math.js';

/**
 * High-level helper matching the experiment's `estimate_theta_catr(...)`:
 * estimate ability (EAP) and its standard error from the items administered
 * so far.
 *
 * @param {Array<{a,b,c,d}>} itemBank full item bank
 * @param {number[]} administered 0-indexed administered item indices
 * @param {number[]} responses 0/1 responses for the administered items
 * @param {object} [opts] EAP options (method, priorDist, priorPar, parInt, D)
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
 * select the next item by MFI.
 *
 * @param {Array<{a,b,c,d}>} itemBank full item bank
 * @param {number} theta current ability estimate
 * @param {number[]} administered 0-indexed administered item indices
 * @returns {{item: number, par: object, info: number}} 0-indexed selection
 */
export function selectNextItem(itemBank, theta, administered, opts = {}) {
  return nextItem(itemBank, theta, administered, { criterion: 'MFI', ...opts });
}
