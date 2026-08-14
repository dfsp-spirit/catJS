/**
 * Type declarations for catJS.
 *
 * Items are `{ a, b, c, d }` (discrimination, difficulty, guessing,
 * inattention). All item indices in the public API are 0-indexed.
 */

export type Item = { a: number; b: number; c: number; d: number };

export type PriorDist = 'norm' | 'unif' | 'Jeffreys';
export type Method = 'EAP' | 'BM' | 'ML' | 'WL';
export type Criterion = 'MFI' | 'bOpt';

export type EstOpts = {
  method?: Method;
  priorDist?: PriorDist;
  priorPar?: [number, number];
  D?: number;
  range?: [number, number];
  parInt?: [number, number, number];
  semType?: 'classic' | 'new';
};

export interface PiResult {
  P: number;
  dP: number;
  d2P: number;
  d3P: number;
}
export interface IiResult {
  Ii: number;
  dIi: number;
  d2Ii: number;
}
export interface JiResult {
  Ji: number;
  dJi: number;
}

export function pi(th: number, item: Item, D?: number): PiResult;
export function ii(th: number, item: Item, D?: number): IiResult;
export function ji(th: number, item: Item, D?: number): JiResult;

export function eapEst(
  it: Item[],
  x: number[],
  opts?: { D?: number; priorDist?: PriorDist; priorPar?: [number, number]; lower?: number; upper?: number; nqp?: number },
): number;
export function eapSem(
  thEst: number,
  it: Item[],
  x: number[],
  opts?: { D?: number; priorDist?: PriorDist; priorPar?: [number, number]; lower?: number; upper?: number; nqp?: number },
): number;

export function thetaEst(it: Item[], x: number[], opts?: EstOpts): number;
export function semTheta(thEst: number, it: Item[], x: number[], opts?: EstOpts): number;

export function nextItem(
  itemBank: Item[],
  theta: number,
  out?: number[],
  opts?: { criterion?: Criterion; randomesque?: number; D?: number },
): { item: number; par: Item; info: number; criterion: Criterion };

export function genPattern(
  theta: number | number[],
  items: Item[],
  opts?: { D?: number; rng?: () => number },
): number[] | number[][];

export function simulateRespondents(
  thetas: number[],
  itemBank: Item[],
  opts?: { D?: number; rng?: () => number },
): number[][];

export function checkStopRule(
  th: number,
  se: number,
  n: number,
  opts: { rule: string[]; thr: number[]; alpha?: number; items?: Item[] | null; D?: number },
): { decision: boolean; rule: string[] };

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

export function estimateTheta(
  itemBank: Item[],
  administered: number[],
  responses: number[],
  opts?: EstOpts,
): { theta: number; se: number };

export function selectNextItem(
  itemBank: Item[],
  theta: number,
  administered: number[],
  opts?: { criterion?: Criterion },
): { item: number; par: Item; info: number; criterion: Criterion };

export function dnorm(x: number, mean?: number, sd?: number): number;
export function linspace(from: number, to: number, n: number): number[];
export function integrateCatR(x: number[], y: number[]): number;
export function qnorm(p: number, mean?: number, sd?: number): number;
export function uniroot(f: (x: number) => number, lower: number, upper: number, tol?: number, maxIter?: number): number;
export function optimizeScalar(
  f: (x: number) => number,
  lower: number,
  upper: number,
  opts?: { maximize?: boolean; tol?: number; maxIter?: number },
): { x: number; y: number };
