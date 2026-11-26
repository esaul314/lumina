# 📜 Lumina Coding Style, Conventions & Philosophy

Welcome, developer or AI agent! This codebase is governed by a strict set of architectural philosophies, coding standards, and operational behaviors. Every contribution you make must strictly adhere to these principles to maintain Lumina's extreme efficiency, reliability, and beauty.

---

## 🌌 The Scout Rule (Core Directive)
> **"Always try to leave the codebase better than it was before."**

Every time you modify a file, run a test, or implement a feature, identify at least one small way to leave the surrounding code cleaner, more robust, or better documented. In addition:
* **Immediate Fixes**: If you identify a defect or a design flaw in the course of your work, and the fix is simple and quick, perform the fix immediately.
* **Tech Debt Logging**: If the fix is complex or requires extensive architectural changes, do not let it pass silently; document it explicitly in the **Tech Debt / Backlog** section in the documentation.
* **General Cleanup**: Improve comments, add typing guards, eliminate redundant variables, or standardise spelling normalizations wherever possible.

The improvement record is part of the product: journal new generic lessons and
update the roadmap for changed direction, risks or milestone acceptance. Link
supporting evidence, not duplicate result histories. Functional clarity, explicit
effects and teachable composition are requirements in their own right.

---

## 🧭 The Nine Maxims

### 1. Extensible & Trouble-free Maintenance
The codebase must be easy to modify and troubleshoot. Follow best practices for writing *Clean Code*:
* Leverage modern language features (e.g., JS ES6+, async/await, optional chaining, array methods) to keep logic clean and require fewer tokens to grasp and update.
* Avoid convoluted control flows. Keep functions focused on a single responsibility.
* Write informative logging that exposes *just enough* telemetry to trace errors without flooding standard output.

### 2. Declarative & Functional Over Imperative
Always prefer declarative and functional programming styles to imperative loops and mutable state:
* Avoid writing traditional `for` or `while` loops when `map`, `filter`, `reduce`, `every`, `some`, or `find` can do the job more clearly.
* Use pure functions where possible to make operations predictable and easy to unit test.
* Consider functional utility libraries (e.g. `lodash/fp` or `ramda`) if complex transformations are needed, but only if they produce more elegant, readable, and compact code than standard ES6 functional methods.

### 3. Smart Library Selection
Before writing complex custom helper functions or widgets:
* Research and consider if there is a sufficiently mature, lightweight, and actively maintained library available that solves the problem.
* Balance library imports against our strict resource constraints (e.g. keep memory under 80MB on the client). Avoid heavy, bloated NPM imports that introduce security risks or high CPU load.

### 4. SOLID Design & Small Commits
* **Single Responsibility Principle (SRP)**: Keep classes, modules, and files small and dedicated to a single concern.
* **Open/Closed Principle (OCP)**: Design modules to be open for extension but closed for modification.
* **Liskov Substitution Principle (LSP)**: Maintain interface consistency across subclasses or mock equivalents.
* **Interface Segregation Principle (ISP)**: Avoid bloated interfaces; break them into smaller, client-specific contracts.
* **Dependency Inversion Principle (DIP)**: Depend on abstractions (interfaces) rather than concrete implementations.
* **Commit Boundaries**: Keep files from growing too large. Commits should ideally contain **no more than 4 files and 300 Lines of Code (LOC)** to ensure they are readable and easily reviewable.

### 5. Continuous & Automated Testing
* Write comprehensive tests for *every* substantive change you make.
* Ensure both unit-level behavior (such as keyword tagging and selectors) and API endpoints are covered.
* Required regression checks must pass before accepting or committing code; reuse exact-candidate evidence under the verification policy below, never a known failure.

### 6. Zero Private Information Leaks
* Maintain absolute privacy and security.
* Double-check that no API keys, credentials, local paths, emails, personal coordinates, or private configurations are ever committed to version control.
* Use environment variables via `process.env` (configured through `.env` files, which must remain in `.gitignore`) for all external service integrations.

