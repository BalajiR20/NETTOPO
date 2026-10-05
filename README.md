# NETTOPO — Interactive Network Topology & Circuit Analysis

NETTOPO is a browser application that shows **how network topology becomes
mathematics, and how that mathematics becomes the electrical solution**. You
draw a circuit, NETTOPO derives its linear oriented graph, and you pick one of
the six topological methods of K. S. Suresh Kumar, *Electric Circuits and
Networks*, Chapter 17. NETTOPO then builds **only** the mathematics that method
needs, solves it, verifies it, and visualises it.

```
BUILD → UNDERSTAND GRAPH → SELECT METHOD → GENERATE ONLY REQUIRED MATHEMATICS
      → SOLVE → VERIFY → VISUALIZE → OSCILLOSCOPE → EXPORT
```

It runs entirely in the browser: there is no backend, no database server and no
internet requirement once it is installed.

---

## Contents

1. [Features](#features)
2. [Requirements](#requirements)
3. [Setup on Windows](#setup-on-windows)
4. [Setup on Linux](#setup-on-linux)
5. [Running the app](#running-the-app)
6. [Running the tests](#running-the-tests)
7. [Building for production](#building-for-production)
8. [npm scripts](#npm-scripts)
9. [Project structure](#project-structure)
10. [Troubleshooting](#troubleshooting)
11. [Documentation](#documentation)
12. [Reference and licences](#reference-and-licences)

---

## Features

* **Circuit editor** (React Flow): resistor, independent voltage and current source, node, junction, ground and wires. Drag-and-drop, rotate, reverse branch orientation, edit values and labels, undo/redo, copy/paste, snap-to-grid, zoom/pan and keyboard shortcuts.
* **The graph is the source of truth.** The schematic is converted into an oriented graph (nodes + branches) by a pure function; the canvas is never read back as mathematics.
* **Six methods:** Incidence Matrix **A**, **Nodal**, Fundamental Circuit Matrix **Bf**, **Loop**, Fundamental Cut-Set Matrix **Qf** and **Node-Pair** analysis.
* **Lazy analysis.** While you edit, only nodes, branches and connectivity are computed. A, Bf, Qf, trees and equations are built only for the method you select.
* **Interactive spanning-tree selection** with live validation (twig count, nodes covered, connectivity, cycle detection), *Suggest valid tree*, and the det(A Aᵀ) tree count.
* **Interactive matrices and equations.** Click a matrix column, row or entry, or a variable such as `i₂` in a KaTeX equation, and the matching branch, node, f-circuit or f-cut-set is highlighted everywhere. Each matrix entry explains why it is +1, −1 or 0.
* **Step-by-step analysis** with *WHY?* explanations that cite Chapter 17. The steps reflect the selected method and its configuration.
* **Verification engine:** KCL, KVL, element relations, Tellegen's theorem, A·Bfᵀ = 0, Qf·Bfᵀ = 0, tree validity, rank and numerical residual. Each check shows its real residual and PASS / WARNING / FAIL.
* **Results on the circuit:** currents (with the actual direction when negative), voltages with polarity, absorbed/delivered power, and an optional *mathematical current-flow visualization*.
* **Custom oscilloscope** (HTML Canvas, 4 channels) driven by the actual result.
* **Topology Explorer**, **Compare methods**, and a **PDF engineering report** generated locally.
* **Saving:** autosave in the browser (IndexedDB), a project library, and `.nettopo` JSON import/export.
* **Seven built-in examples** with expected results, including textbook Examples 17.4-1 and 17.7-1.

---

## Requirements

| Tool | Version | Needed for |
|---|---|---|
| **Node.js** | **22.12 or newer** (22 LTS or 24 LTS recommended) | everything (Vite 8 and Vitest 5 require it) |
| **npm** | comes with Node.js (10+) | installing packages, running scripts |
| **Git** | any recent version | cloning the repository |
| **Web browser** | recent Chrome, Edge, Firefox or Safari | using the app |
| Chromium for Playwright | installed by a command below | **only** for the end-to-end tests |

Disk space: about 600 MB for `node_modules`, plus about 300 MB if you install the Playwright browser.

Check what you already have:

```bash
node -v     # must print v22.12.0 or higher
npm -v
git --version
```

---

## Setup on Windows

The commands below work in **PowerShell** (Windows 10/11). Windows Terminal is recommended.

### 1. Install Git

Pick **one**:

* **winget** (built into Windows 10/11):
  ```powershell
  winget install --id Git.Git -e
  ```
* or download the installer from <https://git-scm.com/download/win> and keep the default options.

Close and reopen PowerShell afterwards so `git` is on your `PATH`.

### 2. Install Node.js 22 LTS

Pick **one**:

* **winget:**
  ```powershell
  winget install --id OpenJS.NodeJS.LTS -e
  ```
* **Official installer:** download the *LTS* `.msi` from <https://nodejs.org/> and run it. Leave "Add to PATH" checked.
* **nvm-windows** (if you need several Node versions): install it from
  <https://github.com/coreybutler/nvm-windows/releases>, then:
  ```powershell
  nvm install 22
  nvm use 22
  ```

Close and reopen PowerShell, then verify:

```powershell
node -v
npm -v
```

> **"running scripts is disabled on this system"?** PowerShell may block `npm.ps1`. Allow local scripts for your user once:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
> Or run the same commands from **Command Prompt** (`cmd.exe`) instead.

### 3. Get the code

```powershell
cd $HOME\Documents
git clone <repository-url> NETTOPO
cd NETTOPO
```

Replace `<repository-url>` with the URL of this repository. If you received the project as a ZIP, extract it and `cd` into the extracted folder instead.

> Keep the path short (for example `C:\dev\NETTOPO`) to avoid Windows path-length problems inside `node_modules`.

### 4. Install dependencies

```powershell
npm install
```

npm may print a notice that it skipped an install script (for `core-js`). This is harmless; NETTOPO does not need it.

### 5. Start the app

```powershell
npm run dev
```

Open <http://localhost:5173> in your browser. Press **Ctrl + C** in PowerShell to stop the server.

### 6. (Optional) Set up the end-to-end tests

```powershell
npx playwright install chromium
npm run test:e2e
```

---

## Setup on Linux

The commands below are for Ubuntu/Debian. Package names for other distributions are listed at the end of this section.

### 1. Install Git and build basics

```bash
sudo apt update
sudo apt install -y git curl ca-certificates
```

### 2. Install Node.js 22 LTS

Pick **one**.

**Option A: nvm (recommended, no sudo needed for Node itself)**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# open a new terminal, or load nvm into this one:
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"

nvm install 22
nvm use 22
nvm alias default 22
```

> With nvm, every **new** terminal loads Node automatically through `~/.bashrc`.
> In a non-interactive shell (scripts, CI, some IDE terminals), run
> `. ~/.nvm/nvm.sh` first if `node` is "command not found".

**Option B: NodeSource packages (system-wide)**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

> Do **not** use the distribution's default `nodejs` package unless `node -v` reports 22.12 or newer. Many distributions ship older versions.

Verify:

```bash
node -v
npm -v
```

### 3. Get the code

```bash
cd ~/Projects            # or any folder you like
git clone <repository-url> NETTOPO
cd NETTOPO
```

### 4. Install dependencies

```bash
npm install
```

Do not use `sudo npm install`. If you get `EACCES` errors, see [Troubleshooting](#troubleshooting).

### 5. Start the app

```bash
npm run dev
```

Open <http://localhost:5173>. Stop the server with **Ctrl + C**.

To open the app from another device on your network, run `npm run dev -- --host` and use the "Network" URL that Vite prints.

### 6. (Optional) Set up the end-to-end tests

Playwright needs Chromium and a few system libraries:

```bash
npx playwright install --with-deps chromium   # asks for sudo to install system libraries
npm run test:e2e
```

### Other distributions

| Distribution | Git | Node.js 22 |
|---|---|---|
| Fedora / RHEL | `sudo dnf install git` | nvm (Option A), or `sudo dnf install nodejs22` where available |
| Arch / Manjaro | `sudo pacman -S git` | `sudo pacman -S nodejs-lts-jod npm` or nvm |
| openSUSE | `sudo zypper install git` | nvm (Option A) |

On distributions where `--with-deps` is not supported, use `npx playwright install chromium` and install any missing libraries it reports.

---

## Running the app

```bash
npm run dev
```

* App: <http://localhost:5173>
* The first run loads the **two-loop example**. Use **New** for an empty canvas, or **File → Examples** for the other examples.
* Your work is autosaved in the browser (IndexedDB). It stays in that browser profile; export a `.nettopo` file (**File → Export JSON**) to move it elsewhere.
* A short walkthrough: **Analyze** → pick a method → choose a reference node or click branches to build a spanning tree → **Run** / **Confirm tree & analyze** → explore the **Matrix**, **Equations**, **Results**, **Verification** and **Oscilloscope** tabs → **Export PDF**.

The full walkthrough is in [docs/USER_GUIDE.md](docs/USER_GUIDE.md). Press **?** inside the app for keyboard shortcuts.

---

## Running the tests

| Command | What it runs | Notes |
|---|---|---|
| `npm test` | Unit + integration tests (Vitest + React Testing Library, jsdom) | no browser needed |
| `npm run test:watch` | Vitest in watch mode | re-runs on file save |
| `npm run test:coverage` | tests with a coverage report in `coverage/` | |
| `npm run test:e2e` | 4 Playwright end-to-end tests in Chromium | starts its own dev server on port **5174**; requires `npx playwright install chromium` once |
| `npm run check` | type check + lint + unit tests | run this before committing |

The unit tests reproduce the textbook's worked examples (Fig. 17.2-1, Examples 17.4-1 and 17.7-1). They also check that every method gives the same answer on every spanning tree and under every branch-orientation reversal. See [docs/TESTING.md](docs/TESTING.md).

---

## Building for production

```bash
npm run build      # type-checks, then writes the static site to dist/
npm run preview    # serves dist/ at http://localhost:4173
```

`dist/` is a plain static website. Copy it to any static host (GitHub Pages, Netlify, nginx, an internal web server) or open it through `npm run preview`. No server-side code is involved.

> Opening `dist/index.html` directly from the file system (`file://`) does not work, because browsers block module scripts there. Serve it over HTTP.

---

## npm scripts

| Script | Description |
|---|---|
| `npm run dev` | Development server with hot reload (port 5173) |
| `npm run build` | `tsc -b` type check, then the Vite production build |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript project check only |
| `npm run lint` | Lint with oxlint |
| `npm test` | Unit and integration tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with coverage |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run check` | typecheck + lint + test |

---

## Project structure

```
NETTOPO/
├── docs/                    Architecture, mathematics, solvers, testing, user guide, …
├── e2e/                     Playwright end-to-end tests
├── public/                  Static assets (favicon)
├── src/
│   ├── app/                 App shell and project actions (new/open/save/import/export)
│   ├── assets/fonts/        DejaVu fonts embedded in PDF reports (+ licence)
│   ├── components/          React UI
│   │   ├── analysis/        Method cards, reference picker, tree selection, steps
│   │   ├── circuit/         React Flow canvas, symbols, toolbox, properties
│   │   ├── equations/       KaTeX rendering with clickable variables
│   │   ├── matrices/        Interactive matrix tables and explanations
│   │   ├── oscilloscope/    Canvas oscilloscope
│   │   ├── results/         Results tables
│   │   ├── topology/        Oriented-graph view, Topology Explorer
│   │   ├── verification/    Verification panel
│   │   ├── layout/          Top bar, bottom panel, dialogs
│   │   └── ui/              shadcn/ui primitives
│   ├── domain/              Pure data model (schematic, network, elements, analysis, project schema)
│   ├── engine/              Pure TypeScript engines (no React)
│   │   ├── graph/           Connectivity, paths, cycles, components
│   │   ├── topology/        Incidence, tree, fundamental circuits, cut-sets
│   │   ├── solvers/         incidence, nodal, loop (+Bf), nodePair (+Qf), shared partitioned engine, comparison
│   │   ├── numerical/       math.js wrapper, rank, residuals, formatting
│   │   ├── verification/    KCL, KVL, Tellegen, orthogonality, …
│   │   ├── simulation/      Signal model and oscilloscope renderer
│   │   ├── reporting/       PDF report and SVG schematic renderer
│   │   └── explanations/    "WHY?" texts
│   ├── examples/            Built-in examples with expected results
│   ├── hooks/               React hooks (network, results, autosave, shortcuts)
│   ├── persistence/         IndexedDB (Dexie)
│   ├── store/               Zustand stores (circuit, ui, analysis, simulation, report, project)
│   └── tests/               Fixtures, helpers and integration tests
├── package.json
├── playwright.config.ts
├── tsconfig*.json
└── vite.config.ts           Vite + Vitest configuration
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `node: command not found` (Linux, nvm) | Open a new terminal, or run `. ~/.nvm/nvm.sh`. Check with `nvm current`. |
| `npm` is not recognised (Windows) | Reopen PowerShell after installing Node.js. If it persists, check that `C:\Program Files\nodejs\` is in your `PATH`. |
| `running scripts is disabled on this system` (Windows) | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, or use `cmd.exe`. |
| `Unsupported engine` / `SyntaxError` during install or start | Node.js is too old. Install 22.12+ and delete `node_modules` and `package-lock.json` **only if** the reinstall still fails. Then run `npm install` again. |
| `EACCES: permission denied` (Linux) | Never use `sudo npm`. Install Node with nvm, or fix ownership: `sudo chown -R "$USER" ~/.npm "$(pwd)"`. |
| `Port 5173 is already in use` | Another dev server is running. Stop it, or run `npm run dev -- --port 5180`. |
| `Port 5174 is already in use` when running e2e tests | Playwright reuses an already-running server on 5174. Stop stray `vite` processes (`pkill -f vite` on Linux; Task Manager → *Node.js* on Windows). |
| Playwright: `Executable doesn't exist` | Run `npx playwright install chromium` (Linux: add `--with-deps`). |
| Playwright on Linux: missing shared libraries (`libnss3`, `libatk`, …) | `npx playwright install-deps chromium` (needs sudo). |
| Vite prints a `configLoader: 'native'` warning | Harmless. To hide it, set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` (bash: `export …`; PowerShell: `$env:VITE_CONFIG_NATIVE_IGNORE_WARNING="true"`). |
| Very long paths fail on Windows (`ENAMETOOLONG`) | Clone into a short folder such as `C:\dev\NETTOPO`, or enable long paths: `git config --global core.longpaths true`. |
| App starts with an old circuit | Your previous session was restored from autosave. Use **New**, or clear the site data for `localhost:5173` in the browser's settings. |
| PDF export says "Run an analysis first" | The report documents a real solution. Choose a method, complete its configuration and run it, then export. |

---

## Documentation

| Document | Content |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, stores, data flow, invalidation, extensibility |
| [docs/MATHEMATICS.md](docs/MATHEMATICS.md) | Every sign convention and formula, mapped to Chapter 17 |
| [docs/TOPOLOGY.md](docs/TOPOLOGY.md) | Graph and topology engines: algorithms for A, trees, Bf, Qf |
| [docs/SOLVERS.md](docs/SOLVERS.md) | The six solvers, their systems and failure handling |
| [docs/TESTING.md](docs/TESTING.md) | Test strategy and what each suite proves |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | How to use NETTOPO |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | Known limitations |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Planned work |

---

## Reference and licences

* K. S. Suresh Kumar, *Electric Circuits and Networks*, Pearson, Chapter 17
  "Introduction to Network Topology". Section numbers such as §17.5 in the app and
  docs refer to that chapter. The textbook itself is **not** included in this repository.
* Stack: React 19 · TypeScript · Vite · Tailwind CSS v4 + shadcn/ui ·
  @xyflow/react · Zustand · Zod · math.js · KaTeX · jsPDF · Dexie · Vitest ·
  React Testing Library · Playwright.
* The bundled DejaVu fonts (used to print Ω, Σ, → and subscripts in PDF reports)
  are distributed under the licence in `src/assets/fonts/LICENSE-DejaVu.txt`.
