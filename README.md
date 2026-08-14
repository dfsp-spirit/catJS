# catJS

A faithful **JavaScript port of the subset of the R package
[catR](https://cran.r-project.org/package=catR)** used by the EWM adaptive
working memory experiment (PsychoPy implementation). The goal is a
drop-in replacement for the `catR` bridge (`rpy2`) so the adaptive engine can
run without R.

**This is a proof of concept.** It deliberately does *exactly* what catR does
(including its quirks and numerics) so that stakeholders can verify *"does it
do what catR does?"*. Improvements can come later — parity first.

## What is ported

| catR function               | catJS                                                  | Used for                    |
|-----------------------------|--------------------------------------------------------|-----------------------------|
| `Pi()` / `Ii()`             | `pi()` / `ii()`  (`src/irf.js`)                        | 4PL IRF + Fisher information |
| `thetaEst(method="EAP")`    | `thetaEst()` / `estimateTheta()` (`src/eap.js`, `src/estimators.js`) | ability estimate |
| `semTheta(method="EAP")`    | `semTheta()`                                           | standard error              |
| `nextItem(criterion="MFI")` | `nextItem()` / `selectNextItem()` (`src/selection.js`) | adaptive item selection     |

Faithfully replicated details:

- 4PL IRF with catR's exact clamp (`P==0 → 1e-10`, `P==1 → 1-1e-10`).
- EAP over the same **33-point grid** `seq(-4, 4, length=33)`, normal prior
  `N(0,1)`, and catR's **trapezoid** integration (`integrate.catR`).
- MFI selection by maximum Fisher information with catR's random tie-breaking
  (`randomesque=1`).

## Usage

```js
import { estimateTheta, selectNextItem } from 'catjs';

const bank = [
  { a: 1.0, b: -1.0, c: 0.20, d: 0.95 },
  { a: 1.5, b:  1.0, c: 0.10, d: 0.98 },
  // ...
];

let administered = [];
let responses = [];

// select first item (theta starts at 0)
const { item } = selectNextItem(bank, 0.0, administered);
administered.push(item);

// ... run the trial, score it (1/0) ...

// estimate ability + SE
const { theta, se } = estimateTheta(bank, administered, responses);
console.log(theta, se);
```

Item indices are **0-indexed** in the public API.

## Parity with catR (the proof of concept)

The repo ships a validation harness that compares the JS port against the
**real R `catR` package** on the actual EWM item bank:

```bash
# 1. Generate ground-truth catR output (simulated participants)
Rscript scripts/generate_reference.R /path/to/ewm/assets/csv/itembank.csv

# 2. Replay every step in JS and compare
node scripts/validate.mjs
```

`scripts/generate_reference.R` simulates adaptive runs (MFI selection + EAP
estimation + SEM) for participants of various true abilities on your real item
bank and stores catR's exact output in `reference/catr_reference.json`.
`scripts/validate.mjs` replays every step with catJS and reports the maximum
absolute differences for `theta`, `se` and item information, plus
tie-consistent item-selection checks.

> Note: catR samples randomly among items tied at maximum information. The
> validation therefore checks item *information* exactly and item *selection*
> for tie-consistency rather than expecting the identical random pick.

### Measured results (real EWM item bank, catR 3.17 / R 4.6.1)

25 simulated participants × 20 adaptive steps each (500 estimation steps,
72,500 information comparisons), using the actual 145-item bank including the
extreme parameters:

| Quantity | Comparisons | Max \|diff\| |
|----------|-------------|--------------|
| ability estimate `theta`   | 500   | 2.7e-13 |
| standard error `se`        | 500   | 4.4e-13 |
| item information (MFI)     | 72,500 | 9.7e-13 |
| item selection (tie-check) | 500   | 0 mismatches |

i.e. the JS port reproduces catR to **floating-point precision** on the
experiment's own data.

## Development

```bash
# Unit tests (Node built-in runner, no dependencies)
node --test test/

# Generate reference + validate against catR
npm run gen:reference -- /path/to/itembank.csv
npm run validate
```

## Scope / non-goals (for now)

- Only `method="EAP"` (thetaEst / semTheta) and `criterion="MFI"` (nextItem)
  are implemented — exactly what the EWM experiment uses. Other catR methods
  raise a clear "not implemented" error.
- `randomesque` is fixed at catR's default `1`.
- The numerics mirror catR exactly, including its known weaknesses (raw
  product likelihood, 33-point grid). Making it *more* robust than catR is a
  deliberate follow-up, after parity is proven.
