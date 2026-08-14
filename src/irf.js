/**
 * Item Response Function (4PL) and item information, mirroring catR's
 * `Pi()` and `Ii()` for the dichotomous model.
 *
 * An item is an object `{ a, b, c, d }` where:
 *   a = discrimination, b = difficulty, c = guessing (lower asymptote),
 *   d = inattention (upper asymptote).
 */

/**
 * 4PL probability of a correct response and its first three derivatives.
 * Mirrors catR `Pi(th, it, D)`:
 *   e    <- exp(D * a * (th - b))
 *   Pi   <- c + (d - c) * e/(1 + e)
 *   Pi[Pi == 0] <- 1e-10
 *   Pi[Pi == 1] <- 1 - 1e-10
 *   dPi  <- D * a * e * (d - c)/(1 + e)^2
 *   d2Pi <- D^2 * a^2 * e * (1 - e) * (d - c)/(1 + e)^3
 *   d3Pi <- D^3 * a^3 * e * (d - c) * (e^2 - 4*e + 1)/(1 + e)^4
 *
 * Returns `{ P, dP, d2P, d3P }`.
 */
export function pi(th, item, D = 1) {
  const { a, b, c, d } = item;
  const e = Math.exp(D * a * (th - b));
  let P = c + ((d - c) * e) / (1 + e);
  if (P === 0) P = 1e-10;
  if (P === 1) P = 1 - 1e-10;
  const dP = (D * a * e * (d - c)) / (1 + e) ** 2;
  const d2P = (D ** 2 * a ** 2 * e * (1 - e) * (d - c)) / (1 + e) ** 3;
  const d3P = (D ** 3 * a ** 3 * e * (d - c) * (e ** 2 - 4 * e + 1)) / (1 + e) ** 4;
  return { P, dP, d2P, d3P };
}

/**
 * Fisher information of one item at ability `th`, and its first two
 * derivatives. Mirrors catR `Ii(th, it)` dichotomous branch:
 *   Q   <- 1 - P
 *   Ii  <- dP^2/(P * Q)
 *   dIi <- dP * (2*P*Q*d2P - dP^2*(Q - P))/(P^2 * Q^2)
 *   d2Ii <- (2*P*Q*(d2P^2 + dP*d3P) - 2*dP^2*d2P*(Q - P))/(P^2*Q^2)
 *          - (3*P^2*Q*dP^2*d2P - P*dP^4*(2*Q - P))/(P^4*Q^2)
 *          + (3*P*Q^2*dP^2*d2P - Q*dP^4*(Q - 2*P))/(P^2*Q^4)
 *
 * Returns `{ Ii, dIi, d2Ii }`.
 */
export function ii(th, item, D = 1) {
  const { P, dP, d2P, d3P } = pi(th, item, D);
  const Q = 1 - P;
  const Ii = (dP * dP) / (P * Q);
  const dIi = (dP * (2 * P * Q * d2P - dP * dP * (Q - P))) / (P * P * Q * Q);
  const d2Ii =
    (2 * P * Q * (d2P * d2P + dP * d3P) - 2 * dP * dP * d2P * (Q - P)) /
      (P * P * Q * Q) -
    (3 * P * P * Q * dP * dP * d2P - P * dP ** 4 * (2 * Q - P)) /
      (P ** 4 * Q * Q) +
    (3 * P * Q * Q * dP * dP * d2P - Q * dP ** 4 * (Q - 2 * P)) /
      (P * P * Q ** 4);
  return { Ii, dIi, d2Ii };
}

/**
 * Weighted-likelihood quantity (third-derivative term), mirroring catR's
 * `Ji(th, it)` dichotomous branch:
 *   Q   <- 1 - P
 *   Ji  <- dP * d2P/(P * Q)
 *   dJi <- (P * Q * (d2P^2 + dP * d3P) - dP^2 * d2P * (Q - P))/(P^2 * Q^2)
 *
 * Returns `{ Ji, dJi }`.
 */
export function ji(th, item, D = 1) {
  const { P, dP, d2P, d3P } = pi(th, item, D);
  const Q = 1 - P;
  const Ji = (dP * d2P) / (P * Q);
  const dJi =
    (P * Q * (d2P * d2P + dP * d3P) - dP * dP * d2P * (Q - P)) /
    (P * P * Q * Q);
  return { Ji, dJi };
}
