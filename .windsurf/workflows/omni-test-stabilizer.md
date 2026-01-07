<!-- file: omni-test-stabilizer.md -->

---
description: Post-commit test stabilizer (commit-driven). Run existing tests first; if failing, diagnose from last commit and fix; when green, add new tests for last commit changes; iterate until green.
auto_execution_mode: 3
---

# Omni Test Stabilizer (Commit-based) — Repair Existing Tests, Then Add New Tests for the Commit

Role: stabilization engineer.

Non-negotiable: **DO NOT change behavior** (user-visible behavior, protocols, defaults, UI semantics). Only fix tests or make behavior-preserving code changes required for tests to pass, then add tests for the commit.

Decisions must be justified by:
- commit patch evidence (`git show`)
- test failure evidence (logs, stack traces)
- minimal fix reasoning tied to last commit changes

---

## Testing Philosophy & Global Invariants 

These rules apply to the entire workflow. They do not remove or weaken any step below.

1. **Theoretical completeness**
   - In principle, every module, file, and function SHOULD have corresponding unit tests.
   - Missing tests are technical debt rather than an acceptable steady state.

2. **Incremental enforcement**
   - This workflow does NOT require full historical backfilling in a single run.
   - However, any code touched by `TARGET_COMMIT` MUST move closer to complete coverage
     by (a) repairing existing tests and/or (b) adding new tests for the changed surface.

3. **Behavior-first testing**
   - Tests must lock externally observable behavior and contracts.
   - Avoid tests that assert private implementation details or internal structure.

4. **Existing-file-first for new tests**
   - When adding tests, ALWAYS search for existing test files for the unit/module first.
   - If a relevant test file exists, append to it.
   - Only create a new test file if none exists for that unit/module.

5. **Structured, maintainable test layout**
   - Test files are first-class assets: naming, structure, and directory layout must be consistent.
   - Avoid duplicated or parallel test files for the same unit; avoid “misc” buckets.
   - Shared helpers must live in dedicated test utility modules, not copied inline.

---

## Step 0 — Identify Target Commit (Hard Gate)

1) Use `TARGET_COMMIT` if provided; otherwise default to `HEAD`.
2) Ensure working tree is clean:
   - `git status`
   If not clean: STOP and ask user to commit or stash.

---

## Step 1 — Collect Evidence (Hard Gate, ignore doc-markdown for analysis)

### 1.1 Ignore rules for *analysis input*
Markdown docs must NOT drive fix scope decisions:
- `docs/**`
- `design-system/**`
- `README*.md`
- (default ON) any `**/*.md`

Note: this is an analysis-scope rule only; we still archive the full patch.

### 1.2 Record FULL commit evidence (including markdown) for audit
- `git show --name-status --stat $TARGET_COMMIT`
- `git show --patch $TARGET_COMMIT`

Save:
- `reports/tests/<shortsha>/evidence/full-stat.txt`
- `reports/tests/<shortsha>/evidence/full-patch.diff`

### 1.3 Produce CODE-FOCUSED evidence (exclude docs/markdown)
Preferred (Git pathspec magic exclude):
- `git show --name-status --stat $TARGET_COMMIT -- . ':(exclude)docs/**' ':(exclude)design-system/**' ':(exclude)README*.md' ':(exclude)**/*.md'`
- `git show --patch $TARGET_COMMIT -- . ':(exclude)docs/**' ':(exclude)design-system/**' ':(exclude)README*.md' ':(exclude)**/*.md'`

Fallback if exclude pathspec is unsupported:
- Ignore `.md` diffs while extracting scope.

Save:
- `reports/tests/<shortsha>/evidence/code-stat.txt`
- `reports/tests/<shortsha>/evidence/code-patch.diff`

### 1.4 Extract impacted modules from CODE-FOCUSED evidence
Identify changed areas (apps/packages/plugins/config). Write:
- `reports/tests/<shortsha>/scope.md`

---

## Step 2 — Checkout Branch at TARGET_COMMIT (Hard Gate)

- `git checkout -b chore/test-stabilize-<shortsha> $TARGET_COMMIT`

Rule:
- All modifications and commits MUST occur on this branch (no direct changes on the original branch).

---

## Step 3 — Run Existing Test Suite First (Hard Gate)

Goal: establish reality before modifying anything.

### 3.1 Optional static gates (recommended)
Run if scripts exist:
- `pnpm -r lint`
- `pnpm -r typecheck`

Save:
- `reports/tests/<shortsha>/baseline/lint.txt`
- `reports/tests/<shortsha>/baseline/typecheck.txt`

### 3.2 Run **existing tests only** (no new tests yet)
Prefer repo standard:
- `pnpm -r test` (if exists) else `pnpm test`

If monorepo is heavy, allow scoped baseline run driven by Step 1.4 scope (but final run must use standard command):
- examples:
  - `pnpm --filter <pkg> test`
  - `pnpm -C packages/<pkg> test`

Save:
- `reports/tests/<shortsha>/baseline/existing-tests.txt`

Decision:
- If existing tests PASS: go to Step 6.
- If existing tests FAIL: go to Step 4.

---

## Step 4 — Diagnose Failures Using Commit Evidence (Hard Gate)

Principle: tie every fix back to the last commit’s change surface.

