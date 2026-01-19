# Cleanup Plan - Commit 5c08b69

## Overview
This is an initial commit with complete application code. Cleanup will focus on removing debug noise, redundant code, and improving code quality without changing behavior.

## 1. Logging Cleanup

### Debug Logging to Remove
- **`pages/api/projects/[id]/roles/edit.ts`** (lines 195-196, 202-203):
  - Remove debug console.log statements for params and matched records
  - Keep error logging for production debugging

- **`components/ui/people-picker.tsx`** (lines 94-98, 181, 259):
  - Remove verbose error details logging (stack traces)
  - Remove "Selected person" debug logs
  - Keep error logging but simplify

### Performance Monitor Logging
- **`lib/performanceMonitor.ts`**:
  - This is a legitimate performance monitoring utility
  - Keep as-is (provides value for debugging slow operations)
  - Already has enable/disable flag

### Error Logging (Keep)
All `console.error` in API error handlers should be **kept** as they provide critical debugging information:
- API route error handlers (12 files)
- Component error boundaries
- These are essential for production debugging

## 2. TODO/FIXME Comments

Files with TODO comments (11 matches across 6 files):
- **`pages/api/projects/[id]/comments.ts`** (3 TODOs)
- **`pages/api/projects/[id]/milestones/create.ts`** (3 TODOs)
- **`components/task/TaskDetailDialog.tsx`** (2 TODOs)
- **`components/ui/node-pool-picker.tsx`** (1 TODO)
- **`pages/api/projects/[id]/milestones/delete.ts`** (1 TODO)
- **`pages/api/tasks/create.ts`** (1 TODO)

**Action**: Review each TODO and either:
- Remove if obsolete/completed
- Keep if documenting known limitation or future work

## 3. Empty Comment Lines

- **`pages/api/projects/[id]/comments.ts`** (2 empty comment lines)
- Remove standalone `//` lines with no content

## 4. Code Duplication

### Duplicate Popover Logic in `people-picker.tsx`
Lines 128-209 (selected person popover) and 214-287 (add button popover) contain nearly identical search UI code.

**Action**: Extract shared search popover component to eliminate ~80 lines of duplication

## 5. Redundant Code Patterns

### API Error Handling
Many API routes have similar error handling patterns. Consider if a shared error handler utility would reduce duplication.

**Decision**: Keep as-is for now - each route may need specific error context. Not worth the abstraction risk.

## 6. Unused Imports/Variables

**Action**: TypeScript compiler already validates this. No manual cleanup needed.

## 7. Comment Quality Review

**Action**: Remove comments that merely restate code. Keep comments that explain:
- Complex logic
- Non-obvious constraints
- Business rules
- API quirks

## Summary of Changes

### High Priority (Behavior-Preserving)
1. Remove debug console.log statements (4 locations)
2. Simplify error logging verbosity (2 locations)
3. Extract duplicate popover search UI in people-picker
4. Remove empty comment lines (2 locations)

### Medium Priority (Review Required)
1. Review and clean up TODO comments (11 locations)
2. Review comment quality across codebase

### Low Priority (Keep As-Is)
1. Performance monitor logging (intentional debugging tool)
2. API error logging (essential for production)
3. Error handlers (each route needs specific context)

## Estimated Impact
- **Lines removed**: ~100-150 lines
- **Duplication eliminated**: ~80 lines (people-picker refactor)
- **Behavior changes**: ZERO (all changes are cleanup only)
