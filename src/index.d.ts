/**
 * @packageDocumentation
 * catjs-irt — a faithful JavaScript port of the parts of the R package
 * [`catR`](https://cran.r-project.org/package=catR) used by the EWM adaptive
 * working-memory experiment.
 *
 * catjs-irt lets you build a **computerized adaptive test (CAT)** that runs
 * entirely in JavaScript (Node or the browser): given a bank of items it picks
 * the most informative next question, then updates the participant's ability
 * estimate after every answer — live, with no server round-trip.
 *
 * ### IRT in 60 seconds (for psychology folks new to this)
 *
 * - Every participant has a hidden **ability θ** on a scale that behaves like
 *   a z-score: 0 is average, almost everyone lies between −4 and +4, and a
 *   bigger number means more able.
 * - Every **item** `{ a, b, c, d }` describes how one question behaves:
 *   - `a` — **discrimination** (slope): how sharply the item separates
 *     high- from low-ability people (typical ≈ 0.5–2.5).
 *   - `b` — **difficulty**: the ability at which the item becomes ~50%
 *     (between `c` and `d`) likely correct (≈ −4 … 4; positive = hard item).
 *   - `c` — **guessing** (lower asymptote): chance of a lucky correct answer
 *     at very low ability (typical ≈ 0–0.3).
 *   - `d` — **inattention / upper asymptote**: even the most able answer
 *     correctly only with probability `d` (typical ≈ 0.9–1.0).
 * - **Item indices are 0-indexed** throughout: the first item in the bank is
 *   index `0`.
 *
 * ### Where to start
 *
 * | You want to… | Use |
 * |---|---|
 * | Run a real experiment, item by item | {@link selectNextItem} + {@link estimateTheta} |
 * | Simulate a whole adaptive test | {@link randomCAT} |
 * | Generate synthetic response data | {@link genPattern} / {@link simulateRespondents} |
 * | Understand the underlying maths | {@link pi}, {@link ii}, {@link thetaEst}, {@link nextItem} |
 *
 * ### Parity note
 *
 * catjs-irt reproduces catR's exact formulas, its 33-point integration grid over
 * [−4, 4], and its numerics (quirks included), so results match the R package
 * to floating-point precision for identical inputs. Defaults mirror catR:
 * `D = 1`, `priorDist = "norm"`, `priorPar = [0, 1]`,
 * `parInt = [-4, 4, 33]`, `range = [-4, 4]`.
 */

/**
 * One test item, described by its four **4PL** parameters.
 *
 * These four numbers fully determine how the item behaves across the ability
 * scale (see {@link pi} for the formula). An item bank is just an array of
 * these objects. Item indices in the public API are 0-indexed.
 *
 * @example
 * ```js
 * // A moderately discriminating, slightly easy item with a little guessing:
 * const item = { a: 1.2, b: -0.5, c: 0.2, d: 0.97 };
 * ```
 */
export interface Item {
  /** Discrimination (slope). Typical range ≈ 0.5–2.5; higher is "better". */
  a: number;
  /** Difficulty. The ability at which the item becomes ~50% (of c→d) likely correct. Positive = hard item. */
  b: number;
  /** Guessing (lower asymptote). Typical ≈ 0–0.3. */
  c: number;
  /** Inattention / upper asymptote. Typical ≈ 0.9–1.0. */
  d: number;
}

/**
 * The prior distribution placed on ability θ before seeing any responses.
 * Used by the **EAP** and **BM** estimation methods (see {@link thetaEst}).
 *
 * - `"norm"` — normal (Gaussian), the default: `θ ~ N(priorPar[0], priorPar[1])`.
 * - `"unif"` — uniform over the interval `priorPar = [a, b]`.
 * - `"Jeffreys"` — a non-informative prior proportional to the square root of
 *   the test information; `priorPar` is ignored for this one.
 */
export type PriorDist = 'norm' | 'unif' | 'Jeffreys';

/**
 * The algorithm used to turn a pattern of 0/1 responses into a single ability
 * estimate. See {@link thetaEst} for an explanation of each method and when
 * to reach for it.
 */
export type Method = 'EAP' | 'BM' | 'ML' | 'WL';

/**
 * The criterion used to decide which item to administer next. See
 * {@link nextItem} for how each one works.
 */
export type Criterion = 'MFI' | 'bOpt';

/**
 * Options shared by the ability estimators ({@link thetaEst},
 * {@link semTheta}) and their high-level wrapper {@link estimateTheta}.
 * All fields are optional; every default mirrors catR.
 *
 * @example
 * ```js
 * // Bayesian modal estimate with a tight N(0, 1) prior:
 * thetaEst(items, responses, { method: 'BM', priorDist: 'norm', priorPar: [0, 1] });
 * ```
 */
export interface EstOpts {
  /** Estimation method. Default `"EAP"`. */
  method?: Method;
  /** Prior distribution (used by `EAP` and `BM`). Default `"norm"`. */
  priorDist?: PriorDist;
  /** Prior parameters. Default `[0, 1]` (a standard normal prior). */
  priorPar?: [number, number];
  /** Scaling constant. Default `1`; leave alone unless you have a reason. */
  D?: number;
  /** Search interval for root-finding methods. Default `[-4, 4]`. */
  range?: [number, number];
  /**
   * Integration interval + grid size for EAP: `[lower, upper, nPoints]`.
   * Default `[-4, 4, 33]` — catR's exact 33-point grid.
   */
  parInt?: [number, number, number];
  /**
   * SEM formula for BM/WL: `"classic"` (default) or `"new"`. `"new"` is only
   * partially supported; prefer the default.
   */
  semType?: 'classic' | 'new';
}

