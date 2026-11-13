# F0 · Foundations — design

- **Date:** 2026-11-13
- **Phase:** F0 · Foundations (~7 h), branch `fase-0-cimientos`
- **Status:** approved by the owner on 2026-11-13. This is the English record of the plan approved in the F0 planning session, and it stands in for F0's `brainstorming` step.
- **Project plan:** the owner's Obsidian vault, note `Software/Explorador lidar/Explorador lidar.md` (in Spanish).

## Context

When this design was written, `~/Documents/Proyectos/lidar-explorer` held only the skeleton: the `src/core/` folders, `CLAUDE.md`, the README and the license, with no commits. The vault plan already fixes what gets built: SLAM with noisy odometry in the browser, in phases F0–F8, about 70 h. Its F0 was only 3 h of "repo, CI and Vercel".

Before touching algorithms, the owner wants four things:

1. A working method.
2. An architecture that scales.
3. Clean code and SOLID applied for real.
4. A harness that keeps Claude moving forward in small steps.

The first version of this plan proposed a hand-made harness (custom hooks, commands and reviewer). The **Superpowers** plugin (`obra/superpowers`, from the official marketplace) replaced it, because it already brings the whole process: design, plan, TDD, review and branch closing. This design only adds the project's own layer on top. Sections 2, 3 and 4 did not change with that switch.

**Decisions taken on 2026-11-13:**

- Angular 22, run through `npx`.
- Superpowers installed **in this project only**.
- **Gates:** the owner approves each phase's design and plan. The plan contains the test code, so approving the plan approves the tests. After that, Claude stops **after every task**.
- **No worktrees:** work happens on the phase branch, in the same folder.
- **Languages:** commands and conversation in Spanish; code, docs and plans in the repo in English; the vault stays in Spanish.

**Guiding principle:** Superpowers provides the process. The mechanical guardrails (compiler, lint, architecture test, CI and permissions) provide the limits that do not depend on Claude following instructions.

## 1. Method: the Superpowers cycle in every phase

| Step | Skill | Output | Owner's gate |
|---|---|---|---|
| Design | `brainstorming` | `docs/superpowers/specs/YYYY-MM-DD-fN-<topic>-design.md`, committed | Approves the design, which is presented in parts |
| Plan | `writing-plans` | `docs/superpowers/plans/YYYY-MM-DD-fN-<topic>.md`. Each task lists its files, its interfaces, the failing test's code, the implementation, the commands with their expected output, and the commit | **Approves the plan and, with it, the tests** |
| Execution | `executing-plans` and `test-driven-development` | Each task: red test (seen failing), green, refactor and commit. Progress is kept in the plan's ledger | **After every task:** reviews and tries it. Claude does not continue until the owner says "sigue" |
| Review | Final reviewer: a fresh subagent on the most capable model | Findings ranked by severity; Critical and Important ones get fixed | — |
| Branch close | `finishing-a-development-branch` | Green tests, push, and a PR with a Vercel preview | Chooses PR or merge |
| Phase close (ours) | Checklist in `CLAUDE.md` | Vault note up to date (progress, hours, decisions) and a `Conceptos/` note | Gives the hours and reviews the note |

Two more skills act during any step:

- `systematic-debugging`: every bug is reproduced with a seed and a test before it is fixed.
- `verification-before-completion`: Claude does not call anything done without evidence.

**One phase, one branch** (`fase-N-slug`), one PR. A big phase, such as F3 or F4, is split into two plans. If a session gets long: `/clear` and "continue the plan"; the Superpowers ledger keeps the progress.

**How the earlier hand-made harness maps onto Superpowers:**

- The task card becomes a plan task.
- Its `scope` becomes the task's *Files*.
- Its signatures become the task's *Interfaces*.
- The Definition of Done and the hard rules go into *Global Constraints*.
- The reviewer's checklist goes into *Review Focus*.

## 2. A scalable architecture

