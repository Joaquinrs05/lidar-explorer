# lidar-explorer — Instructions for agents

## What this is

A simulated differential-drive robot explores an unknown maze with a 2D lidar and noisy odometry, building the map while it localizes itself (SLAM). Everything runs in the browser. It is a portfolio project.

**The Council's condition:** the robot must localize with *noisy* odometry. If the map is built from the simulator's true pose, it is mapping, not SLAM, and the project loses its value. The architecture and the guardrails below exist to protect that.

## Where things live

- **Phase designs and plans:** `docs/superpowers/specs/` and `docs/superpowers/plans/`, the Superpowers defaults.
- **Architecture and conventions:** `docs/architecture.md` and `docs/conventions.md`. The F0 design behind them is `docs/superpowers/specs/2026-11-13-f0-foundations-design.md`.
- **Project plan, phase progress, hours and decisions:** the owner's Obsidian vault, note `Software/Explorador lidar/Explorador lidar.md` (vault root `~/Documents/ObsidianVault`). Each machine grants access to that folder in `.claude/settings.local.json`. Vault notes are in Spanish.
- **Language:** talk to the owner in Spanish. Code, comments, commits, plans and repo docs are in English.

## Stack

- Angular 22: standalone, zoneless, signals, OnPush, `inject()`. Drawing in Canvas 2D.
- Core in pure TypeScript under `src/core/`: no Angular, no DOM, no Node APIs. It runs unchanged in the browser, in a Web Worker and in Node.
- Vitest and fast-check. ESLint with typescript-eslint `strictTypeChecked` and angular-eslint.
- Supabase only for the benchmark history (F7). Hosting on Vercel. GitHub `Joaquinrs05/lidar-explorer`, public, MIT.

## Core modules and allowed dependencies

| Module | May import |
|---|---|
| math | — |
| msgs | math |
| driver (ports only) | msgs |
| world | math |
| sim | math, msgs, world, driver |
| mapping | math, msgs |
| localization | math, msgs, mapping |
| slam | math, msgs, mapping, localization |
| planning | math, msgs, mapping |
| control | math, msgs |
| exploration | math, msgs, mapping, planning |
| autonomy | math, msgs, driver, slam, planning, control, exploration |
| eval | math, msgs, world, mapping |
| run | everything above (composition root) |

`src/app`, `src/worker` and `bench/` use `run/` plus the `msgs` types. A module is imported only through its `index.ts`. The matrix lives in `architecture/modules.mjs` (created in F0), and both ESLint and an architecture test enforce it.

## Hard rules

1. **Anti-cheat.** The autonomy modules (`mapping`, `localization`, `slam`, `planning`, `control`, `exploration`, `autonomy`) never import `sim`, `world`, `eval` or `run`. The robot never sees the true pose or the true maze.
2. **Seed everything.** No `Math.random()` in `src/core/`. Use the seeded `Rng` from `math/` and `fork()` one stream per subsystem. The same seed gives the same run (`?seed=42`).
3. **Headless core.** No DOM, no timers, no wall clock and no `console` in `src/core/`. The time step `dt` is fixed. The UI only renders snapshots.
4. **Units and frames.**
   - SI units everywhere in the core. Anything non-SI carries a unit suffix, such as `angleDeg`.
   - Frames follow ROS REP-103.
   - Angles are normalized to (−π, π] and averaged circularly.
   - The canvas y-flip happens only in the renderer.
5. **ROS 2-shaped messages** in `msgs/`: `LaserScan`, `Odometry`, `OccupancyGrid`, `Twist`, `PoseArray`, `Path`.
6. **Interfaces only at real seams:** the driver ports, `GroundTruthSource`, `Rng`, `SimulationPort` and `BenchResultsRepository`. Any other abstraction waits for its second implementation.
7. **No new dependency** without the owner's approval.
8. **Never weaken a guardrail** to get green: a lint rule, tsconfig strictness, a coverage threshold, the dependency matrix or CI. If one blocks you, stop and explain.
9. **Lidar parameters** come from the RPLIDAR C1 datasheet. Verify them; never guess.