/**
 * Result of the 4PL item response function {@link pi}.
 */
export interface PiResult {
  /** Probability of a correct answer, in `[0, 1]` (clamped away from 0 and 1). */
  P: number;
  /** First derivative of `P` w.r.t. ability (always ≥ 0). */
  dP: number;
  /** Second derivative of `P` w.r.t. ability. */
  d2P: number;
  /** Third derivative of `P` w.r.t. ability. */
  d3P: number;
}
/**
 * Result of the item information function {@link ii}.
 */
export interface IiResult {
  /** Fisher information at the given ability (always ≥ 0). */
  Ii: number;
  /** First derivative of information w.r.t. ability. */
  dIi: number;
  /** Second derivative of information w.r.t. ability. */
  d2Ii: number;
}
/**
 * Result of the "Ji" quantity {@link ji} used by weighted-likelihood
 * (WL) estimation.
 */
export interface JiResult {
  /** The Ji quantity. */
  Ji: number;
  /** First derivative of Ji w.r.t. ability. */
  dJi: number;
}

/**
 * The **4-parameter logistic (4PL) item response function**: the probability
 * `P` that a person with ability `th` answers this item correctly, plus the
 * first three derivatives of that probability with respect to ability.
 *
 * This is the "S-curve" of IRT. Most of the time you only need the
 * probability `P`; the derivatives power the information function
 * ({@link ii}) and the ability estimators ({@link thetaEst}) and are returned
 * as a bonus so nothing has to be recomputed.
 *
 * The curve rises from the **guessing** floor `c` (very low ability) to the
 * **inattention** ceiling `d` (very high ability). It is steepest at the
 * **difficulty** `b`, and `a` controls how steep that transition is. To match
 * catR exactly, `P` is clamped to `[1e-10, 1 - 1e-10]` so it is never exactly
 * 0 or 1.
 *
 * @param th - Ability θ. Any real number, but in practice almost always within
 *   `[-4, 4]` (catR's default grid).
 * @param item - The item `{ a, b, c, d }`; see {@link Item}.
 * @param D - Scaling constant. catR's default is `1`; leave it alone unless
 *   you know you need something else.
 * @returns The probability and its first three derivatives (see
 *   {@link PiResult}). `P ∈ [0, 1]` (clamped), `dP ≥ 0`.
 *
 * @example
 * ```js
 * import { pi } from 'catjs-irt';
 *
 * const item = { a: 1.0, b: 0.0, c: 0.2, d: 1.0 };
 *
 * // A person of average ability has a 60% chance of answering correctly:
 * pi(0, item).P;   // ≈ 0.6
 *
 * // Ability helps — the item is easier for cleverer people:
 * pi(2, item).P;   // ≈ 0.90
 * pi(-2, item).P;  // ≈ 0.30
 * ```
 *
 * @see {@link genPattern} — draws actual 0/1 responses from these probabilities.
 * @see {@link ii} — the information function derived from `P`.
 */
export function pi(th: number, item: Item, D?: number): PiResult;

/**
 * **Fisher (item) information** at ability `th`: how much measurement
 * precision this item contributes *at that specific ability level*.
 *
 * Information is always ≥ 0 and is highest where the item is most
 * discriminating — in practice near its difficulty `b`. The more information
 * an item provides at the participant's current ability, the more the ability
 * estimate will shrink after that item is administered. This is exactly what
 * the **MFI** selection criterion maximises (see {@link nextItem}).
 *
 * A rough rule of thumb: the standard error of an ability estimate is roughly
 * `1 / sqrt(total information)`, so doubling the information cuts the SE by
 * ~30%.
 *
 * @param th - Ability θ. Any real number, almost always within `[-4, 4]`.
 * @param item - The item `{ a, b, c, d }`; see {@link Item}.
 * @param D - Scaling constant (default `1`), as in {@link pi}.
 * @returns Information and its first two derivatives (see {@link IiResult}).
 *   `Ii ≥ 0`; the derivatives can be negative.
 *
 * @example
 * ```js
 * import { ii } from 'catjs-irt';
 *
 * const item = { a: 1.0, b: 0.0, c: 0.2, d: 1.0 };
 * ii(0, item).Ii;  // ≈ 0.167 — this item tells us most about people near θ = 0
 * ```
 *
 * @see {@link pi} — the item response function information is built from.
 * @see {@link nextItem} — MFI selection uses `Ii` to pick the next item.
 */
export function ii(th: number, item: Item, D?: number): IiResult;

/**
 * The **Ji quantity** — a third-derivative term used internally by the
 * **weighted-likelihood (WL)** ability estimator ({@link thetaEst}).
 *
 * You will almost certainly never need to call this yourself; it is exported
 * so advanced users can inspect or validate the WL machinery.
 *
 * @param th - Ability θ, almost always within `[-4, 4]`.
 * @param item - The item `{ a, b, c, d }`; see {@link Item}.
 * @param D - Scaling constant (default `1`), as in {@link pi}.
 * @returns `{ Ji, dJi }` (see {@link JiResult}). `Ji` can be positive or
 *   negative (it is 0 when the item is symmetric about `th`).
 *
 * @see {@link thetaEst} — uses `ji` when `method: 'WL'`.
 */
export function ji(th: number, item: Item, D?: number): JiResult;