Hexagonal architecture (ports and adapters), with the core in pure TypeScript. Compared with the `src/core/` layout in the vault plan, four things change:

- `driver/` holds only ports. `SimDriver` moves to `sim/`, so importing a port never pulls in the simulator.
- New `control/` module: pure pursuit and the safety stop, separate from A*.
- New `autonomy/` module: the behaviours (go to a point in F5, explore in F6, return home).
- New `run/` module: the composition root, which wires world, simulator, autonomy and evaluation together. The UI, the worker and the benchmark use it.

The dependency matrix lives in a single file, `architecture/modules.mjs`. Both the ESLint rule and the architecture test are derived from it.

| Module | May import |
|---|---|
| math | — |
| msgs | math |
| driver (ports) | msgs |
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
| run | all of the above |

**Anti-cheat rule:** the autonomy modules (`mapping`, `localization`, `slam`, `planning`, `control`, `exploration` and `autonomy`) do not import `sim`, `world`, `eval` or `run`. The robot can see neither its true pose nor the true maze. Outside the core, `src/app`, `src/worker` and `bench/` use `run/` and the `msgs` types. Between modules, imports go only through each module's `index.ts`.

**Interfaces only at real seams** (YAGNI):

1. **`driver/`:** `LaserScanSource`, `OdometrySource` and `VelocityCommandSink`, which together form `RobotDriver`. They come with a contract test suite that every driver must pass.
2. **`eval/`:** `GroundTruthSource`, with the true pose and the true map. Only `eval` and `run` receive it.
3. **`math/`:** a seeded `Rng` with `fork('lidar')`, which gives each subsystem an independent stream. One extra random draw in one subsystem then does not break the regression tests of the others.
4. **App:** `SimulationPort` (an `InjectionToken`), with a main-thread adapter for F1–F7 and a Web Worker adapter for F8.
5. **F7:** `BenchResultsRepository`, with a Supabase implementation and a local JSON one.

An algorithm (a resampler, a sensor model…) gets an interface only when its second implementation appears.

**Per-tick loop, with a fixed `dt`:**

1. `sim.step(twist)` produces a `LaserScan` and an `Odometry`.
2. `autonomy.tick()` goes through SLAM, behaviour, planner and control, and returns a `Twist`.
3. `eval` compares the truth with what the robot believes.
4. `run.snapshot()` returns plain data and typed arrays for the UI and the worker.

**Angular 22 app:** standalone, zoneless, signals, OnPush and `inject()`.

- `app/core/`: ports and adapters.
- `app/features/explorer/`: the page, controls, metrics and `render/`, with pure functions of the form `drawX(ctx, snapshot, viewport)`.
- `app/features/results/`: the results panel (F7).

Components are thin and carry no robotics logic.

## 3. Clean code and SOLID, each with its guardian

| Principle | How it applies here | Guardian |
|---|---|---|
| S | One responsibility per module and per class: `OccupancyGrid`, `GridMapper` and ray tracing are separate | `max-lines` and the reviewer |
| O | Extension through new implementations of a port, without touching `autonomy` | Dependency matrix |
| L | Every `RobotDriver` passes the same contract suite | Contract tests |
| I | Small ports: SLAM only sees scans and odometry | Types and the anti-cheat rule |
| D | `autonomy` depends on ports; the concrete pieces are created in `run/` | Architecture test |
| KISS / DRY / YAGNI | Interfaces only at the seams above | Reviewer |
| Clean functions | At most 40 lines, at most 4 parameters (otherwise an options object), cyclomatic complexity at most 10, no boolean flags | ESLint |
| No magic numbers | Every tunable lives in an `XxxConfig` with a default, a unit and a source | Reviewer |
| Immutability | `readonly` messages; state lives only in classes with invariants | ESLint and the reviewer |

**Conventions** (`docs/conventions.md`):

