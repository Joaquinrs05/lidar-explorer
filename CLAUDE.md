# lidar-explorer — Instructions for agents

## What this is

A simulated differential-drive robot explores an unknown maze using a 2D lidar and noisy odometry, building a map while localizing itself (SLAM). Everything runs in the browser. It is a portfolio project, not a coursework one.

**The Council's condition:** the robot must localize with *noisy* odometry. If the map is built from the simulator's true pose it is mapping, not SLAM, and the project loses its value. Everything below protects that.

## Where the plan lives

Plan, phases, progress checklist, hours log and decisions are in the Obsidian vault, not in this repo:
`Software/Explorador lidar/Explorador lidar.md` (vault root: `~/Documents/ObsidianVault`).

- **At the start of a session:** read that note (current phase and next task) and this file.
- **At the end:** tick the checkboxes under *Progreso*, add the hours to *Registro de horas* and any decision to *Decisiones*.
- Vault notes are in Spanish. Code, comments, commits and this repo's docs are in English.

## Stack

- Angular (standalone components, signals), Canvas 2D for drawing. No Three.js: it is 2D.
- TypeScript `strict`. No `any`, no `as unknown`.
- Core in pure TypeScript under `src/core/`: no Angular, no DOM. It must run unchanged in a Web Worker and in Node (benchmark).
- Vitest for tests, ESLint, Prettier.
- Supabase (Postgres + RLS) only for the benchmark history. The demo must work without it.
- Hosting: Vercel. Repo: GitHub `Joaquinrs05/lidar-explorer`, public, MIT.

## Layout

```
src/core/        pure TS, no Angular/DOM
  math/          seeded RNG, angle helpers, Pose2D
  msgs/          ROS 2-shaped types: LaserScan, Odometry, OccupancyGrid, Twist, PoseArray, Path
  world/         seeded maze generator (rooms + openings) and a few hand-made maps
  sim/           differential robot, raycast lidar with noise, noisy odometry, collisions
  driver/        RobotDriver interface and SimDriver (a real driver plugs in here later)
  mapping/       log-odds occupancy grid, Bresenham
  localization/  particle filter: odometry motion model, likelihood field, low-variance resampling
  slam/          ties mapping and localization together
  planning/      obstacle inflation, A* (8 neighbours), pure pursuit, safety stop
  exploration/   frontiers, goal selection, unreachable blacklist, state machine
  eval/          metrics against ground truth
src/app/         Angular UI
src/worker/      Web Worker wrapper around the core
bench/           Node benchmark: 3 sizes x 10 seeds, headless
supabase/        SQL migrations for `bench_runs`
```

Data flow: `SimDriver` → (LaserScan + Odometry) → `slam` → (map + pose) → `exploration` → (goal) → `planning` (A*) → (path) → control → (Twist) → `SimDriver`. The true pose goes only to `eval/` and to the "ground truth" layer of the UI.

## Hard rules

1. **Anti-cheat.** `slam/`, `localization/`, `mapping/`, `planning/` and `exploration/` must never import from `sim/`. Enforced by an ESLint rule and a CI test. Do not weaken either to make something compile; fix the dependency.
2. **Seed everything.** Same seed, same run: maze, noise, particles, all of it. Never call `Math.random()` in `src/core/`; use the seeded RNG from `math/`. A run must be reproducible from `?seed=42`.
3. **Headless first.** The core does not know a UI exists. The UI only renders snapshots.
4. **ROS 2-shaped messages.** Keep `msgs/` field names and semantics aligned with ROS 2 so the same panel can later serve a real robot or a ROS 2 bridge.
5. **Three map modes in the UI:** "True pose (reference)", "Pure odometry" and "SLAM" (the default). The reference mode must be labelled as reference, never as SLAM.
6. **Lidar parameters come from the RPLIDAR C1 datasheet.** Verify against the datasheet before hardcoding; do not guess.
7. **Tests before "done".** Each phase has acceptance tests in the plan. A phase is not finished until they pass in CI.

## Working style

- One phase, one branch (e.g. `fase-3-mcl`), one PR to `main`. Do not commit directly to `main`.
- Commits carry the Claude co-author trailer, so AI authorship is declared. The README says so too.
- Claude writes most of the code; the owner decides and tests. The owner must be able to explain every part, so keep the code readable and, when a phase closes, help write the short concept note in the vault (`Conceptos/`: a software analogy, the key idea, 3 interview questions). Never create those notes empty in advance.
- If a phase goes over its hours by more than 50 %, stop and re-plan instead of pushing on.
- Out of scope for v1: loop closure, per-particle maps (GMapping-style), global localization / kidnapped robot, a maze editor, real hardware, a ROS 2 bridge. Do not add them unasked.
- The owner creates the Supabase project and connects Vercel (they need the account). Never put the Supabase service key in the frontend.

## Commands

Not created yet; they arrive with phase F0. Expected set: `npm start`, `npm test`, `npm run lint`, `npm run build`, `npm run bench`. Update this section when they exist.
