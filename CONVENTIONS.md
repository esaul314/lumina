# 📜 Lumina Coding Style, Conventions & Philosophy

Welcome, developer or AI agent! This codebase is governed by a strict set of architectural philosophies, coding standards, and operational behaviors. Every contribution you make must strictly adhere to these principles to maintain Lumina's extreme efficiency, reliability, and beauty.

---

## 🌌 The Scout Rule (Core Directive)
> **"Always try to leave the codebase better than it was before."**

Every time you modify a file, run a test, or implement a feature, identify at least one small way to leave the surrounding code cleaner, more robust, or better documented. Examples include:
* Improving comments or adding typings.
* Eliminating redundant variables or nested conditionals.
* Standardizing spelling normalizations.
* Adding a defensive guard to prevent crashes.

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

## 🤖 Mandatory AI Agent Behaviors

As an AI agent, you must execute the following procedures without exception:
1. **Atomic & Structured Commits**: Commit changes continuously as separate logical steps rather than doing a massive single commit at the end.
2. **Hardened Error Boundaries**: Wrap OS integrations, system-level execution calls (DBus, pactl, CPU governor commands), and file reads/writes in robust `try/catch` handlers with fail-safes.
3. **No Infinite Loops**: Never allow skips, state transitions, or socket synchronizations to trigger recursively without rate limits or counter bounds.
4. **Pre-flight Check**: Run `npm test` before declaring success, ensuring all assertions pass.