## Superpowers overrides

These are the owner's instructions. They take precedence over the Superpowers skills.

- **Cycle per phase:** `brainstorming` → design doc → `writing-plans` → plan → `executing-plans` → final review → `finishing-a-development-branch`. One phase is one branch (`fase-N-slug`) and one PR to `main`. Split big phases (F3, F4) into two plans.
- **Execute inline with `executing-plans`.** Do not use `subagent-driven-development` unless the owner asks for it.
- **Stop after every task.** After each task's commit, stop and report to the owner, in Spanish:
  - what changed;
  - how to see it (a command or a screen);
  - a 3-line explanation the owner could give in an interview;
  - one interview question about it.

  Then wait for the owner's "sigue" before starting the next task. This overrides "do not pause between tasks".
- **No worktrees.** Work in place on the phase branch. Never commit to `main`.
- **Pre-approved TDD exceptions:** scaffolding and configuration files. For a guardrail, the failing test is a planted violation that must fail; then remove it.
- **Every plan copies the two blocks below** into its *Global Constraints* and *Review Focus* sections.
- **Debugging:** reproduce every bug with a fixed seed and a failing test before fixing it.

### Global Constraints (copy into every plan)

- Hard rules 1–9 above.
- **Definition of Done for each task:**
  - tests written first and seen failing;
  - `npm run verify` green, once it exists;
  - TSDoc on every export of a module's `index.ts`;
  - the core coverage threshold met;
  - one conventional commit, `type(scope): summary`, where the scope is the module, with a `Co-Authored-By` trailer.
- **Clean code limits enforced by ESLint:** functions of at most 40 lines, at most 4 parameters (otherwise an options object) and cyclomatic complexity of at most 10.

### Review Focus (copy into every plan)

- **SOLID and clean code:**
  - one responsibility per module and per class;
  - extension through ports, not edits to `autonomy`;
  - no speculative interfaces and no duplicated logic;
  - no boolean flag parameters;
  - no magic numbers: tunables live in an `XxxConfig` with a default, a unit and a source;
  - readonly messages, and state only in classes with invariants;
  - names from the domain.
- **Tests:** they assert behaviour, not implementation. Seeds are explicit. Invariants get property-based tests (fast-check). Ports get contract tests.
- **Dependencies:** the matrix and the anti-cheat rule hold, and nothing is imported past a module's `index.ts`.
- **Scope:** nothing outside the task's files unless a ruling is recorded and explained.

## Closing a phase

After `finishing-a-development-branch`:
1. Update the vault note:
   - tick the phase under *Progreso*;
   - add the hours to *Registro de horas* (ask the owner for them);
   - add the decisions to *Decisiones*;
   - update *Estado*.
2. Write with the owner a short concept note, in Spanish, in `Software/Explorador lidar/Conceptos/`: a software analogy, the key idea and 3 interview questions. Never create these notes in advance.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Dev server on http://localhost:4200 |
| `npm run build` | Production build into `dist/lidar-explorer/browser` |
| `npm test` | Core tests, then app tests |
| `npm run test:core` | Vitest in Node for `src/core`, with the 90 % coverage gate |
| `npm run test:app` | `ng test` (Vitest with jsdom) for `src/app` |
| `npm run typecheck` | `tsc` on the app, app-spec, core, core-spec and tools projects |
| `npm run lint` | ESLint over the repo; any warning fails |
| `npm run format` | Prettier writes the formatting |
| `npm run format:check` | Prettier checks the formatting |
| `npm run verify:fast` | `typecheck`, `lint` and `test:core` |
| `npm run verify` | `format:check`, `verify:fast`, `test:app` and `build`; CI runs this |

`npm run bench` comes later, in F7.
