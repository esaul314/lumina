# Agent Memory Handoff: Authority, Staleness, and Git Escalation

Updated: 2026-07-31

## Purpose

This is a handoff for the next agent working on Lumina. It records a workflow
failure discovered during the current session: a well-known Git escalation rule
was stored many times, yet an agent still stopped at the ordinary sandbox
boundary instead of requesting the required elevated Git operation.

This document is deliberately about agent workflow, not product behavior. Keep
it concise, portable, and free of machine-specific identifiers.

## Audit snapshot

The memory audit found 24 direct references to escalating Git across 15 memory
files. The same rule appeared in ad-hoc notes, generated summaries, and
historical rollout artifacts. The tracked Lumina documentation did not state
the escalation rule explicitly.

The ordinary workspace permits source edits while Git metadata writes can be
blocked. That is an execution-policy boundary, not evidence that the repository
cannot be committed or pushed.

## Design flaws

### 1. No single authoritative instruction

The same operational rule was copied into several memory layers. A later
correction said it superseded an earlier note, but the old note remained
searchable and there is no mechanical precedence or tombstone system. Retrieval
can therefore surface stale guidance beside the correction.

### 2. Historical evidence looks like current policy

Raw histories and rollout summaries are valuable evidence, but they should not
compete with current operating instructions. A past failure, a current workflow
rule, and a one-off workaround need distinct status labels.

### 3. The project instruction missed a required action

Lumina's project instructions require atomic commits and pushes, but did not
say what to do when the sandbox blocks Git metadata writes. The agent therefore
had a goal (commit) without the approved transition (request escalation).

### 4. Memory stated a fact, not an executable decision rule

“Git metadata may be read-only” is descriptive. The actionable rule must state
the trigger and response: when a needed Git metadata operation is blocked,
request narrowly scoped escalation and retry that operation before reporting a
commit blocker.

### 5. Local environment facts can drift into portable guidance

Host, mount, and sandbox details are useful locally but should not be copied
into tracked docs. Public instructions should describe the decision rule;
local-only notes may retain the exact diagnostics.

## Canonical policy for future Lumina work

Use this rule as the current source of truth:

> For a substantive Lumina change, verify the diff and tests, then complete the
> required atomic Git commit. If a needed Git metadata command is blocked by the
> ordinary sandbox, immediately rerun that narrowly scoped command through the
> approved escalation path. Do not report the first read-only Git failure as a
> final blocker.

Escalation must remain scoped to the intended Git operation. Inspect the diff
before staging, use a conventional commit message, and push only when the task
or project workflow requires publication.

## Recommended memory hierarchy

Apply this precedence order when instructions conflict:

1. Current system and developer instructions.
2. The user's current request.
3. Project-scoped agent instructions (`AGENTS.md` and `.agents/AGENTS.md`).
4. One canonical current-memory record with an explicit `status: current`.
5. Historical rollout summaries and raw memories, used as evidence only.

Each operational policy should have one canonical record with:

- a short trigger and required action;
- scope and review date;
- an explicit `supersedes` reference when it replaces an older rule; and
- a pointer to evidence, rather than copied evidence.

Older records should be marked historical or superseded. If the memory store is
append-only, add a small canonical index rather than restating the full rule in
every summary.

## Next-agent checklist

Before closing substantive work:

1. Inspect `git status`, the diff, and Git metadata writability early.
2. Run the required verification for the changed surface.
3. If normal Git metadata access is blocked, request escalation for the exact
   staging, commit, or push command needed.
4. Continue the Git delivery path after approval; do not convert the ordinary
   sandbox failure into a handoff-only result.
5. Record one generic lesson in `DEVELOPER_LOG.md` and any machine-specific
   detail only in the ignored local journal.

## Follow-up for maintainers

Add the canonical policy above to the project-scoped agent instructions, then
reduce memory duplication by maintaining a single current workflow index. Do
not delete historical rollout evidence; lower its retrieval priority instead.
