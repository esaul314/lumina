# 📜 Lumina Coding Style, Conventions & Philosophy

Welcome, developer or AI agent! This codebase is governed by a strict set of architectural philosophies, coding standards, and operational behaviors. Every contribution you make must strictly adhere to these principles to maintain Lumina's extreme efficiency, reliability, and beauty.

---

## 🌌 The Scout Rule (Core Directive)
> **"Always try to leave the codebase better than it was before."**

Every time you modify a file, run a test, or implement a feature, identify at least one small way to leave the surrounding code cleaner, more robust, or better documented. In addition:
* **Immediate Fixes**: If you identify a defect or a design flaw in the course of your work, and the fix is simple and quick, perform the fix immediately.
* **Tech Debt Logging**: If the fix is complex or requires extensive architectural changes, do not let it pass silently; document it explicitly in the **Tech Debt / Backlog** section in the documentation.
* **General Cleanup**: Improve comments, add typing guards, eliminate redundant variables, or standardise spelling normalizations wherever possible.

The improvement record is part of the product: substantive changes and
deliberate no-change audits belong in `DEVELOPER_LOG.md` and the active
roadmap. Lumina's functional clarity, explicit effects, and teachable
composition are requirements in their own right; performance is evidence that
those choices work in production.

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
* Never end your turn or commit code if the regression test suite (`npm test`) is failing.

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

## Roadmap and complexity discipline

The living roadmap owns design; Beads drives the commissioned execution queue.
This replaces post-hoc task bookkeeping, not engineering judgment or acceptance.

1. **One owner per truth.** `ROADMAP.md` owns product priorities, decisions,
   feedback and deferrals; `FUNCTIONAL_REFACTOR_ROADMAP.md` owns engineering
   direction and milestone acceptance. Beads owns selected task state, priority,
   dependencies, claims and next eligible work. Git/tests/reviews prove results;
   `DEVELOPER_LOG.md` retains generic rationale/lessons. Private entrypoints and
   recovery stay in ignored `.agents/MEMORY.md`. Link, don't copy, evidence.
2. **Commission once, then queue.** Ground the current roadmap and approved
   scope/exclusions once per batch. Create the meaningful outcomes up front with
   one unique batch label, per-task description, acceptance, spec/evidence links,
   priority and real prerequisites. Prefer native graph import to create approved
   open tasks, edges and stable execution-owner/spec references together; Markdown
   remains valid for independent tasks. Verify the returned IDs/graph before
   dispatch. A partial/unknown write needs inspection, not blind replay.
   Don't import the whole backlog, split trivial actions into tasks, or invent
   dependency edges to encode a preferred order. Ideas alone are not tasks.
3. **Let readiness select.** Use batch-scoped atomic `ready --claim`, restricted
   to the commissioned issue type and one result, under approved priorities and
   exclusions. Brief bounded listings orient; the claimed full brief plus linked
   spec supplies execution context. Don't reload the whole roadmap/history or
   separately query then claim every task. Explicit user order outranks default
   sorting: use a narrower eligible selection when necessary, not a fake edge.
   Labels, priority and readiness are not authority to expand the batch.
4. **Resume before selecting.** On resumption inspect the scoped in-progress
   queue, exact issue and linked native run/result before any fresh claim. Verify
   actual process/session ownership; recover an existing result instead of
   duplicating execution. An expired lease or empty ready list proves neither
   stopped work nor completion. Renew native leases only for verified work;
   record a real blocker and its resume condition. No automatic reclaim.
5. **Keep WIP and authority small.** One implementation writer and active slice
   per authoritative checkout; independent review is read-only. Fila owns tracker
   writes, dispatch, product judgment and acceptance; workers receive one bounded
   brief, required standing conventions, baseline and execution limits. Beads
   neither launches workers nor interprets tests/reviews. Native sessions own
   execution/result custody; official continuations are required for background
   progress. Each issue links that native owner/spec once at creation; follow the
   owner for child runs/results instead of copying every phase into task notes.
   Update the reference for a real handoff or broken link, not routine status.
   Claims are not liveness or an authorization to overlap writers.
