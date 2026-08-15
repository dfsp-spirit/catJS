# catJS

[![CI](https://github.com/dfsp-spirit/catJS/actions/workflows/ci.yml/badge.svg)](https://github.com/dfsp-spirit/catJS/actions/workflows/ci.yml)
[![Validate](https://github.com/dfsp-spirit/catJS/actions/workflows/validate.yml/badge.svg)](https://github.com/dfsp-spirit/catJS/actions/workflows/validate.yml)
[![Docs](https://github.com/dfsp-spirit/catJS/actions/workflows/docs.yml/badge.svg)](https://github.com/dfsp-spirit/catJS/actions/workflows/docs.yml)

A faithful **JavaScript port of the most relevant feature subset of the R package
[catR](https://cran.r-project.org/package=catR)**.

> **API docs:** the generated TypeDoc reference is published to GitHub Pages at
> <https://dfsp-spirit.github.io/catJS/>. Build it locally with `npm run docs`
> (outputs to `docs/`, gitignored).

Useful to run psychological online experiments that require live computerized adaptive testing based on item response theory in browser-based platforms like jspsych.

**This is a proof of concept.** It deliberately does *exactly* what catR does
(including its quirks and numerics) so that stakeholders can verify *"does it
do what catR does?"*. Improvements can come later — parity first.

## What is ported

| catR function                    | catJS (`src/…`)                                        | Notes |
|----------------------------------|--------------------------------------------------------|-------|
| `Pi()` / `Ii()` / `Ji()`         | `pi()` / `ii()` / `ji()`  (`irf.js`)                   | 4PL IRF + Fisher info + derivatives |
| `thetaEst(method="EAP")`         | `thetaEst()` / `estimateTheta()` (`eap.js`, `estimators.js`) | ability estimate |
| `thetaEst(method="BM"/"ML"/"WL")`| `thetaEst()` (`estimators.js`)                         | root-finding, catR's exact algorithm |
| `semTheta(method="EAP"/"BM"/"ML"/"WL")` | `semTheta()` (`estimators.js`)                  | standard error |
| `nextItem(criterion="MFI"/"bOpt")` | `nextItem()` / `selectNextItem()` (`selection.js`)    | adaptive item selection |
| `genPattern`                     | `genPattern()` (`simulation.js`)                       | 0/1 response generation |
| `checkStopRule`                  | `checkStopRule()` (`simulation.js`)                    | length/precision/classification/minInfo |
| `randomCAT` (minimal)            | `randomCAT()` (`simulation.js`)                        | catR-inspired loop |

Faithfully replicated details:

- 4PL IRF with catR's exact clamp (`P==0 → 1e-10`, `P==1 → 1-1e-10`) and the
  full derivative set (`dP`, `d2P`, `d3P`, `Ii`, `dIi`, `d2Ii`, `Ji`, `dJi`).
- EAP over catR's **33-point grid** `seq(-4, 4, length=33)`, priors
  `norm` / `unif` / `Jeffreys`, and catR's **trapezoid** integration.
- BM/ML/WL exactly as catR: solve the score equation by bisection (`uniroot`)
  over `range=c(-4,4)`, with catR's `optimize()`-based fallback when the score
  does not change sign.
- MFI / bOpt selection with catR's random tie-breaking (`randomesque=1`).

## Usage

```js
import { estimateTheta, selectNextItem, randomCAT, genPattern } from 'catjs';

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

// estimate ability + SE (EAP; also BM/ML/WL via opts)
const { theta, se } = estimateTheta(bank, administered, responses);
console.log(theta, se);

// full simulation (selection + response + estimation + stopping)
const run = randomCAT(0.7, bank, { method: 'EAP', stop: { rule: ['precision', 'length'], thr: [0.3, 10] } });
console.log(run.finalTheta, run.finalSe);
```

Item indices are **0-indexed** in the public API.

## Parity with catR (the proof of concept)

The repo ships a validation harness that compares the JS port against the
**real R `catR` package**:

```bash
# 1. Generate ground-truth catR output (simulated participants)
Rscript scripts/generate_reference.R /path/to/ewm/assets/csv/itembank.csv
Rscript scripts/generate_reference_derivatives.R /path/to/ewm/assets/csv/itembank.csv

# 2. Replay every step in JS and compare
node scripts/validate.mjs
```

`scripts/generate_reference.R` simulates adaptive runs (selection + estimation
for EAP/BM/ML/WL and priors) on the item bank and stores catR's exact output in
`reference/catr_reference.json`. `validate.mjs` replays every step with catJS
and reports maximum absolute differences.

> catR samples randomly among items tied at the optimum. The validation
> therefore checks the criterion values (`Ii`, `|b−θ|`) exactly and item
> *selection* for tie-consistency.

### Measured results

**Real EWM item bank (145 items, catR 3.17 / R 4.6.1)** — the experiment's
exact path (EAP + MFI + bOpt):

| Quantity | Comparisons | Max \|diff\| |
|----------|-------------|--------------|
| ability estimate `theta` (EAP) | 500 | 2.7e-13 |
| standard error `se` (EAP)      | 500 | 4.4e-13 |
| item information `Ii`          | 72,500 | 9.0e-13 |
| MFI selection                  | 500 | 0 mismatches |
| bOpt selection                 | 500 | 0 mismatches |
| IRF derivatives (`Pi`/`Ii`/`Ji`) | 9,135 | 1.0e-10 |

**Well-behaved bank (40 realistic items)** — proves the BM/ML/WL port:

| Quantity | Comparisons | Max \|diff\| |
|----------|-------------|--------------|
| EAP `theta` / `se`             | 240 | 8.9e-16 |
| BM / ML / WL `theta`           | 720 | 8.2e-5 (catR's own uniroot tol is ~1.2e-4) |
| BM / ML / WL `se`              | 720 | 7.6e-5 |
| MFI / bOpt selection           | 480 | 0 mismatches |

So the experiment's EAP path matches catR to **floating-point precision**, and
BM/ML/WL match catR to **catR's own numerical precision**. Validate the good
bank with: `node scripts/validate.mjs reference/catr_reference_goodbank.json`.

## Development

```bash
# Unit tests (Node built-in runner, no dependencies)
node --test test/

# Regenerate references + validate against catR
npm run gen:reference -- /path/to/itembank.csv
npm run gen:derivatives -- /path/to/itembank.csv
npm run validate

# Demo
node examples/demo.mjs
```

## Scope / non-goals

- The dichotomous model with methods `EAP`/`BM`/`ML`/`WL`, priors
  `norm`/`unif`/`Jeffreys`, and criteria `MFI`/`bOpt` are implemented. The rest
  of catR (polytomous models, other criteria, content balancing, exact SEM)
  raises a clear "not implemented" error.
- `randomesque` is fixed at catR's default `1`.
- The numerics mirror catR exactly, including its known weaknesses (raw
  product likelihood, 33-point grid). Making it *more* robust than catR is a
  deliberate follow-up, after parity is proven.
- **Important:** on the real (degenerate) test item bank, BM/ML/WL are numerically
  unstable in catR *itself* (catR clamps ~1/3 of ML estimates to ±4). Only EAP
  is robust there — which is what the EWM experiment uses.


## Acknowledgements, Getting Help, Author and License

catJS was written by [Tim Schäfer](https://ts.rcmd.org/), who translated the
[catR](https://cran.r-project.org/web/packages/catR/index.html)
[source code](https://github.com/cran/catR) to JavaScript. **catJS is a
JavaScript port of the R package `catR` — it is not written or endorsed by the
catR authors.** All credit for the methods implemented here goes to them:

- **David Magis** (University of Liège, Belgium)
- **Gilles Raîche** (Université du Québec à Montréal, Canada)
- **Juan Ramón Barrada** (University of Zaragoza, Spain)

The catR package is currently maintained by **Cheng Hua**.

### Citing catR

If you use catJS in academic work, please cite the catR papers (and your own
paper for the adaptive task, if applicable). The authoritative citation
information is provided in the [catR citation
file](https://cran.r-project.org/web/packages/catR/citation.html) on CRAN.

- Magis D, Raîche G (2012). "Random Generation of Response Patterns under
  Computerized Adaptive Testing with the R Package catR." *Journal of
  Statistical Software*, 48(8), 1–31. doi:[10.18637/jss.v048.i08](https://doi.org/10.18637/jss.v048.i08)
- Magis D, Barrada JR (2017). "Computerized Adaptive Testing with R: Recent
  Updates of the Package catR." *Journal of Statistical Software, Code
  Snippets*, 76(1), 1–19. doi:[10.18637/jss.v076.c01](https://doi.org/10.18637/jss.v076.c01)

Copy-paste BibTeX:

```bibtex
@article{magis2012random,
  author  = {Magis, David and Ra{\^\i}che, Gilles},
  title   = {Random Generation of Response Patterns under Computerized
             Adaptive Testing with the {R} Package {catR}},
  journal = {Journal of Statistical Software},
  year    = {2012},
  volume  = {48},
  number  = {8},
  pages   = {1--31},
  doi     = {10.18637/jss.v048.i08}
}

@article{magis2017computerized,
  author  = {Magis, David and Barrada, Juan Ram{\'o}n},
  title   = {Computerized Adaptive Testing with {R}: Recent Updates of the
             Package {catR}},
  journal = {Journal of Statistical Software, Code Snippets},
  year    = {2017},
  volume  = {76},
  number  = {1},
  pages   = {1--19},
  doi     = {10.18637/jss.v076.c01}
}
```

If you want to cite catJS itself (i.e. the software you actually ran), please
cite its GitHub repository: <https://github.com/dfsp-spirit/catJS>.

### License

The license of catJS is [GPLv3](./LICENSE), as catR is also published under
that license.

### Getting help

Please note that the catR authors are not responsible for this partial port of
catR to JS: do not contact them with requests for help. Please [open an
issue](https://github.com/dfsp-spirit/catJS/issues) in this repo on GitHub
instead.