### 7. Anti-Overengineering Mandate
* Similarly to the Scout Rule, proactively work to reduce complexity in existing structures.
* Any proposed increase in complexity (e.g., introducing a new database, state manager, or orchestration layer) must be thoroughly justified, with alternative options researched and documented first.
* Keep solutions as simple, direct, and readable as possible.

### 8. Well-Known Architectural Patterns
* Maintain clear and standard boundaries between frontend and backend, state layers, controllers, and utility files.
* Use modular folders and common layout files. Be prepared for expanding the application to support new features, widgets, or smart integrations in the future.

### 9. Documentation First
* Keep all documentation, including `AGENTS.md` and inline comments, accurate and up-to-date.
* When changing a system behavior or adding an endpoint, immediately reflect the change in the developer guides to make it seamless for the next AI agent or developer to proceed.

---

## Interaction design and progressive disclosure

Design the common journey before the exceptional action: establish interaction
frequency, visual hierarchy and the compact default before implementing controls.
Occasional editing should not dominate browsing. Use discoverable progressive
disclosure with visible saved/draft/error cues, accessible focus and no silent
loss of work. Review both compact and expanded layouts on narrow screens and
portrait pairs, not just functional success. Record rationale and acceptance in
the product roadmap; tests alone do not establish a good interaction design.

## Roadmap and complexity discipline

Roadmaps own design; Beads owns only the commissioned queue. Fila retains scope
and acceptance; Git/tests/reviews prove results.

1. **One owner per truth.** `ROADMAP.md` owns product priorities/feedback/deferrals;
   `FUNCTIONAL_REFACTOR_ROADMAP.md` owns engineering direction/milestones.
   Beads owns queue state/dependencies/claims. Keep one acceptance record linked
   to tests/review/commits; indexes and memory point there. Journal generic lessons
   in `DEVELOPER_LOG.md`, private setup/recovery in ignored agent notes.
2. **Commission once.** Ground scope/exclusions; create meaningful outcomes,
   acceptance, priorities, real prerequisites and native owner/spec links under
   one batch label. Prefer native graph import; independent-task Markdown remains
   valid. Verify returned IDs/graph; inspect unknown writes, never replay blindly.
   Don't import the backlog, taskify trivial actions or invent dependencies.
3. **Resume, then select.** Recover scoped in-progress issues and actual native
   runs/results before claiming. New work uses batch/type-scoped atomic
   `ready --claim`, one result; its full brief needs no separate show/ready cycle.
   Explicit user order/exclusions outrank sorting: narrow eligible selection,
   not fake edges. Expired leases/empty ready lists prove neither stopped work
   nor completion. Renew only verified work; no automatic reclaim.
4. **One capable executor.** Prefer direct execution; delegate implementation for
   concrete isolation, continuity, parallelism or capability benefit, not relay.
   One active writer per checkout; independent review is read-only. Fila alone
   writes Beads and accepts results. Native sessions own execution/results;
   background progress requires an authorized native continuation. Follow the
   owner/spec link; update it for real handoffs/broken links, not phase notes.
   Claims aren't process liveness or authority to overlap writers.
5. **Reconcile changes.** Put discoveries/feedback in their existing roadmap
   location with rationale, scope impact and acceptance; merge duplicates and
   distinguish proposals/deferrals. Update affected briefs/dependencies before
   dispatch. Revisit changed sections, not full history every step; reconcile at
   a safe boundary without silently preempting work or expanding scope.
6. **Accept and close.** Rejections stay open through repair, required checks and
   independent review. After exact-candidate acceptance and scoped commit, normal
   `close --suggest-next` uses explicit ID/evidence links; suggestions don't
   authorize outside work, and the next claim stays batch-scoped. Never use
   `batch close`, forced closure or unfiltered `close --claim-next`. Verify all
   selected outcomes, backup and task-owned cleanup; stop their continuations.
   Empty ready is neither completion nor another commission.