6. **Reconcile changes, not histories.** Integrate new feedback/discoveries in
   their existing roadmap phase/backlog with origin, rationale, scope impact and
   acceptance; merge duplicates and distinguish proposals/deferrals. Before
   affected dispatch update the queued brief/priority/dependencies. Reconcile
   active work at a safe boundary without silently preempting it. Reread linked
   sections when scope, evidence or source changes, not routinely every step.
7. **Accept, close, consume next.** Keep failed/rejected work open through repair
   and the required tests/review. Fila accepts exact evidence and commits only
   owned paths, then uses normal `close --suggest-next` with explicit ID and
   concise commit/test/review links. Hints may include outside work: the next
   claim must still be batch-scoped. Never use `batch close`, forced closure or
   unfiltered `close --claim-next` as a shortcut. Preserve required backup and
   task-owned cleanup; do not advance on an unconfirmed write or failed gate.
8. **Capture once, report meaning.** The issue and linked acceptance evidence
   satisfy per-step continuity. Update roadmap/checkpoint prose for decisions,
   risks, changed direction and milestone outcomes, not every claim/heartbeat.
   Journal reusable learning, not queue transitions. ACTIVE-TASK/memory are
   indexes/preferences, not duplicate task ledgers. Use scoped native counts for
   aggregates and native lint for brief structure, not model-recomputed counts or
   repeated field checks. Lint warnings need inspection even with exit0; presence
   is not meaningful acceptance. Report commit subject, roadmap movement, result,
   checks and exact next work. A drained selected queue
   does not finish the roadmap or commission another batch; verify all selected
   outcomes and stop task-owned continuations at acceptance.
9. **Budget and evaluate.** Retain one orchestrator, checkout and opted-in store;
   no new supervisor, scheduler, synchronizer, runtime ledger or wrapper layer.
   Any necessary addition needs a concrete unmet need, simpler alternative,
   owner, tests and rollback. Use the existing complexity gauge and actual diff;
   its path/size flags aren't JavaScript control-flow measurements. Prefer pure
   composition, small commits and the existing test harness. Consolidate repeated
   guidance before extending tooling. On the next commissioned batch, record
   bulk/selection calls, task-context reconstruction, queue mistakes/recovery and
   duplicate status writing in its existing evidence. Compare with prior work
   without invented time/token savings or a new monitoring system; simplify or
   retire Beads if it costs more than it saves. Quick one-step work needn't use it.

## 🤖 Mandatory AI Agent Behaviors

As an AI agent, you must execute the following procedures without exception:
1. **Atomic & Structured Commits**: Commit changes continuously as separate logical steps rather than doing a massive single commit at the end.
2. **Hardened Error Boundaries**: Wrap OS integrations, system-level execution calls (DBus, pactl, CPU governor commands), and file reads/writes in robust `try/catch` handlers with fail-safes.
3. **No Infinite Loops**: Never allow skips, state transitions, or socket synchronizations to trigger recursively without rate limits or counter bounds.
4. **Pre-flight Check**: Run `npm test` before declaring success, ensuring all assertions pass.
5. **No Local Chromium Installations**: Under no circumstances should you attempt to install Chromium, Playwright browser binaries, or system browser dependencies on the local gateway host `filament`. Lumina runs on the dedicated Fedora host named `playwright` (IP `192.168.0.178`), which already has system Chromium installed and configured.
6. **Stop and Ask If Lost**: If you suspect you are lost, encounter an environmental mismatch, or feel any ambiguity about your execution location, you **must stop immediately and ask Alex for clarification**. Do not proceed with high-risk assumptions.
7. **Do Not Run Deployment / Backup Scripts Through an Active Mount**: When this workspace is mounted directly from the target host, edits already apply there. Do not run copy, sync, or backup scripts that duplicate project files; they can corrupt the mount or overwrite live configuration.
