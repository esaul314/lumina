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

The living roadmap is a maintained design, not a generated task dump. Apply this
workflow to each commissioned slice; do not add another synchronizer or planner.

1. **One owner per kind of truth.** `ROADMAP.md` owns product intent, priorities,
   accepted feedback and deferrals. `FUNCTIONAL_REFACTOR_ROADMAP.md` owns the
   ordered engineering track and its current checkpoint. Beads owns executable
   tasks, dependencies and claims in the opted-in scope. Git/tests/reviews prove
   implementation; `DEVELOPER_LOG.md` records generic rationale and lessons.
   Host paths, tracker commands and local recovery belong only in ignored
   `.agents/MEMORY.md`. Link these records rather than copying full histories.
2. **Incorporate feedback and discoveries as they occur.** Before further
   dependent work, place a new suggestion in its relevant existing phase or
   backlog section, with its origin/date, intent, rationale, acceptance and scope
   impact. Merge duplicates; do not quietly replace a prior decision. A worker
   reports discoveries; the orchestrator integrates them. For a new idea, the
   roadmap entry is sufficient until it becomes actionable. Mark proposals and
   deferrals clearly: capture is not implementation authorization.
3. **Translate only selected work.** Read the current roadmap, then create or
   update a Beads task for a bounded outcome with a roadmap reference and testable
   acceptance. Add an edge only for a real prerequisite. Do not bulk-import
   headings, history or every checklist item. Roadmap changes affecting queued
   work must update its task/dependencies before another dispatch. If they affect
   active work, reconcile at the next safe boundary; never silently preempt a
   writer or wait until closeout to record the change.
4. **Keep WIP small.** One implementation writer and one active implementation
   slice per authoritative checkout. Independent review is read-only. Claim and
   query with native tracker commands; process/session tools, not task labels,
   determine liveness. Beads is not an execution engine or code-complexity tool.
5. **Budget the architecture.** Retain one orchestrator, one authoritative source
   checkout and one project task store. Default net additions per slice: zero
   supervisors, schedulers, synchronization services, shadow runtime ledgers or
   wrapper layers. A genuinely necessary new dependency/service needs a concrete
   unmet need, the simpler alternative, ownership, tests and removal/rollback
   recorded in the existing plan. Do not grow infrastructure for hypothetical scale.
6. **Check complexity where it changes.** Compare before/after using the existing
   gauge plus the actual diff. Its path/size flags are prompts, not proof of bad
   state management or JavaScript control-flow quality. Review new dependencies,
   durable state, abstraction depth, largest touched module and duplicated
   instructions. Prefer pure composition and modern syntax when clearer; no new
   algebraic layer for a direct data projection. Keep existing small-commit
   guidance. Avoid duplicating test harnesses or folding more unrelated tests
   into an already large runner.
7. **Consolidate before extending the factory.** Before any further tooling
   expansion, shorten duplicated current-status histories in the agent guide and
   companion into linked summaries, preserving rationale in the existing journal
   and archived originals. This is a bounded maintenance candidate, not a new
   refactoring program. Move a coherent test group out of the large runner only
   when a touched seam demonstrates a maintenance benefit; preserve the single
   existing test entrypoint. Reassess Beads after the next real slice; retire it
   if selection/resumption is not simpler. No new monitoring daemon or audit DB.
8. **Close with evidence and report meaning.** Update the engineering checkpoint,
   generic journal and affected task before reporting completion; do not close a
   phase just because one task is done. Back up the opted-in store and clean only
   task-owned scratch. Report the commit subject, roadmap step, outcome, tests,
   complexity delta and next work; hashes are optional secondary traceability.
   Commit bodies explain why, the roadmap reference and verification. Mixed
   incumbent documentation edits must not be swept into an unrelated commit.

## 🤖 Mandatory AI Agent Behaviors

As an AI agent, you must execute the following procedures without exception:
1. **Atomic & Structured Commits**: Commit changes continuously as separate logical steps rather than doing a massive single commit at the end.
2. **Hardened Error Boundaries**: Wrap OS integrations, system-level execution calls (DBus, pactl, CPU governor commands), and file reads/writes in robust `try/catch` handlers with fail-safes.
3. **No Infinite Loops**: Never allow skips, state transitions, or socket synchronizations to trigger recursively without rate limits or counter bounds.
4. **Pre-flight Check**: Run `npm test` before declaring success, ensuring all assertions pass.
5. **No Local Chromium Installations**: Under no circumstances should you attempt to install Chromium, Playwright browser binaries, or system browser dependencies on the local gateway host `filament`. Lumina runs on the dedicated Fedora host named `playwright` (IP `192.168.0.178`), which already has system Chromium installed and configured.
6. **Stop and Ask If Lost**: If you suspect you are lost, encounter an environmental mismatch, or feel any ambiguity about your execution location, you **must stop immediately and ask Alex for clarification**. Do not proceed with high-risk assumptions.
7. **Do Not Run Deployment / Backup Scripts Through an Active Mount**: When this workspace is mounted directly from the target host, edits already apply there. Do not run copy, sync, or backup scripts that duplicate project files; they can corrupt the mount or overwrite live configuration.