/**
 * **EAP ability estimate** (Expected A Posteriori): the *mean of the posterior
 * distribution* of ability given the responses and a prior.
 *
 * Concretely, it integrates
 * `θ · prior(θ) · L(θ) / ∫ prior(θ) · L(θ)` over a grid of abilities (default
 * 33 points from −4 to 4, catR's exact grid), where `L(θ)` is the likelihood
 * of the observed responses. The result is a single number on the ability
 * scale — typically inside `[-4, 4]`.
 *
 * EAP is the recommended default: it is robust even with very short tests or
 * unusual response patterns (e.g. all correct or all incorrect), because the
 * prior keeps the estimate from running off to ±∞.
 *
 * @param it - The items that were actually administered (an array of
 *   `{ a, b, c, d }`). Usually a *subset* of the full bank.
 * @param x - The 0/1 responses for those items, in the same order as `it`.
 * @param opts - Options; all optional.
 * @param opts.D - Scaling constant (default `1`).
 * @param opts.priorDist - Prior distribution: `"norm"` (default), `"unif"`, or
 *   `"Jeffreys"`.
 * @param opts.priorPar - Prior parameters (default `[0, 1]`).
 * @param opts.lower - Lower bound of the integration grid (default `-4`).
 * @param opts.upper - Upper bound of the integration grid (default `4`).
 * @param opts.nqp - Number of grid points (default `33`; catR's value).
 * @returns The EAP ability estimate, a number on the ability scale (almost
 *   always within `[lower, upper]`, i.e. typically `[-4, 4]`).
 *
 * @example
 * ```js
 * import { eapEst, eapSem } from 'catjs-irt';
 *
 * const items = [{ a: 1.0, b: -1.0, c: 0.2, d: 0.95 },
 *                { a: 1.5, b:  1.0, c: 0.1, d: 0.98 }];
 * const responses = [1, 0]; // first correct, second wrong
 *
 * eapEst(items, responses);                    // ≈ -0.10
 * eapEst(items, responses, { priorDist: 'unif', priorPar: [-3, 3] });
 * ```
 *
 * @see {@link thetaEst} — the general estimator; `thetaEst(it, x, { method: 'EAP' })`
 *   calls this.
 * @see {@link eapSem} — the standard error that goes with an EAP estimate.
 */
export function eapEst(
  it: Item[],
  x: number[],
  opts?: { D?: number; priorDist?: PriorDist; priorPar?: [number, number]; lower?: number; upper?: number; nqp?: number },
): number;

/**
 * **Standard error of an EAP estimate**: the posterior *standard deviation*
 * of ability, i.e. how uncertain we still are after seeing the responses.
 *
 * Smaller means more precise. As more informative items are administered the
 * SE shrinks; a CAT typically keeps administering items until the SE drops
 * below some threshold (see {@link checkStopRule}, rule `"precision"`).
 *
 * @param thEst - An ability estimate, normally from {@link eapEst} (or
 *   {@link thetaEst} with `method: 'EAP'`).
 * @param it - The administered items `{ a, b, c, d }`.
 * @param x - The 0/1 responses for those items, same order as `it`.
 * @param opts - Options; all optional (same as {@link eapEst}).
 * @param opts.D - Scaling constant (default `1`).
 * @param opts.priorDist - Prior distribution (default `"norm"`).
 * @param opts.priorPar - Prior parameters (default `[0, 1]`).
 * @param opts.lower - Integration lower bound (default `-4`).
 * @param opts.upper - Integration upper bound (default `4`).
 * @param opts.nqp - Grid points (default `33`).
 * @returns A positive standard error, typically in the range `0.1–1.5` for
 *   short tests (smaller = more precise).
 *
 * @example
 * ```js
 * import { eapEst, eapSem } from 'catjs-irt';
 *
 * const items = [{ a: 1.0, b: -1.0, c: 0.2, d: 0.95 },
 *                { a: 1.5, b:  1.0, c: 0.1, d: 0.98 }];
 * const responses = [1, 0];
 * const th = eapEst(items, responses);       // ≈ -0.10
 * eapSem(th, items, responses);              // ≈ 0.85
 * ```
 *
 * @see {@link semTheta} — the general SE function; `semTheta(..., { method: 'EAP' })`
 *   calls this.
 * @see {@link estimateTheta} — returns θ *and* its SE in one call.
 */
export function eapSem(
  thEst: number,
  it: Item[],
  x: number[],
  opts?: { D?: number; priorDist?: PriorDist; priorPar?: [number, number]; lower?: number; upper?: number; nqp?: number },
): number;

