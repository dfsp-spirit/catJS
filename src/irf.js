/**
 * Item Response Function (4PL) and item information, mirroring catR's
 * `Pi()` and `Ii()` for the dichotomous model.
 *
 * An item is an object `{ a, b, c, d }` where:
 *   a = discrimination, b = difficulty, c = guessing (lower asymptote),
 *   d = inattention (upper asymptote).
 */

/**
 * 4PL probability of a correct response and its first derivative.
 * Mirrors catR `Pi(th, it, D)`:
 *   e  <- exp(D * a * (th - b))
 *   Pi <- c + (d - c) * e/(1 + e)
 *   Pi[Pi == 0] <- 1e-10
 *   Pi[Pi == 1] <- 1 - 1e-10
 *   dPi <- D * a * e * (d - c)/(1 + e)^2
 *
 * Returns `{ P, dP }`.
 */
export function pi(th, item, D = 1) {
  const { a, b, c, d } = item;
  const e = Math.exp(D * a * (th - b));
  let P = c + ((d - c) * e) / (1 + e);
  if (P === 0) P = 1e-10;
  if (P === 1) P = 1 - 1e-10;
  const dP = (D * a * e * (d - c)) / (1 + e) ** 2;
  return { P, dP };
}

/**
 * Fisher information of one item at ability `th`.
 * Mirrors catR `Ii(th, it)` dichotomous branch:
 *   Q  <- 1 - P
 *   Ii <- dP^2/(P * Q)
 *
 * Returns `{ Ii }`.
 */
export function ii(th, item, D = 1) {
  const { P, dP } = pi(th, item, D);
  const Q = 1 - P;
  const Ii = (dP * dP) / (P * Q);
  return { Ii };
}