- **Units:** SI throughout the core. Anything non-SI carries a unit suffix, such as `angleDeg`.
- **Frames:** ROS frames (REP-103).
- **Angles:** always in (−π, π], averaged circularly.
- **Screen:** the canvas y-axis is flipped only in the renderer.
- **Grid:** stored row-major, like the ROS `OccupancyGrid`.
- **Errors:** `assert` for invariants; for expected failures, a result such as `{ ok: false, reason: 'unreachable' }`.
- **Names:** kebab-case files and no `I` prefix on types.
- **Comments:** they explain the why, with a reference.

## 4. Foundations that keep it from failing

- **Compiler:** `strict` and `noUncheckedIndexedAccess`. `tsconfig.core.json` loads neither the DOM nor the Node libraries, so `document` or `process` in the core do not compile. Core tests use `tsconfig.core.spec.json`.
- **ESLint:** typescript-eslint `strictTypeChecked` and angular-eslint, plus the clean-code limits.
  - In the core, `Math.random`, `Date`, `performance`, `console`, timers and browser globals are banned.
  - The core runs with `noInlineConfig`, so a rule cannot be silenced with `eslint-disable`. `@ts-ignore` is banned too.
- **Architecture:** `architecture/architecture.spec.ts` reads the imports with the TypeScript compiler API and checks the matrix, the anti-cheat rule, that there are no cycles, and that every cross-module import goes through `index.ts`. It carries fixtures that prove each rule fires.
- **Tests:**
  - Vitest in Node for the core, with a minimum coverage of 90 %.
  - `fast-check` for invariants.
  - Regression tests with fixed seeds.
  - `ng test` only for the Angular layer.
- **Determinism:** a seeded RNG with `fork`, a fixed `dt`, no real clock in the core, and `?seed=42` in the URL.
- **Reproducible environment:** `.nvmrc` and `engines` in `package.json`, and `.npmrc` with `save-exact`. A new dependency only gets in with the owner's approval.
- **CI and deployment:** GitHub Actions runs `verify` on every PR. `main` is protected: changes enter only through a PR with green CI. Every PR gets a Vercel preview.

## 5. Harness: Superpowers plus the project layer

**Installation:** project scope only. `enabledPlugins` lives in `lidar-explorer/.claude/settings.json`, so the owner's vault sessions do not load it. The plugin brings a single hook, `SessionStart`, which loads its rules (`using-superpowers`) and works on Linux and Windows. It has to be approved the first time.

**What we use from Superpowers:**

- `brainstorming`, `writing-plans`, `executing-plans` and `test-driven-development`.
- `systematic-debugging` and `verification-before-completion`.
- `requesting-code-review`, `receiving-code-review` and `finishing-a-development-branch`.

`subagent-driven-development` and `using-git-worktrees` are not used, because of the decisions above.

**Why our rules work:** the Superpowers base skill says *"User instructions (CLAUDE.md…) take precedence over skills"*. That is why everything project-specific goes in `CLAUDE.md`.

**The project layer, the only thing we build:**

1. **`CLAUDE.md`, section "Superpowers overrides":**
   - Execute inline with `executing-plans`; `subagent-driven-development` only if the owner asks for it.
   - **Stop after each task's commit.** Claude says what changed and how to see it, gives a 3-line explanation and an interview question, and waits for the owner's "sigue". This overrides Superpowers' *"do not pause between tasks"*.
   - **No worktrees.** Work happens on the `fase-N-slug` branch, never on `main`.
   - Plans and designs go in the Superpowers default paths.
   - **Pre-approved TDD exceptions:** scaffolding and configuration files. For a guardrail, the "red test" is a planted violation that must fail; then it is removed.
   - A guardrail (lint rule, tsconfig, coverage threshold, dependency matrix) is never relaxed to get green. If one blocks, Claude stops and explains.
   - Phase-close checklist. First, update the vault note: progress, hours (Claude asks for them), decisions and status. Then write with the owner the `Conceptos/` note: a software analogy, the key idea and 3 interview questions.