7. **Capture once, budget honestly.** Issue plus linked evidence satisfy per-step
   continuity. Roadmaps capture decisions/risks/milestones; journals new learning.
   Report commit subject, roadmap movement, result and next action, not copied
   histories. Use native scoped counts and lint new/changed briefs once; inspect
   warnings even at exit0, and don't mistake field presence for acceptance.
   Reuse the existing harness/gauge and normal receipts to assess coordination;
   no invented ROI, monitoring framework, controller, watcher or shadow ledger.
   New machinery needs a concrete unmet need, simpler alternative, owner, tests
   and rollback. Keep one orchestrator/checkout/store; tiny linear work can omit
   Beads. Simplify or retire it if administration exceeds the work it removes.

### Execution and handoff

First dispatch includes the full standing coding prompt, brief, baseline and
execution/publication limits. In the same retained session, send only the new
brief, baseline and changed constraints when continuity and unchanged rules/scope
are verified. New/reset sessions, missing context or uncertain/changed rules
require full grounding again. A session label isn't continuity proof. Shorter
follow-ups never weaken coding standards or Fila's acceptance authority.

### Candidate verification

Start contract work with unsafe consumers in the existing fixtures: raw mutable
projections, grouped discriminants and inferred extra fields must not gain false
canonical guarantees. Keep untrusted values unknown; improve coherent
producer/consumer seams, not every helper or a diagnostic-count target.

Bind checks to the exact candidate (commit plus diff), runtime, dependencies and
relevant test/config inputs. Reuse its passing full-suite/lint result across
handoffs; a turn ending or new reviewer alone doesn't require another run.
Fila inspects the complete diff/binding; independent review adds adversarial
probes, not a duplicate workflow. Repairs rerun affected checks and required
full-suite gates on the revised candidate; preserve rejected evidence. Relevant
input changes, failures or uncertain coverage invalidate evidence. Matching task
IDs alone never justify reuse.

For capture/verification, use the stdlib [candidate-evidence helper](./docs/DEVELOPMENT_EVIDENCE.md)
instead of rebuilding file-hash scripts. It binds inputs, not acceptance; retain
check logs and independent review. Prefer coherent risk-based review boundaries,
not one review per commit or a duplicate full-suite run per handoff.

Documentation-only edits may reuse accepted application checks after verifying
unchanged executable/test/config inputs and that changed documents aren't
test/build inputs; validate diff, links and instruction consistency instead.
Release, live rollback, physical-device and security gates remain unchanged.

## 🤖 Mandatory AI Agent Behaviors

As an AI agent, you must execute the following procedures without exception:
1. **Atomic & Structured Commits**: Commit changes continuously as separate logical steps rather than doing a massive single commit at the end.
2. **Hardened Error Boundaries**: Wrap OS integrations, system-level execution calls (DBus, pactl, CPU governor commands), and file reads/writes in robust `try/catch` handlers with fail-safes.
3. **No Infinite Loops**: Never allow skips, state transitions, or socket synchronizations to trigger recursively without rate limits or counter bounds.
4. **Pre-flight Check**: Follow [candidate verification](#candidate-verification); required checks must cover the candidate, not merely a previous task result.
5. **No Local Chromium Installations**: Under no circumstances should you attempt to install Chromium, Playwright browser binaries, or system browser dependencies on the local gateway host `filament`. Lumina runs on the dedicated Fedora host named `playwright` (IP `192.168.0.178`), which already has system Chromium installed and configured.
6. **Stop and Ask If Lost**: If you suspect you are lost, encounter an environmental mismatch, or feel any ambiguity about your execution location, you **must stop immediately and ask Alex for clarification**. Do not proceed with high-risk assumptions.
7. **Do Not Run Deployment / Backup Scripts Through an Active Mount**: When this workspace is mounted directly from the target host, edits already apply there. Do not run copy, sync, or backup scripts that duplicate project files; they can corrupt the mount or overwrite live configuration.
