# Lumina Workspace Rules

These rules are loaded automatically by Antigravity as project-scoped rules for this workspace.

## 🚀 Execution & Host Constraints
- **Target Host Only**: Lumina is developed, tested, and run exclusively on the `playwright` host (`alex@playwright`), which functions as the TV computer.
- **Do Not Copy to Filament**: Never copy the project files from `playwright` over to the local environment `filament`. This mount is managed via `sshfs` to `/home/fila/.openclaw/workspace/lumina`. Attempts to copy files or run/test the code directly on `filament` will fail due to missing GUI libraries, system integrations, and environment constraints.
- **Run Tests on Playwright**: All integration tests, browser tests, and server executions must run on the target host `playwright`.

## 🔒 Privacy & Commits
- **No Personal Information in Git**: Commits are pushed to a public repository on GitHub. **NEVER** save or commit personal information, personal usernames, access tokens, credentials, private paths, or secrets to the git history.
- **Instruction Storage**: It is perfectly fine to document instructions in the OpenClaw files (like `/home/fila/.openclaw/workspace/lumina/AGENTS.md` and this rules file) or in the Antigravity memory.