/**
 * Estimate a participant's **ability θ** from their 0/1 responses, using one
 * of four methods.
 *
 * This is the workhorse estimator: give it the administered items and the
 * responses, and it returns the best single-number estimate of the
 * participant's ability. The four methods differ in philosophy and in how
 * they behave on tricky data:
 *
 * | Method | Idea | When to reach for it |
 * |---|---|---|
 * | `"EAP"` (default) | Mean of the posterior (prior + likelihood). | **Default.** Robust even on short or extreme tests; the EWM experiment uses it. |
 * | `"BM"` | Mode of the posterior (same prior machinery as EAP). | When you want a Bayesian *most likely* value; behaves like ML but prior-pulled. |
 * | `"ML"` | Maximum likelihood: the ability that makes the responses most probable. | Long, well-behaved tests. Can run to ±4 with extreme patterns. |
 * | `"WL"` | Weighted likelihood; corrects ML's small-sample bias. | Similar to ML but less biased on short tests. |
 *
 * `EAP` and `BM` use the prior given by `priorDist`/`priorPar`; `ML` and `WL`
 * are prior-free. `NA`/`null` responses are silently dropped (along with their
 * items), matching catR.
 *
 * @param it - The administered items `{ a, b, c, d }` (a subset of the bank).
 * @param x - The 0/1 responses for those items, same order as `it`.
 * @param opts - Options (see {@link EstOpts}); all optional.
 * @param opts.method - `"EAP"` (default) \| `"BM"` \| `"ML"` \| `"WL"`.
 * @param opts.priorDist - Prior for EAP/BM (default `"norm"`).
 * @param opts.priorPar - Prior parameters (default `[0, 1]`).
 * @param opts.D - Scaling constant (default `1`).
 * @param opts.range - Root-finding interval for BM/ML/WL (default `[-4, 4]`).
 * @param opts.parInt - EAP grid `[lower, upper, n]` (default `[-4, 4, 33]`).
 * @returns The ability estimate, a number on the θ scale — almost always
 *   within `[-4, 4]`.
 *
 * @example
 * ```js
 * import { thetaEst } from 'catjs-irt';
 *
 * const items = [{ a: 1.0, b: -1.0, c: 0.20, d: 0.95 },
 *                { a: 1.5, b:  1.0, c: 0.10, d: 0.98 }];
 * const responses = [1, 0];          // one correct, one wrong
 *
 * thetaEst(items, responses);                    // EAP ≈ -0.10
 * thetaEst(items, responses, { method: 'BM' });  // ≈ -0.05
 * thetaEst(items, responses, { method: 'ML' });  // ≈ -0.16
 * thetaEst(items, responses, { method: 'WL' });  // ≈  0.28
 * ```
 *
 * @see {@link semTheta} — the standard error for a given method.
 * @see {@link estimateTheta} — a friendlier wrapper that maps item-bank
 *   indices to items and returns θ + SE together.
 */
export function thetaEst(it: Item[], x: number[], opts?: EstOpts): number;

/**
 * **Standard error (SE)** of an ability estimate for a given method — the
 * uncertainty that remains after the responses seen so far.
 *
 * The SE is computed differently per method (see {@link thetaEst}):
 *
 * - `EAP` — posterior SD (via {@link eapSem}).
 * - `ML` / `WL` — `1 / sqrt(test information)`.
 * - `BM` — `1 / sqrt(test information − prior term)`.
 *
 * Smaller SE = more precise. CATs typically keep administering items until the
 * SE is small enough (see {@link checkStopRule}, `"precision"` rule).
 *
 * @param thEst - An ability estimate, normally from {@link thetaEst} (or
 *   {@link estimateTheta}).
 * @param it - The administered items `{ a, b, c, d }`.
 * @param x - The 0/1 responses, same order as `it`.
 * @param opts - Options (see {@link EstOpts}); all optional.
 * @param opts.method - Estimation method — must match the one used to obtain
 *   `thEst` (default `"EAP"`).
 * @param opts.priorDist - Prior for EAP/BM (default `"norm"`).
 * @param opts.priorPar - Prior parameters (default `[0, 1]`).
 * @param opts.D - Scaling constant (default `1`).
 * @param opts.parInt - EAP grid (default `[-4, 4, 33]`).
 * @param opts.semType - `"classic"` (default) or `"new"`.
 * @returns A positive standard error, typically `0.1–1.5` for short tests;
 *   smaller = more precise.
 *
 * @example
 * ```js
 * import { thetaEst, semTheta } from 'catjs-irt';
 *
 * const items = [{ a: 1.0, b: -1.0, c: 0.2, d: 0.95 },
 *                { a: 1.5, b:  1.0, c: 0.1, d: 0.98 }];
 * const responses = [1, 0];
 *
 * const th = thetaEst(items, responses);           // EAP ≈ -0.10
 * semTheta(th, items, responses);                  // ≈ 0.85
 * semTheta(th, items, responses, { method: 'ML' }); // ≈ 1.88
 * ```
 *
 * @see {@link estimateTheta} — returns θ + SE together with no index juggling.
 */
export function semTheta(thEst: number, it: Item[], x: number[], opts?: EstOpts): number;

/**
 * Select the **next item** to administer, given the current ability estimate
 * and the items already used. This is the heart of adaptive testing.
 *
 * Two selection criteria are available:
 *
 * - `"MFI"` (default) — **Maximum Fisher Information**: pick the unused item
 *   whose information {@link ii} is highest *at the current ability*. This
 *   adapts to the participant: easier items for weaker participants, harder
 *   ones for stronger participants.
 * - `"bOpt"` — pick the unused item whose **difficulty** `b` is closest to
 *   the current ability. A simple, robust alternative when item parameters
 *   are limited.
 *
 * Already-administered items are excluded via `out`, and ties at the optimum
 * are broken at random (catR's `randomesque = 1`).
 *
 * @param itemBank - The full item bank (array of `{ a, b, c, d }`).
 * @param theta - Current ability estimate (use 0 for the very first item).
 * @param out - 0-indexed indices of items already administered (excluded from
 *   selection). Default `[]`.
 * @param opts - Options; all optional.
 * @param opts.criterion - `"MFI"` (default) or `"bOpt"`.
 * @param opts.randomesque - Only `1` (the default) is implemented.
 * @param opts.D - Scaling constant (default `1`).
 * @returns An object with:
 *   - `item` — the 0-indexed index of the chosen item in `itemBank`.
 *   - `par` — the chosen item's parameters `{ a, b, c, d }`.
 *   - `info` — the criterion value at selection: Fisher information for
 *     `MFI` (higher = more informative), or `|b − theta|` for `bOpt`
 *     (lower = closer difficulty).
 *   - `criterion` — which criterion was used (`"MFI"` or `"bOpt"`).
 *
 * @example
 * ```js
 * import { nextItem } from 'catjs-irt';
 *
 * const bank = [
 *   { a: 1.0, b: -1.0, c: 0.20, d: 0.95 },
 *   { a: 1.5, b:  1.0, c: 0.10, d: 0.98 },
 *   { a: 0.8, b:  0.0, c: 0.15, d: 0.96 },
 * ];
 *
 * // Start the test at θ = 0 with nothing administered yet:
 * nextItem(bank, 0, []);   // => { item: 1, par: { a: 1.5, b: 1, ... }, info: 0.20, criterion: 'MFI' }
 *
 * // After item 1 is used, it is no longer eligible:
 * nextItem(bank, 0, [1]);  // picks from the remaining items only
 * ```
 *
 * @see {@link selectNextItem} — a friendlier wrapper with the same behaviour.
 * @see {@link estimateTheta} — combine with this to run a real adaptive test.
 * @see {@link randomCAT} — automates the whole loop.
 */
