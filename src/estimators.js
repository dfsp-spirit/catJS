/**
 * Ability (theta) estimation and its standard error, mirroring catR's
 * `thetaEst()` and `semTheta()` for the method the EWM experiment uses:
 * method = "EAP" with default priorDist="norm", priorPar=c(0,1),
 * parInt=c(-4,4,33), D=1.
 *
 * Non-EAP methods are intentionally not implemented (the experiment never
 * uses them); they raise a clear error.
 */

import { eapEst, eapSem } from './eap.js';

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

/**
 * Ability estimate. Mirrors catR `thetaEst(it, x, method="EAP", ...)`.
 * `it` is an array of items `{a, b, c, d}`; `x` is the 0/1 response vector.
 */
export function thetaEst(it, x, { method = 'EAP', ...opts } = {}) {
  if (method !== 'EAP') {
    throw new Error(`thetaEst: method '${method}' not implemented (only 'EAP')`);
  }
  const { it: fit, x: fx } = dropMissing(it, x);
  return eapEst(fit, fx, opts);
}

/**
 * Standard error of an ability estimate. Mirrors catR
 * `semTheta(thEst, it, x, method="EAP", ...)`.
 */
export function semTheta(thEst, it, x, { method = 'EAP', ...opts } = {}) {
  if (method !== 'EAP') {
    throw new Error(`semTheta: method '${method}' not implemented (only 'EAP')`);
  }
  const { it: fit, x: fx } = dropMissing(it, x);
  return eapSem(thEst, fit, fx, opts);
}
