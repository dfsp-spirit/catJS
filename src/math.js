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