export function nextItem(
  itemBank: Item[],
  theta: number,
  out?: number[],
  opts?: { criterion?: Criterion; randomesque?: number; D?: number },
): { item: number; par: Item; info: number; criterion: Criterion };

/**
 * Simulate a **0/1 response pattern**: for each item, draw a Bernoulli
 * response with probability equal to the item's 4PL probability {@link pi} at
 * the given ability.
 *
 * This is how you generate synthetic data, e.g. for Monte-Carlo studies of
 * test length, stopping rules, or estimation accuracy. It mirrors catR's
 * `genPattern` for the dichotomous case.
 *
 * @param theta - The (true) ability, or an array of abilities to generate one
 *   row per ability.
 * @param items - The items to "answer" (array of `{ a, b, c, d }`).
 * @param opts - Options; all optional.
 * @param opts.D - Scaling constant (default `1`).
 * @param opts.rng - Random number generator used for the Bernoulli draws.
 *   Defaults to `Math.random`; pass a seeded generator to make results
 *   reproducible.
 * @returns A single `number[]` of 0s and 1s if `theta` is a number, or a
 *   `number[][]` matrix (abilities × items) if `theta` is an array. `1` =
 *   correct, `0` = incorrect.
 *
 * @example
 * ```js
 * import { genPattern } from 'catjs-irt';
 *
 * const bank = [
 *   { a: 1.0, b: -1.0, c: 0.20, d: 0.95 },
 *   { a: 1.5, b:  1.0, c: 0.10, d: 0.98 },
 * ];
 *
 * // One simulated participant with true ability 0.5:
 * genPattern(0.5, bank);            // e.g. [1, 0]
 *
 * // Five participants, reproducible with a seeded rng:
 * genPattern([0.5, 0, -0.5, 1, 2], bank, { rng: mySeededRandom });
 * ```
 *
 * @see {@link simulateRespondents} — a thin wrapper that returns a tidy
 *   respondents × items matrix.
 * @see {@link randomCAT} — uses this internally to simulate a full test.
 */
export function genPattern(
  theta: number | number[],
  items: Item[],
  opts?: { D?: number; rng?: () => number },
): number[] | number[][];

/**
 * Generate response data for several **simulated respondents** at once.
 *
 * This is a thin convenience wrapper around {@link genPattern}. The result is
 * a matrix where **rows are participants** and **columns are items** — a
 * typical layout for feeding into `thetaEst`/IRT analysis in R, Python or
 * spreadsheets.
 *
 * @param thetas - One (true) ability per participant. Length = number of rows.
 * @param itemBank - The items everyone "answers" (array of `{ a, b, c, d }`).
 * @param opts - Options; all optional.
 * @param opts.D - Scaling constant (default `1`).
 * @param opts.rng - Random source (default `Math.random`); inject a seeded one
 *   for reproducibility.
 * @returns A `number[][]` matrix of shape `(thetas.length × itemBank.length)`
 *   containing 0s and 1s (`1` = correct).
 *
 * @example
 * ```js
 * import { simulateRespondents } from 'catjs-irt';
 *
 * const bank = [{ a: 1.0, b: -1.0, c: 0.2, d: 0.95 },
 *               { a: 1.5, b:  1.0, c: 0.1, d: 0.98 }];
 *
 * // 4 participants (rows) × 2 items (columns):
 * simulateRespondents([-1, 0, 1, 2], bank);
 * // e.g. [ [1, 0], [1, 1], [1, 1], [0, 1] ]
 * ```
 *
 * @see {@link genPattern} — the underlying generator.
 */
export function simulateRespondents(
  thetas: number[],
  itemBank: Item[],
  opts?: { D?: number; rng?: () => number },
): number[][];

