---
description: Post-commit cleanup & tests (behavior-preserving), commit-driven input, ignore docs markdown, remove temp md artifacts, detect & remove committed build/dependency junk, macro review as core execution, aggressive cleanup allowed
auto_execution_mode: 3
---

# Omni Cleanup Pro (Commit-based) — Cleanup + Tests, No Behavior Change

Role: stabilization engineer.

Non-negotiable:
- **DO NOT change behavior** (user-visible behavior, protocols, defaults, UI semantics).
- Cleanup MAY be aggressive, but behavior must remain identical.

This workflow explicitly combines:
- **pre-cleanup test validation**
- **aggressive cleanup with macro review as a core execution step**
- **post-cleanup test validation**

The workflow ends **only when all existing unit tests pass**.

---

## Step 0 — Identify Target Commit (Hard Gate)

1) Use TARGET_COMMIT if provided; otherwise default to `HEAD`.
2) Ensure working tree is clean:
   - `git status`
   If not clean: STOP and ask user to commit or stash.

---

## Step 1 — Pre-Cleanup Test Baseline (Hard Gate)

Purpose:
- Establish behavioral ground truth before any cleanup work.
- Tests are used strictly as behavior verification, not as a refactor driver.

Actions:
- Run existing tests only (DO NOT add new tests):
  - `pnpm -r test` if present
  - otherwise `pnpm test`

Store outputs:
- `reports/cleanup/<shortsha>/precheck/test.txt`

If tests FAIL:
- Diagnose failures.
- Fix issues minimally **without changing intended behavior**.
- Re-run tests until GREEN.
- Commit separately:
  - `chore: fix baseline test failures (no behavior change)`

Only proceed when tests PASS.

---

## Step 2 — Collect Evidence (Hard Gate, ignore doc-markdown for analysis)

### 2.1 Ignore rules for *analysis input*
Markdown docs must NOT drive refactor scope decisions:
- `docs/**`
- `design-system/**`
- `README*.md`
- (default ON) any `**/*.md`

Note: This is an **analysis scope** rule only. Full diffs are still archived.

### 2.2 Record FULL commit evidence (including markdown) for audit
- `git show --name-status --stat $TARGET_COMMIT`
- `git show --patch $TARGET_COMMIT`

Save:
- `reports/cleanup/<shortsha>/evidence/full-stat.txt`
- `reports/cleanup/<shortsha>/evidence/full-patch.diff`

### 2.3 Produce CODE-FOCUSED evidence (exclude docs/markdown)
- `git show --name-status --stat $TARGET_COMMIT -- . ':(exclude)docs/**' ':(exclude)design-system/**' ':(exclude)README*.md' ':(exclude)**/*.md'`
- `git show --patch $TARGET_COMMIT -- . ':(exclude)docs/**' ':(exclude)design-system/**' ':(exclude)README*.md' ':(exclude)**/*.md'`

Save:
- `reports/cleanup/<shortsha>/evidence/code-stat.txt`
- `reports/cleanup/<shortsha>/evidence/code-patch.diff`

### 2.4 Extract impacted modules
Identify affected apps/packages/plugins/configs.

Save:
- `reports/cleanup/<shortsha>/scope.md`

---

## Step 3 — Detect & Remove Accidentally Committed Junk (Hard Gate)

(Section unchanged from original document: junk detection, allowlist, proof, removal, gitignore hardening)

---

## Step 4 — Static Baseline Gates (Hard Gate, No Tests)

Create branch:
- `git checkout -b chore/cleanup-<shortsha> $TARGET_COMMIT`

Run:
- `pnpm -r lint` (if exists)
- `pnpm -r typecheck` (if exists)
- `pnpm -r build` (if exists)

Fix failures before continuing.

---

## Step 5 — Cleanup Plan (Mandatory)

Write a concrete cleanup plan BEFORE changing code:
- Redundant code to delete
- Duplicated logic to merge
- Abstractions to collapse
- Comment and logging cleanup strategy

Save:
- `reports/cleanup/<shortsha>/plan.md`

---

## Step 6 — Macro Review & Aggressive Cleanup (CORE STEP)

This step is **mandatory and executable**, not advisory.

### 6.1 Structural Redundancy Elimination
- Remove duplicated implementations
- Remove speculative abstractions
- Inline or delete unnecessary helpers

### 6.2 Abstraction Tightening
- Reduce public APIs
- Remove unused branches/options
- Prefer explicit logic over indirection

### 6.3 Comment Governance
Remove:
- Comments that restate code
- Obsolete or misleading comments
- TODO / speculative noise

Add comments ONLY where:
- Logic is complex
- Constraints are non-obvious
- Behavior is subtle

### 6.4 Logging Governance
Remove:
- Debug noise
- High-frequency low-value logs

Keep or add logs ONLY at:
- Error paths
- Lifecycle boundaries
- Irreversible state transitions

---

## Step 7 — Temporary Markdown Cleanup

Delete non-document `.md` files used for scratch/debug with proof of non-reference.

---

## Step 8 — Post-Cleanup Test Validation (Hard Gate)

Purpose:
- Verify that aggressive cleanup preserved all behavior.

Actions:
- Re-run existing tests ONLY:
  - `pnpm -r test` or `pnpm test`

Store outputs:
- `reports/cleanup/<shortsha>/postcheck/test.txt`

If tests FAIL:
- Diagnose regression.
- Fix issues minimally (no behavior change).
- Re-run tests until GREEN.

The workflow MUST NOT complete with failing tests.

---

## Step 9 — Cleanup Report

Write an engineering report:
- What was removed and why
- Redundancy eliminated
- Abstractions collapsed
- Comment/log adjustments
- Test verification summary

Save:
- `reports/cleanup/<shortsha>/report.md`

---

## Step 10 — Commit

Create final commit:
- `chore: aggressive cleanup (behavior preserved, tests verified)`

Workflow completion condition:
- Existing unit tests PASS.