2. **Fixed blocks that `writing-plans` copies into every plan:**
   - *Global Constraints:* the hard rules (anti-cheat, seeds, headless core, units and frames, ROS 2-shaped messages, allowed seams, no unapproved dependency) and the Definition of Done (`verify` green, TSDoc on the public API, coverage, a conventional commit with the co-author trailer).
   - *Review Focus:* the SOLID and clean-code checklist from `docs/conventions.md`, tests that assert behaviour and not implementation, explicit seeds, property tests for invariants, the matrix and the scope.
3. **`.claude/settings.json` (in git):** `enabledPlugins` and permissions.
   - **Allowed without asking:** `npm run *`, `git status`, `diff`, `log`, `show`, `add`, `commit`, `switch` and `branch`, and `npx ng generate`.
   - **Asks first:** `npm install`, `git push`, `git merge` and `gh pr`.
   - **Denied:** `git push --force`, `git reset --hard`, `rm -rf`, and reading or editing `.env*`.
   - As built, `rm -rf` asks first instead of being denied.
   - At the end of F0, editing the guardrails also asks first: `eslint.config.js`, `tsconfig*.json`, `vitest*.config.ts`, `architecture/**`, `.github/**`, `.claude/**` and `package.json`.
4. **`.claude/settings.local.json` (outside git, one per machine):** `additionalDirectories` with the vault folder, so repo sessions can read the plan and update the note.

**What is no longer built:** custom hooks, custom commands, a custom reviewer subagent, a status line, `defaultMode: plan`, custom task cards and ADRs. The Superpowers plans, designs, ledger and reviewer replace them. If the F0 trial shows a real gap, for example commits with red tests, only the hook that covers that gap gets added.

## 6. Execution: F0 · Foundations (~7 h, branch `fase-0-cimientos`)

**In the planning session, right after approval (done on 2026-11-13):**

0. **Update the vault note.** Decisions:
   - Angular 22.
   - Superpowers as the harness, installed in the project only, stopping after every task and without worktrees.
   - F0 grows from 3 to 7 h, the total becomes about 74 h, and the calendar slips one week.
   - Tracking is split: designs, plans and their ledger in the repo; progress, hours, decisions and concepts in the vault.
   - The new modules `control`, `autonomy` and `run`, and `driver/` with ports only.
   - Section 6 of the note points to the repo's `CLAUDE.md`.
1. **Prepare the repo:**
   - Initial skeleton commit on `main`. It is the only direct commit to `main`; then the branch `fase-0-cimientos` is created.
   - Rewrite `CLAUDE.md`: shorter, with the hard rules and the overrides section.
   - Create `.claude/settings.json` with the base permissions and `.claude/settings.local.json` with access to the vault.
   - Install Superpowers in the repo with project scope.
   - Save this plan, in English, as the F0 design in `docs/superpowers/specs/2026-11-13-f0-foundations-design.md`. It counts as F0's `brainstorming`, because the design is already approved.
   - Commit.

**In a new session opened in `~/Documents/Proyectos/lidar-explorer`** (the owner approves the Superpowers hook):