/**
 * **Stopping rule** for an adaptive test: given the current ability estimate
 * and its SE, should the test stop now?
 *
 * Multiple rules can be combined; the test stops as soon as **any** of them
 * triggers (logical OR). This mirrors catR's `checkStopRule`.
 *
 * Available rules (each with a matching entry in `thr`):
 *
 * - `"length"` — stop once at least `thr` items have been administered
 *   (a hard cap on test length).
 * - `"precision"` — stop once the standard error `se ≤ thr` (the estimate is
 *   "precise enough").
 * - `"classification"` — stop once the 95% confidence interval for θ
 *   (`th ± z·se`) lies **entirely above or entirely below** `thr`, i.e. we
 *   are confident the participant is on one side of a cut-off. Use `alpha` to
 *   change the confidence level (default 0.05 → 95%).
 * - `"minInfo"` — stop once even the best remaining item provides
 *   information `≤ thr` (the bank can't tell us much more). Requires `items`.
 *
 * @param th - Current ability estimate.
 * @param se - Current standard error (from {@link semTheta} /
 *   {@link estimateTheta}).
 * @param n - Number of items administered so far.
 * @param opts - Rule configuration (required).
 * @param opts.rule - Array of rule names, e.g. `['length', 'precision']`.
 * @param opts.thr - Array of thresholds, one per rule, e.g. `[10, 0.3]`.
 * @param opts.alpha - Significance level for `"classification"` (default
 *   `0.05`).
 * @param opts.items - The remaining (or full) item bank, required for
 *   `"minInfo"`.
 * @param opts.D - Scaling constant (default `1`).
 * @returns `{ decision, rule }`:
 *   - `decision` — `true` if any rule triggered (stop), else `false`.
 *   - `rule` — the names of the rules that triggered (empty array when
 *     `decision` is `false`).
 *
 * @example
 * ```js
 * import { checkStopRule } from 'catjs-irt';
 *
 * // Stop when SE ≤ 0.3 OR after 10 items, whichever comes first:
 * checkStopRule(-0.1, 0.3, 8, { rule: ['precision', 'length'], thr: [0.3, 10] });
 * // => { decision: true, rule: ['precision'] }
 *
 * // Not there yet:
 * checkStopRule(-0.1, 0.5, 8, { rule: ['length'], thr: [10] });
 * // => { decision: false, rule: [] }
 * ```
 *
 * @see {@link randomCAT} — calls this internally to decide when to stop.
 */
export function checkStopRule(
  th: number,
  se: number,
  n: number,
  opts: { rule: string[]; thr: number[]; alpha?: number; items?: Item[] | null; D?: number },
): { decision: boolean; rule: string[] };

/**
 * Run a **full adaptive test simulation** from start to finish.
 *
 * The loop repeats until a stopping rule fires or the item bank is exhausted:
 * select the next item ({@link nextItem}) → (optionally) simulate a response
 * at the participant's *true* ability ({@link genPattern}) → update the
 * ability estimate and its SE ({@link thetaEst} + {@link semTheta}).
 *
 * Use this to study test length, stopping rules or estimation accuracy over
 * many simulated participants, or to sanity-check your real experiment's
 * parameters.
 *
 * @param trueTheta - The participant's *true* ability. Used only to simulate
 *   responses; in a real experiment you would not know it (see `responses`).
 * @param itemBank - The full item bank (array of `{ a, b, c, d }`).
 * @param opts - Options; all optional.
 * @param opts.method - Estimation method (default `"BM"` — a robust Bayesian
 *   default; use `"EAP"` to match the EWM experiment).
 * @param opts.priorDist - Prior for EAP/BM (default `"norm"`).
 * @param opts.priorPar - Prior parameters (default `[0, 1]`).
 * @param opts.D - Scaling constant (default `1`).
 * @param opts.range - Root-finding interval (default `[-4, 4]`).
 * @param opts.parInt - EAP grid (default `[-4, 4, 33]`).
 * @param opts.itemSelect - Item-selection criterion (default `"MFI"`).
 * @param opts.startTheta - Ability used for the very first selection (default
 *   `0`).
 * @param opts.stop - Stopping configuration passed to {@link checkStopRule}:
 *   `{ rule, thr, alpha }` (default `{ rule: ['length'], thr: [20] }`).
 * @param opts.minItems - Administer at least this many items before stopping
 *   is considered (default `0`).
 * @param opts.maxSteps - Hard cap on the number of administered items
 *   (default: the bank size).
 * @param opts.responses - Optional fixed 0/1 response sequence to replay
 *   instead of simulating (handy for testing / parity checks). When provided,
 *   `trueTheta` is ignored.
 * @param opts.rng - Random source for simulated responses (default
 *   `Math.random`); inject a seeded one for reproducibility.
 * @returns A run report (see below for each field). The two numbers you care
 *   about most are `finalTheta` and `finalSe`.
 *
 * **Returned object:**
 * - `administered` — 0-indexed indices of items used, in order.
 * - `responses` — the 0/1 responses, in order.
 * - `selected` — same as `administered` (kept for clarity).
 * - `infoHist` — Fisher information of each selected item at selection time.
 * - `thetaHist` — ability estimate after each step.
 * - `seHist` — standard error after each step.
 * - `stopRule` — which rule(s) ended the test, or `null` if the bank was
 *   exhausted first.
 * - `finalTheta` — final ability estimate (on the θ scale, usually in
 *   `[-4, 4]`).
 * - `finalSe` — final standard error (smaller = more precise).
 * - `nItems` — number of items administered.
 * - `method`, `itemSelect` — echo of the options used.
 *
 * @example
 * ```js
 * import { randomCAT } from 'catjs-irt';
 *
 * const bank = [
 *   { a: 1.0, b: -1.0, c: 0.20, d: 0.95 },
 *   { a: 1.5, b:  1.0, c: 0.10, d: 0.98 },
 *   { a: 0.8, b:  0.0, c: 0.15, d: 0.96 },
 * ];
 *
 * // Simulate a participant with true ability 0.7, EAP estimation,
 * // MFI selection, stopping after 3 items or when SE ≤ 0.4:
 * const run = randomCAT(0.7, bank, {
 *   method: 'EAP',
 *   stop: { rule: ['length', 'precision'], thr: [3, 0.4] },
 * });
 *
 * run.finalTheta;  // ≈ 0.93
 * run.finalSe;     // the SE of that estimate
 * run.administered; // which items were used, e.g. [1, 2, 0]
 * ```
 *
 * @see {@link nextItem} / {@link thetaEst} / {@link checkStopRule} — the
 *   building blocks this loops over.
 */
