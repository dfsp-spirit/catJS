/**
 * Expected A Posteriori (EAP) estimation, mirroring catR's `eapEst()` and
 * `eapSem()` exactly (including the grid, the prior and the trapezoid
 * integration via `integrate.catR`).
 *
 * Supported priors (catR's `priorDist`): "norm" (N(priorPar[0], priorPar[1])),
 * "unif" (uniform over priorPar), "Jeffreys" (weight sqrt(sum(Ii))).
 */

import { dnorm, linspace, integrateCatR } from './math.js';
import { pi, ii } from './irf.js';

/**
 * Prior density term used in the EAP integrand, matching catR's `switch(...)`
 * inside `eapEst`/`eapSem`. For "norm" returns dnorm(s); for "unif" returns
 * dunif(s) (1/(b-a) inside [a,b], 0 outside); for "Jeffreys" returns
 * sqrt(sum(Ii(s, it))).
 */
function priorWeight(s, priorDist, priorPar, it, D) {
  if (priorDist === 'norm') {
    return dnorm(s, priorPar[0], priorPar[1]);
  }
  if (priorDist === 'unif') {
    const a = priorPar[0];
    const b = priorPar[1];
    return s >= a && s <= b ? 1 / (b - a) : 0;
  }
  if (priorDist === 'Jeffreys') {
    let sum = 0;
    for (const item of it) sum += ii(s, item, D).Ii;
    return Math.sqrt(sum);
  }
  throw new Error(`eapEst: priorDist '${priorDist}' not implemented`);
}

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
 * EAP ability estimate. Mirrors catR `eapEst(it, x, ...)`:
 *   X  <- seq(from = lower, to = upper, length = nqp)
 *   Y1 <- s * prior(s) * L(s)      (g)
 *   Y2 <- prior(s) * L(s)          (h)
 *   RES <- integrate.catR(X, Y1) / integrate.catR(X, Y2)
 * where prior(s) = dnorm / dunif / sqrt(sum(Ii)) per `priorDist`.
 */
export function eapEst(
  it,
  x,
  { D = 1, priorDist = 'norm', priorPar = [0, 1], lower = -4, upper = 4, nqp = 33 } = {},
) {
  const L = makeLikelihood(it, x, D);
  const X = linspace(lower, upper, nqp);
  const w = (s) => priorWeight(s, priorDist, priorPar, it, D);
  const g = X.map((s) => s * w(s) * L(s));
  const h = X.map((s) => w(s) * L(s));
  return integrateCatR(X, g) / integrateCatR(X, h);
}

/**
 * Standard error of an EAP estimate. Mirrors catR `eapSem(thEst, it, x, ...)`:
 *   Y1 <- (s - thEst)^2 * prior(s) * L(s)
 *   Y2 <- prior(s) * L(s)
 *   RES <- sqrt(integrate.catR(X, Y1) / integrate.catR(X, Y2))
 */
export function eapSem(
  thEst,
  it,
  x,
  { D = 1, priorDist = 'norm', priorPar = [0, 1], lower = -4, upper = 4, nqp = 33 } = {},
) {
  const L = makeLikelihood(it, x, D);
  const X = linspace(lower, upper, nqp);
  const w = (s) => priorWeight(s, priorDist, priorPar, it, D);
  const g = X.map((s) => (s - thEst) ** 2 * w(s) * L(s));
  const h = X.map((s) => w(s) * L(s));
  return Math.sqrt(integrateCatR(X, g) / integrateCatR(X, h));
}