2. **`writing-plans`** produces `docs/superpowers/plans/2026-11-13-f0-foundations.md` with these tasks, and the owner approves it:
   1. **Toolchain.**
      - Check whether Angular 22 supports Node 26; if not, Node 24 LTS with `fnm`.
      - `.nvmrc`, `engines` and `.npmrc`.
      - `ng new` in a temporary folder (SCSS, no SSR, no AI files) and merge it in. On conflicts, our README, `CLAUDE.md` and `.gitignore` win.
      - Prettier.
      - ✓ `npm start` and `npm run build`.
   2. **Strict typing and ESLint:** tsconfigs, `ng add angular-eslint`, and the clean-code and core blocks.
      - ✓ Planted violations fail.
   3. **Tests:** `vitest.core.config.ts` in Node with coverage thresholds, `fast-check`, and `ng test` limited to `src/app`.
      - First real TDD: `math/angle.ts` (`normalizeAngle`, `angleDiff`).
      - Scripts: `test`, `test:core`, `test:app`, `typecheck`, `lint`, `format:check`, `verify:fast` and `verify`.
   4. **Architecture guardrails:** `architecture/modules.mjs`, from which the ESLint rule and `architecture.spec.ts`, with its fixtures, are derived.
      - ✓ A planted `import … from '../sim'` in `slam/` is caught by both.
   5. **Documentation:** `docs/architecture.md`, `docs/conventions.md`, `src/core/CLAUDE.md`, `src/app/CLAUDE.md`, and the README with a "How it's built" section.
   6. **CI:** `.github/workflows/ci.yml` and the README badge.
      - Done by the owner:
        - install `github-cli` and run `gh auth login`;
        - create the public repo;
        - connect Vercel (output `dist/lidar-explorer/browser`);
        - protect `main`.
   7. **`Pose2D`:** `compose`, `inverse` and `relative`, with property tests. It is the first domain task, and F1 needs it for odometry.
   8. **Close the guardrails:** add the permissions that ask before the configs are edited.
3. **`executing-plans`** runs the plan, stopping after every task.
4. **Final review and `finishing-a-development-branch`:** PR, green CI, Vercel preview and merge.
5. **Phase close:** the vault note is brought up to date, and the status becomes "F1, to be designed with `brainstorming`".

## 7. Verification

1. `npm run verify` is green locally and in CI, and the Vercel preview loads.
2. **Guardrail proofs.** Each one is planted, seen to fail, and reverted:
   - an import of `sim` from `slam`;
   - `Math.random()` in the core;
   - a `// eslint-disable` in the core;
   - `document` in the core;
   - a 60-line function;
   - coverage below the threshold.
3. **Superpowers and the project layer:**
   - **Loading:** in a repo session, Superpowers is loaded (its startup shows and its skills are used). In a vault session, it is not.
   - **Plan:** the F0 plan is in `docs/superpowers/plans/`, with each task's red test and our *Global Constraints* and *Review Focus* blocks.
   - **Execution:**
     - In every code task, the test is seen failing before the implementation.
     - Claude stops after every task with its explanation and its question.
     - No worktree is created, and commits go only to `fase-0-cimientos`.
   - **Close:** the final reviewer runs, and `finishing-a-development-branch` offers the PR.
   - **Permissions:** once the guardrails are closed, editing `eslint.config.js` asks for permission, and `git push --force` and reading `.env` stay denied.

## Critical files

- **Repo** (`~/Documents/Proyectos/lidar-explorer`):
  - `CLAUDE.md`, rewritten with the overrides.
  - `.claude/settings.json` and `.claude/settings.local.json`.
  - `docs/superpowers/specs/2026-11-13-f0-foundations-design.md` (this file) and `docs/superpowers/plans/2026-11-13-f0-foundations.md`.
  - `docs/architecture.md` and `docs/conventions.md`.
  - `package.json`, `angular.json`, `tsconfig*.json`, `eslint.config.js`, `vitest.core.config.ts`, `architecture/*`, `src/core/math/*` and `.github/workflows/ci.yml`.
- **Vault:** `Software/Explorador lidar/Explorador lidar.md`.
- **Reused:** the Angular conventions from the owner's LigaVerano project (`~/Documents/Proyectos/LigaVerano/CLAUDE.md`).

## Risks

- **Superpowers does not stop between tasks despite `CLAUDE.md`:** strengthen the override's wording. The skill itself says the user's instructions win. This gets checked in F0.
- **A plugin update changes its behaviour:** today the marketplace pins Superpowers 7.0.2 at commit `22f0b46`. Note the version in the vault, and turn off auto-update if it causes trouble.
- **Angular 22 without Node 26 support:** use Node 24 LTS.
- **Cost:** the final reviewer is a subagent on the most capable model, but it runs only once per phase.
- **Over-engineering:** the modules and the seams are fixed here.
