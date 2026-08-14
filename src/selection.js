/**
 * Item selection, mirroring catR's `nextItem()` with the criteria used by
 * catJS: "MFI" (Maximum Fisher Information) and "bOpt" (difficulty closest
 * to current ability), both with randomesque = 1 (catR's default).
 *
 * catR's MFI branch:
 *   items <- rep(1, nrow(itemBank)); items[OUT] <- 0
 *   info  <- Ii(theta, itemBank)$Ii
 *   ranks <- rank(info)
 *   nrIt  <- min(c(randomesque, sum(items)))          # = 1 for randomesque=1
 *   keepRank <- sort(ranks[items == 1], decreasing = TRUE)[1:nrIt]
 *   keep <- which(ranks == keepRank[i] & items == 1)  # all eligible items tied at the top
 *   select <- ifelse(length(keep) == 1, keep, sample(keep, 1))
 *
 * catR's bOpt branch:
 *   distance <- abs(itemBank[, 2] - theta)
 *   ... same tie handling, but on the smallest distances.
 *
 * Because `rank()` is monotone, ties share the same rank, so the eligible
 * candidates at the optimum are exactly the items tied at the optimum; catR
 * samples one of them at random. We replicate that.
 */

import { ii } from './irf.js';

/**
 * Select the next item. `itemBank` is an array of items `{a, b, c, d}`,
 * `theta` the current ability, `out` an array of 0-indexed administered
 * item indices (catR's `out` is 1-indexed; we use 0-indexed here).
 *
 * Returns `{ item, par, info }` where `item` is the 0-indexed selection and
 * `info` is the criterion value at the selection (Fisher info for MFI, or
 * |b - theta| for bOpt).
 */
export function nextItem(
  itemBank,
  theta,
  out = [],
  { criterion = 'MFI', randomesque = 1, D = 1 } = {},
) {
  if (!['MFI', 'bOpt'].includes(criterion)) {
    throw new Error(`nextItem: criterion '${criterion}' not implemented (only 'MFI', 'bOpt')`);
  }
  if (randomesque !== 1) {
    throw new Error(
      `nextItem: randomesque='${randomesque}' not implemented (only the default 1)`,
    );
  }

  const n = itemBank.length;

  // Criterion value per item (higher is better for MFI, lower is better for
  // bOpt, so we negate for a uniform "maximize" treatment).
  const criterionVal = (item, i) =>
    criterion === 'MFI' ? ii(theta, item, D).Ii : -Math.abs(item.b - theta);

  const eligible = [];
  for (let i = 0; i < n; i++) {
    if (out.includes(i)) continue;
    eligible.push(i);
  }

  let best = -Infinity;
  for (const i of eligible) best = Math.max(best, criterionVal(itemBank[i], i));

  // All eligible items tied at the optimum (catR: keep)
  const keep = eligible.filter((i) => criterionVal(itemBank[i], i) === best);

  // catR: select <- ifelse(length(keep) == 1, keep, sample(keep, 1))
  const select = keep.length === 1 ? keep[0] : keep[Math.floor(Math.random() * keep.length)];

  const info =
    criterion === 'MFI'
      ? ii(theta, itemBank[select], D).Ii
      : Math.abs(itemBank[select].b - theta);

  return { item: select, par: itemBank[select], info, criterion };
}
