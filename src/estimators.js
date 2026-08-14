/**
 * Ability (theta) estimation and its standard error, mirroring catR's
 * `thetaEst()` and `semTheta()` for the dichotomous model:
 *
 *   - method:     "EAP" | "BM" | "ML" | "WL"
 *   - priorDist:  "norm" | "unif" | "Jeffreys"  (used by EAP and BM)
 *   - defaults:   D=1, priorPar=c(0,1), parInt=c(-4,4,33), range=c(-4,4)
 *
 * The non-EAP methods replicate catR's exact algorithm: solve the score
 * equation T(th) = r0(th) + r(th) = 0 by uniroot (bisection) over `range`,
 * with catR's `optimize()`-based fallback when T does not change sign.
 */

import { eapEst, eapSem } from './eap.js';
import { pi, ii, ji } from './irf.js';
import { uniroot, optimizeScalar } from './math.js';

/**
 * Filter out NaN/undefined responses and the corresponding items, matching
 * catR's `thetaEst`:
 *   ind <- which(!is.na(x)); it <- it[ind, ]; x <- x[ind]
 */
function dropMissing(it, x) {
  const idx = [];
  for (let i = 0; i < x.length; i++) {
    if (Number.isNaN(x[i]) || x[i] === undefined || x[i] === null) continue;
    idx.push(i);
  }
  return {
    it: idx.map((i) => it[i]),
    x: idx.map((i) => x[i]),
  };
}

/** Sum of item information at `th` over `it`. */
function sumIi(th, it, D) {
  let s = 0;
  for (const item of it) s += ii(th, item, D).Ii;
  return s;
}

/** Sum of item information derivatives at `th` over `it`. */
function sumDers(th, it, D) {
  let Ii = 0;
  let dIi = 0;
  let d2Ii = 0;
  for (const item of it) {
    const r = ii(th, item, D);
    Ii += r.Ii;
    dIi += r.dIi;
    d2Ii += r.d2Ii;
  }
  return { Ii, dIi, d2Ii };
}

/**
 * catR's `r0` term (prior / method correction) in the score equation.
 */
function r0(th, it, { method, priorDist, priorPar, D }) {
  if (method === 'ML') return 0;
  if (method === 'WL') {
    let sumJ = 0;
    for (const item of it) sumJ += ji(th, item, D).Ji;
    return sumJ / (2 * sumIi(th, it, D));
  }
  // BM
  if (priorDist === 'norm') return (priorPar[0] - th) / priorPar[1] ** 2;
  if (priorDist === 'unif') return 0;
  if (priorDist === 'Jeffreys') {
    const { Ii, dIi } = sumDers(th, it, D);
    return dIi / (2 * Ii);
  }
  throw new Error(`thetaEst: priorDist '${priorDist}' not implemented`);
}

/** catR's `r` term: sum of dP*(x - P)/(P*Q) over items. */
function r(th, it, x, D) {
  let res = 0;
  for (let i = 0; i < it.length; i++) {
    const { P, dP } = pi(th, it[i], D);
    const Q = 1 - P;
    res += (dP * (x[i] - P)) / (P * Q);
  }
  return res;
}

/**
 * Ability estimate. Mirrors catR `thetaEst(it, x, method=..., ...)`.
 * `it` is an array of items `{a, b, c, d}`; `x` is the 0/1 response vector.
 */
export function thetaEst(it, x, opts = {}) {
  const {
    method = 'EAP',
    priorDist = 'norm',
    priorPar = [0, 1],
    D = 1,
    range = [-4, 4],
    parInt = [-4, 4, 33],
  } = opts;
  const { it: fit, x: fx } = dropMissing(it, x);

  if (method === 'EAP') {
    return eapEst(fit, fx, {
      D,
      priorDist,
      priorPar,
      lower: parInt[0],
      upper: parInt[1],
      nqp: parInt[2],
    });
  }
  if (!['BM', 'ML', 'WL'].includes(method)) {
    throw new Error(`thetaEst: method '${method}' not implemented`);
  }

  // catR: f is T(th) = r0(th) + r(th), except BM+unif which reduces to ML
  // and searches over the prior interval.
  const usePrior = method === 'BM' && priorDist === 'unif' ? false : true;
  const f = (th) => {
    const t = r(th, fit, fx, D);
    return usePrior ? r0(th, fit, { method, priorDist, priorPar, D }) + t : t;
  };
  const RANGE = method === 'BM' && priorDist === 'unif' ? priorPar : range;

  const fLo = f(RANGE[0]);
  const fHi = f(RANGE[1]);
  if ((fLo < 0 && fHi > 0) || (fLo > 0 && fHi < 0)) {
    return uniroot(f, RANGE[0], RANGE[1]);
  }
  // catR fallback: minimize f; if min > 0 -> upper bound; maximize; if max < 0
  // -> lower bound; else root between the argmax and argmin.
  const pr = optimizeScalar(f, RANGE[0], RANGE[1]);
  if (pr.y > 0) return RANGE[1];
  const pr2 = optimizeScalar(f, RANGE[0], RANGE[1], { maximize: true });
  if (pr2.y < 0) return RANGE[0];
  const lo = Math.min(pr2.x, pr.x);
  const hi = Math.max(pr2.x, pr.x);
  return uniroot(f, lo, hi);
}

/**
 * Standard error of an ability estimate. Mirrors catR `semTheta(...)`:
 *   - EAP -> eapSem
 *   - ML  -> 1/sqrt(info)
 *   - WL  -> 1/sqrt(info)                    (classic)
 *   - BM  -> 1/sqrt(info - dr0)              (classic), dr0 per prior
 */
export function semTheta(thEst, it, x, opts = {}) {
  const {
    method = 'EAP',
    priorDist = 'norm',
    priorPar = [0, 1],
    D = 1,
    parInt = [-4, 4, 33],
    semType = 'classic',
  } = opts;
  const { it: fit, x: fx } = dropMissing(it, x);

  if (method === 'EAP') {
    return eapSem(thEst, fit, fx, {
      D,
      priorDist,
      priorPar,
      lower: parInt[0],
      upper: parInt[1],
      nqp: parInt[2],
    });
  }
  if (!['BM', 'ML', 'WL'].includes(method)) {
    throw new Error(`semTheta: method '${method}' not implemented`);
  }

  const info = sumIi(thEst, fit, D);

  if (method === 'ML') return 1 / Math.sqrt(info);
  if (method === 'WL') {
    // classic: 1/sqrt(info); new: sqrt(info)/abs(info - dr0) — classic only for now
    if (semType === 'new') {
      const dr0wl = 0; // catR new-type WL needs Ji derivatives; classic is the common choice
      return Math.sqrt(info) / Math.abs(info - dr0wl);
    }
    return 1 / Math.sqrt(info);
  }

  // BM
  let dr0;
  if (priorDist === 'norm') dr0 = -1 / priorPar[1] ** 2;
  else if (priorDist === 'unif') dr0 = 0;
  else if (priorDist === 'Jeffreys') {
    const { Ii, dIi, d2Ii } = sumDers(thEst, fit, D);
    dr0 = (d2Ii * Ii - dIi * dIi) / (2 * Ii * Ii);
  } else {
    throw new Error(`semTheta: priorDist '${priorDist}' not implemented`);
  }

  if (semType === 'classic') return 1 / Math.sqrt(info - dr0);
  return Math.sqrt(info) / Math.abs(info - dr0);
}