export function randomCAT(
  trueTheta: number,
  itemBank: Item[],
  opts?: {
    method?: Method;
    priorDist?: PriorDist;
    priorPar?: [number, number];
    D?: number;
    range?: [number, number];
    parInt?: [number, number, number];
    itemSelect?: Criterion;
    startTheta?: number;
    stop?: { rule: string[]; thr: number[]; alpha?: number };
    minItems?: number;
    maxSteps?: number | null;
    responses?: number[] | null;
    rng?: () => number;
  },
): {
  administered: number[];
  responses: number[];
  selected: number[];
  infoHist: number[];
  thetaHist: number[];
  seHist: number[];
  stopRule: string[] | null;
  finalTheta: number;
  finalSe: number;
  nItems: number;
  method: Method;
  itemSelect: Criterion;
};

/**
 * Estimate ability **and its standard error** from the items administered so
 * far — the function you call after every response in a real experiment.
 *
 * It is a friendly wrapper around {@link thetaEst} + {@link semTheta}: you
 * pass the full bank plus the *indices* of the items already given and their
 * responses, and it maps the indices to items for you.
 *
 * If nothing has been administered yet it returns the prior state,
 * `{ theta: 0, se: Infinity }` (matching the experiment's reference code).
 *
 * @param itemBank - The full item bank (array of `{ a, b, c, d }`).
 * @param administered - 0-indexed indices of the items already administered,
 *   in the order they were given.
 * @param responses - The 0/1 responses for those items, same order.
 * @param opts - Estimation options (see {@link EstOpts}); all optional.
 *   Defaults: `method: "EAP"`, `priorDist: "norm"`, `priorPar: [0, 1]`.
 * @returns `{ theta, se }`:
 *   - `theta` — the ability estimate (θ scale, usually in `[-4, 4]`).
 *   - `se` — its standard error (smaller = more precise).
 *
 * @example
 * ```js
 * import { estimateTheta } from 'catjs-irt';
 *
 * const bank = [
 *   { a: 1.0, b: -1.0, c: 0.20, d: 0.95 },
 *   { a: 1.5, b:  1.0, c: 0.10, d: 0.98 },
 * ];
 *
 * // Administered items 0 then 1; participant got item 0 right, item 1 wrong:
 * estimateTheta(bank, [0, 1], [1, 0]);
 * // => { theta: -0.10, se: 0.85 }
 *
 * // Bayesian modal estimate instead of the EAP default:
 * estimateTheta(bank, [0, 1], [1, 0], { method: 'BM' });
 * ```
 *
 * @see {@link selectNextItem} — pick the next item in the same loop.
 * @see {@link thetaEst} / {@link semTheta} — the lower-level functions.
 */
export function estimateTheta(
  itemBank: Item[],
  administered: number[],
  responses: number[],
  opts?: EstOpts,
): { theta: number; se: number };

/**
 * Select the **next item** to administer, given the full bank and the items
 * already used — the item-selection half of a real experiment loop.
 *
 * A friendly wrapper around {@link nextItem}: it always uses the **MFI**
 * criterion (maximum Fisher information at the current ability) and lets you
 * pass the bank and the used indices directly. Combine with
 * {@link estimateTheta} for a complete adaptive loop.
 *
 * @param itemBank - The full item bank (array of `{ a, b, c, d }`).
 * @param theta - Current ability estimate (use `0` for the first item).
 * @param administered - 0-indexed indices of items already administered
 *   (excluded from selection).
 * @param opts - Options; all optional.
 * @param opts.criterion - `"MFI"` (default) or `"bOpt"` (see
 *   {@link nextItem}).
 * @returns `{ item, par, info, criterion }`:
 *   - `item` — 0-indexed index of the chosen item in `itemBank`.
 *   - `par` — the chosen item's parameters `{ a, b, c, d }`.
 *   - `info` — the criterion value (Fisher info for `MFI`; `|b − theta|` for
 *     `bOpt`).
 *   - `criterion` — the criterion used.
 *
 * @example
 * ```js
 * import { selectNextItem } from 'catjs-irt';
 *
 * const bank = [
 *   { a: 1.0, b: -1.0, c: 0.20, d: 0.95 },
 *   { a: 1.5, b:  1.0, c: 0.10, d: 0.98 },
 *   { a: 0.8, b:  0.0, c: 0.15, d: 0.96 },
 * ];
 *
 * // First item of the test (θ starts at 0, nothing administered yet):
 * selectNextItem(bank, 0, []);
 * // => { item: 1, par: { a: 1.5, b: 1, c: 0.1, d: 0.98 }, info: 0.20, criterion: 'MFI' }
 *
 * // Typical loop:
 * let theta = 0, used = [];
 * for (let step = 0; step < 10; step++) {
 *   const { item } = selectNextItem(bank, theta, used);   // pick
 *   const response = 1; // run the trial, score it 0/1
 *   used.push(item);
 *   ({ theta } = estimateTheta(bank, used, responsesSoFar)); // update
 * }
 * ```
 *
 * @see {@link nextItem} — the lower-level implementation.
 * @see {@link estimateTheta} — the estimation half of the loop.
 */