### 4.1 Classify failures
For each failing suite/case:
- capture failing test name(s), stack trace, and impacted files
- map to `code-patch.diff` hunks: which hunk likely introduced the failure?

Write:
- `reports/tests/<shortsha>/repair/failure-map.md`

### 4.2 Minimal fix strategy (behavior-preserving)
Allowed fix types (choose smallest):
- Fix test assumptions that are now incorrect **without changing product behavior**
- Fix test setup/mocks/fixtures to match unchanged behavior
- Fix a regression introduced by the commit **only if** it violates the "no behavior change" intent (i.e., unintended break)

If evidence suggests the commit intentionally changed behavior:
- STOP and report mismatch (do not proceed).

### 4.3 Implement fix in smallest scope
Rules:
- Touch only:
  - failing tests and their minimal support files
  - files changed by `TARGET_COMMIT`
  - minimal adjacent code required
- No unrelated refactor.

Record:
- `reports/tests/<shortsha>/repair/patch-notes.md` (what changed and why)

### 4.4 Re-run existing tests (loop)
Re-run:
- `pnpm -r test` (or scoped as in Step 3 for iteration speed)

Save each iteration:
- `reports/tests/<shortsha>/repair/iter-<n>-existing-tests.txt`

Loop Step 4 until existing tests are green.

---

## Step 5 — Guardrails Before Adding New Tests (Hard Gate)

Once existing tests are green:
- ensure `git diff` remains justified and within scope
- ensure no accidental junk/outputs were introduced:
  - `git status`
  - `git diff --name-only`
  - optional: `git ls-files -m -o --exclude-standard`

Write:
- `reports/tests/<shortsha>/repair/final-state.md`

---

## Step 6 — Add New Tests for `TARGET_COMMIT` Changes (Required)

Now that baseline is green, add tests that cover the change surface of `TARGET_COMMIT`.

### 6.1 Write a targeted test plan
Based on `code-patch.diff`:
- critical branches/edge cases added or modified
- regression coverage for bug fixes
- serialization/protocol invariants (if relevant)
- config defaults and error handling (lock them)

Write:
- `reports/tests/<shortsha>/new-tests/test-plan.md`

### 6.2 Implement new tests using existing framework
- Detect runner (vitest/jest/mocha/etc.). Use existing conventions.
- Tests should assert public behavior/contracts, not implementation details.
- Keep deterministic. Avoid flaky timing/network unless unavoidable.

Record:
- `reports/tests/<shortsha>/new-tests/test-files.md` (files + what each protects)

### 6.3 Test file management rules (Added, STRICT)

When adding new tests, enforce the following:

1) **Existing-file-first**
   - Search for an existing test file for the same unit/module.
   - If one exists, append new cases to the existing file.
   - Do NOT create parallel test files for the same unit/module.

2) **Create new file only if none exists**
   - If no relevant test file exists, create a new one following repository conventions.

3) **Test layout conventions (follow existing repo convention)**
   Prefer whichever style the repository already uses:
   - Co-located:
     - `src/foo.ts` → `src/foo.test.ts`
   - Centralized:
     - `packages/<pkg>/__tests__/foo.test.ts`
     - `packages/<pkg>/test/foo.test.ts`

4) **One logical unit per file**
   - A test file should focus on one module/logical unit.
   - Shared helpers must be placed in dedicated test utility modules (e.g., `test/utils/*`).

### 6.4 Run tests (loop until green)
Run:
- `pnpm -r test` (final must use standard command even if iteration uses scoped runs)

Save each iteration:
- `reports/tests/<shortsha>/new-tests/iter-<n>-test.txt`

If failures occur:
- diagnose whether:
  - new test is incorrect, or
  - the commit introduced a regression, or
  - environment flake
- fix minimally and re-run until green.

---

## Step 7 — Final Gates (Hard Gate)

Run (best-effort aligned with repo scripts):
- `pnpm -r lint` (if exists)
- `pnpm -r typecheck` (if exists)
- `pnpm -r test` (must pass)

Save:
- `reports/tests/<shortsha>/final/lint.txt`
- `reports/tests/<shortsha>/final/typecheck.txt`
- `reports/tests/<shortsha>/final/test.txt`

---

## Step 8 — Final Report (Required)

Write a concise engineering report:
- Baseline test status and key failures
- Failure-to-commit mapping (why the commit caused/related to failures)
- Fixes applied (tests vs code, and why behavior remains unchanged)
- New tests added for `TARGET_COMMIT` (what contracts they lock)
- Commands to validate

Save:
- `reports/tests/<shortsha>/report.md`

---

## Step 9 — Commit Strategy (Extended: Auto-Commit on the Stabilization Branch)

This workflow is considered safe and behavior-preserving. Therefore, once all final gates are GREEN,
the workflow MUST commit changes on the stabilization branch without asking for manual confirmation.

Rules:
1) Commits MUST be created on the branch `chore/test-stabilize-<shortsha>`.
2) Do NOT pause for review; do NOT ask for confirmation.
3) Prefer two commits for readability:
   - `chore: stabilize existing tests (no behavior change)`
   - `test: add coverage for <shortsha> changes`
4) If the repository enforces a single-commit policy, squash automatically (only within this branch).
5) Commit messages MUST indicate:
   - behavior preserved
   - tests verified

---
