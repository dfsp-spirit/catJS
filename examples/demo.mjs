#!/usr/bin/env node
/**
 * Demo: run a short adaptive simulation with catJS and print the trajectory.
 *
 * Usage: node examples/demo.mjs
 */

import {
  genPattern,
  randomCAT,
  estimateTheta,
  selectNextItem,
  qnorm,
} from '../src/index.js';

// A tiny synthetic bank (real-world items would come from an itembank CSV).
const bank = [
  { a: 0.8, b: -2.0, c: 0.10, d: 0.97 },
  { a: 1.1, b: -1.0, c: 0.15, d: 0.98 },
  { a: 1.3, b:  0.0, c: 0.20, d: 0.98 },
  { a: 1.2, b:  1.0, c: 0.15, d: 0.97 },
  { a: 0.9, b:  2.0, c: 0.10, d: 0.96 },
];

console.log('=== 1) Simulated adaptive run (EAP + MFI, precision stopping) ===');
const run = randomCAT(0.7, bank, {
  method: 'EAP',
  itemSelect: 'MFI',
  stop: { rule: ['precision', 'length'], thr: [0.3, 10] },
  minItems: 3,
  rng: Math.random,
});
for (let i = 0; i < run.nItems; i++) {
  console.log(
    `  step ${i + 1}: item #${run.selected[i]} (resp ${run.responses[i]}) ` +
      `theta=${run.thetaHist[i].toFixed(3)} se=${run.seHist[i].toFixed(3)}`,
  );
}
console.log(`  final: theta=${run.finalTheta.toFixed(3)} +/- ${run.finalSe.toFixed(3)}`);

console.log('\n=== 2) Step-by-step API (manual adaptive loop) ===');
let administered = [];
let responses = [];
let theta = 0.0;
for (let step = 0; step < 5; step++) {
  const { item } = selectNextItem(bank, theta, administered, { criterion: 'MFI' });
  administered.push(item);
  // simulate a response at true ability 0.7 using the 4PL:
  const P = Math.exp(1.0 * (0.7 - bank[item].b));
  const prob = bank[item].c + (bank[item].d - bank[item].c) * (P / (1 + P));
  const resp = Math.random() < prob ? 1 : 0;
  responses.push(resp);
  const { theta: th, se } = estimateTheta(bank, administered, responses, { method: 'EAP' });
  theta = th;
  console.log(`  step ${step + 1}: item #${item}, resp ${resp}, theta=${th.toFixed(3)} +/- ${se.toFixed(3)}`);
}

console.log('\n=== 3) Generate a response pattern for a given ability ===');
const pattern = genPattern([-1, 0, 1], bank, { rng: () => 0.5 });
console.log('  patterns at theta in {-1, 0, 1}:', JSON.stringify(pattern));

console.log('\n=== 4) 95%% CI via qnorm (for classification stopping) ===');
console.log('  z(0.975) =', qnorm(0.975).toFixed(4));
