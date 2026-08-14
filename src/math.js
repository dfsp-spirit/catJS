/**
 * Small numerical helpers, mirroring the R base functions used by catR.
 *
 * Each function intentionally replicates catR's exact arithmetic so that the
 * JS port produces (near) bit-identical numbers to R/catR.
 */

/** Standard normal (or normal) density, matching R's `dnorm(x, mean, sd)`. */
export function dnorm(x, mean = 0, sd = 1) {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

/**
 * Linearly spaced sequence, matching R's `seq(from, to, length.out = n)`.
 * R computes `from + (0:(n-1)) * by` with `by = (to-from)/(n-1)`.
 */
export function linspace(from, to, n) {
  const by = (to - from) / (n - 1);
  return Array.from({ length: n }, (_, i) => from + i * by);
}

/**
 * Trapezoid integration, matching catR's `integrate.catR(x, y)`:
 *   hauteur <- x[2:n] - x[1:(n-1)]
 *   base    <- rowMeans(cbind(y[1:(n-1)], y[2:n]))
 *   res     <- sum(base * hauteur)
 */
export function integrateCatR(x, y) {
  let res = 0;
  for (let i = 0; i < x.length - 1; i++) {
    const hauteur = x[i + 1] - x[i];
    const base = (y[i] + y[i + 1]) / 2;
    res += base * hauteur;
  }
  return res;
}

/**
 * Standard normal quantile function, matching R's `qnorm(p, 0, 1)`.
 * Peter J. Acklam's rational approximation (relative error ~1.15e-9), the
 * same accuracy class as R's AS 241 implementation.
 */
export function qnorm(p, mean = 0, sd = 1) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [
    -3.969683028665376e01, 2.209460984245205e02, -2.759285104469687e02,
    1.383577518672690e02, -3.066479806614716e01, 2.506628277459239e00,
  ];
  const b = [
    -5.447609879822406e01, 1.615858368580409e02, -1.556989798598866e02,
    6.680131188771972e01, -1.328068155288572e01,
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e00,
    -2.549732539343734e00, 4.374664141464968e00, 2.938163982698783e00,
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e00,
    3.754408661907416e00,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q;
  let r;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      mean +
      sd *
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    return (
      mean +
      sd *
        (q * (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5])) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    mean -
    sd *
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

/**
 * Root finding by bisection, matching R's `uniroot` semantics (f must change
 * sign over [lower, upper]). R's uniroot default tolerance is
 * .Machine$double.eps^0.25 ~ 1.22e-4; we default to the same so results line
 * up with catR, but tighter values are supported.
 */
export function uniroot(f, lower, upper, tol = 1.22e-4, maxIter = 1000) {
  let a = lower;
  let b = upper;
  let fa = f(a);
  const fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) {
    throw new Error(
      'uniroot: f() at the endpoints must have opposite signs',
    );
  }
  for (let i = 0; i < maxIter; i++) {
    if ((b - a) / 2 < tol) return (a + b) / 2;
    const mid = (a + b) / 2;
    const fm = f(mid);
    if (fm === 0) return mid;
    if (fm * fa < 0) {
      b = mid;
    } else {
      a = mid;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/**
 * Scalar minimizer (golden-section), analogous to R's `optimize()` used in
 * catR's thetaEst fallback. Returns `{ x, y }` with x the argmin/argmax and
 * y = f(x).
 */
export function optimizeScalar(
  f,
  lower,
  upper,
  { maximize = false, tol = 1e-12, maxIter = 200 } = {},
) {
  const g = maximize ? (x) => -f(x) : f;
  const invphi = (Math.sqrt(5) - 1) / 2;
  let a = lower;
  let b = upper;
  let c = b - invphi * (b - a);
  let d = a + invphi * (b - a);
  let fc = g(c);
  let fd = g(d);
  for (let i = 0; i < maxIter; i++) {
    if (Math.abs(b - a) < tol) break;
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - invphi * (b - a);
      fc = g(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + invphi * (b - a);
      fd = g(d);
    }
  }
  const x = (a + b) / 2;
  return { x, y: f(x) };
}
