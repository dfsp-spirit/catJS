/**
 * Item selection, mirroring catR's `nextItem()` with criterion = "MFI"
 * (Maximum Fisher Information), randomesque = 1 (catR's default).
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
 * Because `rank()` is monotone in `info` and ties share the same rank, the
 * eligible items tied at the maximum info are exactly the candidates; catR
 * samples one of them at random. We replicate that.
 */

import { ii } from './irf.js';

/**
 * Select the next item. `itemBank` is an array of items `{a, b, c, d}`,
 * `theta` the current ability, `out` an array of 0-indexed administered
 * item indices (catR's `out` is 1-indexed; we use 0-indexed here).
 *
 * Returns `{ item, par, info }` where `item` is the 0-indexed selection.
 */
export function nextItem(
  itemBank,
  theta,
  out = [],
  { criterion = 'MFI', randomesque = 1, D = 1 } = {},
) {
  if (criterion !== 'MFI') {
    throw new Error(`nextItem: criterion '${criterion}' not implemented (only 'MFI')`);
  }
  if (randomesque !== 1) {
    throw new Error(
      `nextItem: randomesque='${randomesque}' not implemented (only the default 1)`,
    );
  }

  const n = itemBank.length;
  const info = itemBank.map((item) => ii(theta, item, D).Ii);

  // Eligible = not administered (catR: items[OUT] <- 0)
  const eligible = [];
  for (let i = 0; i < n; i++) {
    if (out.includes(i)) continue;
    eligible.push(i);
  }

  // Maximum info among eligible items (the single top rank for randomesque=1)
  let maxInfo = -Infinity;
  for (const i of eligible) maxInfo = Math.max(maxInfo, info[i]);

  // All eligible items tied at the maximum (catR: keep)
  const keep = eligible.filter((i) => info[i] === maxInfo);

  // catR: select <- ifelse(length(keep) == 1, keep, sample(keep, 1))
  const select = keep.length === 1 ? keep[0] : keep[Math.floor(Math.random() * keep.length)];

  return { item: select, par: itemBank[select], info: info[select] };
}