export function selectNextItem(
  itemBank: Item[],
  theta: number,
  administered: number[],
  opts?: { criterion?: Criterion },
): { item: number; par: Item; info: number; criterion: Criterion };

/**
 * Standard normal (Gaussian) **probability density** at `x` — the height of
 * the bell curve — matching R's `dnorm(x, mean, sd)`.
 *
 * Mostly used internally by the EAP/BM estimators for the `"norm"` prior; you
 * generally do not need it directly.
 *
 * @param x - The value at which to evaluate the density.
 * @param mean - Mean (default `0`).
 * @param sd - Standard deviation (default `1`, must be > 0).
 * @returns The density, always ≥ 0. Peaks at `1 / (sd · √(2π))` when `x =
 *   mean` (≈ 0.399 for the standard normal).
 *
 * @see {@link qnorm} — the inverse CDF (z-score for a probability).
 */
export function dnorm(x: number, mean?: number, sd?: number): number;

/**
 * An evenly spaced sequence from `from` to `to` with `n` points, matching R's
 * `seq(from, to, length.out = n)`.
 *
 * Used internally to build the EAP integration grid (33 points from −4 to 4);
 * handy in your own code for plotting IRFs or scanning ability values.
 *
 * @param from - First value (inclusive).
 * @param to - Last value (inclusive).
 * @param n - Number of points (`n ≥ 2`).
 * @returns An array of `n` numbers, evenly spaced. `n = 1` would just be
 *   `[from]`.
 *
 * @example
 * ```js
 * import { linspace } from 'catjs-irt';
 * linspace(0, 1, 5);   // [0, 0.25, 0.5, 0.75, 1]
 * ```
 */
export function linspace(from: number, to: number, n: number): number[];

/**
 * Trapezoid integration of `y` over `x`, matching catR's `integrate.catR`.
 *
 * Used internally by the EAP estimator ({@link eapEst}) to approximate
 * integrals over the ability grid. The result is the (approximate) area under
 * the curve.
 *
 * @param x - Sorted x-values (grid points). Must have at least 2 points.
 * @param y - Function values at `x` (same length as `x`).
 * @returns The integral estimate (a single number).
 *
 * @example
 * ```js
 * import { integrateCatR } from 'catjs-irt';
 * // Area under a "ramp" y = 2x over [0, 1]:
 * integrateCatR([0, 0.5, 1], [0, 1, 2]);   // 1
 * ```
 *
 * @see {@link eapEst} — the main user of this.
 */
export function integrateCatR(x: number[], y: number[]): number;

/**
 * Inverse of the standard normal CDF: the **z-score** whose left-tail
 * probability is `p`, matching R's `qnorm(p, mean, sd)`.
 *
 * Used internally by the `"classification"` stopping rule ({@link
 * checkStopRule}); also handy for computing confidence intervals. Accuracy is
 * about 1e-9 (same class as R's implementation).
 *
 * @param p - A probability in `(0, 1)`. `p = 0` → `-Infinity`, `p = 1` →
 *   `Infinity`.
 * @param mean - Mean (default `0`).
 * @param sd - Standard deviation (default `1`).
 * @returns The quantile (z-score). Examples: `qnorm(0.5) = 0`,
 *   `qnorm(0.975) ≈ 1.96`.
 *
 * @see {@link dnorm} — the density.
 */
export function qnorm(p: number, mean?: number, sd?: number): number;

/**
 * Find a **root** (zero) of a function by bisection, matching R's `uniroot`.
 *
 * Advanced utility used internally by the BM/ML/WL estimators ({@link
 * thetaEst}) to solve the score equation. `f` **must change sign** across
 * `[lower, upper]` (e.g. be negative at one end and positive at the other),
 * otherwise an error is thrown.
 *
 * @param f - The function to find a zero of.
 * @param lower - Left end of the search interval.
 * @param upper - Right end of the search interval.
 * @param tol - Convergence tolerance (default `1.22e-4`, R's `uniroot`
 *   default — same accuracy class as catR).
 * @param maxIter - Maximum bisection steps (default `1000`).
 * @returns An approximate root `x` where `f(x) ≈ 0`.
 * @throws If `f(lower)` and `f(upper)` do not have opposite signs.
 */
export function uniroot(f: (x: number) => number, lower: number, upper: number, tol?: number, maxIter?: number): number;

/**
 * Minimise (or maximise) a scalar function on an interval by golden-section
 * search, analogous to R's `optimize()`.
 *
 * Advanced utility used internally by {@link thetaEst} as the fallback when
 * the score equation does not change sign on the interval.
 *
 * @param f - The function to optimise.
 * @param lower - Left end of the search interval.
 * @param upper - Right end of the search interval.
 * @param opts - Options; all optional.
 * @param opts.maximize - If `true`, maximise instead of minimise (default
 *   `false`).
 * @param opts.tol - Interval tolerance for convergence (default `1e-12`).
 * @param opts.maxIter - Maximum iterations (default `200`).
 * @returns `{ x, y }` where `x` is the minimiser/maximiser and `y = f(x)`.
 */
export function optimizeScalar(
  f: (x: number) => number,
  lower: number,
  upper: number,
  opts?: { maximize?: boolean; tol?: number; maxIter?: number },
): { x: number; y: number };
