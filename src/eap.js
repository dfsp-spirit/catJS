/**
 * Expected A Posteriori (EAP) estimation, mirroring catR's `eapEst()` and
 * `eapSem()` exactly (including the 33-point grid, the N(0,1) prior and the
 * trapezoid integration via `integrate.catR`).
 */

import { dnorm, linspace, integrateCatR } from './math.js';
import { pi } from './irf.js';

/**
 * Build the likelihood L(th) = prod_i P_i^x_i * (1 - P_i)^(1 - x_i),
 * exactly as in catR's `eapEst`:
 *   L <- function(th, it, x) prod(Pi(th, it, D=D)$Pi^x * (1-Pi(th, it, D=D)$Pi)^(1-x))
 */
function makeLikelihood(it, x, D) {
  return (th) => {
    let res = 1;
    for (let i = 0; i < it.length; i++) {
      const P = pi(th, it[i], D).P;
      res *= Math.pow(P, x[i]) * Math.pow(1 - P, 1 - x[i]);
    }
    return res;
  };
}

/**
 * EAP ability estimate. Mirrors catR `eapEst(it, x, ...)` for the
 * `priorDist = "norm"` case (the only prior used by the experiment):
 *   X  <- seq(from = lower, to = upper, length = nqp)
 *   Y1 <- s * dnorm(s) * L(s)      (g)
 *   Y2 <- dnorm(s) * L(s)          (h)
 *   RES <- integrate.catR(X, Y1) / integrate.catR(X, Y2)
 */
export function eapEst(
  it,
  x,
  { D = 1, priorDist = 'norm', priorPar = [0, 1], lower = -4, upper = 4, nqp = 33 } = {},
) {
  if (priorDist !== 'norm') {
    throw new Error(`eapEst: priorDist '${priorDist}' not implemented (only 'norm')`);
  }
  const L = makeLikelihood(it, x, D);
  const X = linspace(lower, upper, nqp);
  const g = X.map((s) => s * dnorm(s, priorPar[0], priorPar[1]) * L(s));
  const h = X.map((s) => dnorm(s, priorPar[0], priorPar[1]) * L(s));
  return integrateCatR(X, g) / integrateCatR(X, h);
}

/**
 * Standard error of an EAP estimate. Mirrors catR `eapSem(thEst, it, x, ...)`:
 *   Y1 <- (s - thEst)^2 * dnorm(s) * L(s)
 *   Y2 <- dnorm(s) * L(s)
 *   RES <- sqrt(integrate.catR(X, Y1) / integrate.catR(X, Y2))
 */
export function eapSem(
  thEst,
  it,
  x,
  { D = 1, priorDist = 'norm', priorPar = [0, 1], lower = -4, upper = 4, nqp = 33 } = {},
) {
  if (priorDist !== 'norm') {
    throw new Error(`eapSem: priorDist '${priorDist}' not implemented (only 'norm')`);
  }
  const L = makeLikelihood(it, x, D);
  const X = linspace(lower, upper, nqp);
  const g = X.map((s) => (s - thEst) ** 2 * dnorm(s, priorPar[0], priorPar[1]) * L(s));
  const h = X.map((s) => dnorm(s, priorPar[0], priorPar[1]) * L(s));
  return Math.sqrt(integrateCatR(X, g) / integrateCatR(X, h));
}
