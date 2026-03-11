/**
 * Prompt builders for AI-assisted code review.
 * All prompts request structured JSON output for reliable parsing.
 */

import type { AiIssue, AiTeamRules, AiFeedbackEntry } from './ai-types';

interface FeedbackPromptContext {
  entries: AiFeedbackEntry[];
}

interface VerificationPromptIssue {
  index: number;
  issue: Pick<AiIssue, 'category' | 'severity' | 'title' | 'description' | 'file' | 'line' | 'suggestion'>;
}

/**
 * System prompt for the AI code reviewer role.
 */
export function buildReviewSystemPrompt(teamRules?: AiTeamRules): string {
  let base = `You are a senior code review expert. Your task is to perform a structured analysis of Gerrit code changes to help reviewers quickly understand the changes and identify potential issues.

Core Principles:
- Report only valuable findings; do not pad the results.
- Prioritize correctness, regression risk, compatibility, concurrency, state transitions, error handling, and data integrity.
- Style issues come last and should be reported only when they materially harm readability or increase defect risk.
- Every suggestion must be specific and actionable.
- Cite specific files and line numbers.
- If the change quality is good, state it directly; do not force finding issues.
- Review only the visible diff. Never speculate about unseen code.
- Do not complain about missing tests, logging, comments, refactors, or abstractions unless the diff shows a concrete risk.
- Do not output vague statements such as "needs more attention", "may have issue", or "consider checking".
- Prefer fewer high-quality findings over many weak findings.

Output Format Requirements: You must return strict JSON. Do not include markdown code block markers or other text.

Language Requirements (Mandatory):
- All natural language fields must be in Simplified Chinese (简体中文).
- Use clear and professional technical Chinese.`;

  if (teamRules?.customInstructions) {
    base += `\n\nTeam Custom Rules:\n${teamRules.customInstructions}`;
  }

  if (teamRules?.focusAreas && teamRules.focusAreas.length > 0) {
    base += `\n\nKey Focus Areas: ${teamRules.focusAreas.join(', ')}`;
  }

  if (teamRules?.ignorePatterns && teamRules.ignorePatterns.length > 0) {
    base += `\n\nIgnore the following file patterns: ${teamRules.ignorePatterns.join(', ')}`;
  }

  return base;
}

export function buildTriageSystemPrompt(): string {
  return `You are a precision code-review triage assistant.

Task:
- Read the changed file list and pick files most worth deep review.
- Prioritize files that are most likely to hide correctness, compatibility, state, data, or performance regressions.
- Return strict JSON only.

Language:
- All natural-language fields must be in Simplified Chinese.`;
}

/**
 * Build the user prompt for a full AI review of a change.
 */
export function buildReviewPrompt(params: {
  subject: string;
  commitMessage?: string;
  project: string;
  branch: string;
  filesSummary: string;
  diffText: string;
  truncated: boolean;
  fileCount: number;
  totalFiles: number;
  triageHints?: string[];
  feedbackContext?: FeedbackPromptContext;
}): string {
  const truncationNote = params.truncated
    ? `\nNote: Due to large size, only diffs for ${params.fileCount}/${params.totalFiles} files are shown. Analyze based on visible content.`
    : '';

  const triageNote = params.triageHints && params.triageHints.length > 0
    ? `\nPriority Files (from triage): ${params.triageHints.join(', ')}`
    : '';

  const feedbackNote = params.feedbackContext && params.feedbackContext.entries.length > 0
    ? `\nRecent Reviewer Feedback Preferences (to reduce false positives):\n${params.feedbackContext.entries
      .slice(0, 20)
      .map((entry) => {
        const location = entry.file ? `${entry.file}${entry.line ? `:${entry.line}` : ''}` : 'unknown';
        const title = entry.title || 'Untitled Issue';
        return `- [${entry.value}] ${title} @ ${location}`;
      })
      .join('\n')}`
    : '';

  return `Please analyze the following Gerrit code change and return structured JSON.

## Change Information
- Subject: ${params.subject}
- Project: ${params.project}
- Branch: ${params.branch}
${params.commitMessage ? `- Commit Message: ${params.commitMessage}` : ''}
${truncationNote}
${triageNote}
${feedbackNote}

## Changed Files Summary
${params.filesSummary}

## Diff Content
Line number format:
- " OldLine:NewLine | Content" = Unchanged context
- "-OldLine | Content" = Deleted line
- "+NewLine | Content" = Added line

${params.diffText}

## Required JSON Structure

{
  "overview": {
    "riskLevel": "low" | "medium" | "high",
    "changeTypes": ["refactor" | "new-feature" | "bugfix" | "config" | "test" | "docs" | "dependency" | "mixed"],
    "summary": "One-sentence summary of the core change (in Chinese)",
    "focusPoints": ["Focus Point 1 (in Chinese)", "Focus Point 2 (in Chinese)", "Focus Point 3 (in Chinese)"]
  },
  "issues": [
    {
      "category": "bug" | "performance" | "maintainability" | "style",
      "severity": "low" | "medium" | "high",
      "title": "Issue Summary (in Chinese)",
      "description": "Detailed explanation (in Chinese)",
      "file": "File path",
      "line": LineNumber(of the new file),
      "suggestion": "Suggested fix (optional, in Chinese)",
      "evidence": {
        "file": "Evidence file path (required)",
        "line": Evidence line number (optional),
        "snippet": "Snippet from diff (required, 20-200 chars)"
      }
    }
  ]
}

Rules:
- Focus on issues that can influence behavior, correctness, compatibility, maintainability cost, or meaningful performance.
- Do not report pure naming/style/nit feedback unless it clearly harms understanding or is likely to cause future defects.
- Do not report "missing tests" by default. Report it only when the diff introduces high regression risk without any protection.
- Prefer at most 6 issues total. If the diff is clean, return 0-2 issues and make the overview useful.
- issues array sorted by severity descending (high -> medium -> low)
- The 'line' for each issue must be a valid new file line number from the diff (number after +)
- evidence.snippet must be actual content from the diff, do not fabricate
- focusPoints max 3 items
- If no issues, return empty issues array
- riskLevel criteria: high = definite bug or security issue, medium = performance or logic risk, low = style only or clean
- All readable text fields must be in Simplified Chinese`;
}

/**
 * Stage-1 prompt: quickly identify risky files for deep analysis.
 */
export function buildFileTriagePrompt(params: {
  subject: string;
  project: string;
  branch: string;
  filesSummary: string;
}): string {
  return `You are a code review assistant. Perform a "quick triage" to identify files most worthy of deep analysis based on the file list.

Change Subject: ${params.subject}
Project: ${params.project}
Branch: ${params.branch}

File List:
${params.filesSummary}

Return strict JSON (no markdown):
{
  "highRiskFiles": ["file1", "file2"],
  "reasons": ["Reason 1 (in Chinese)", "Reason 2 (in Chinese)"]
}

Rules:
- highRiskFiles max 8 files
- Prioritize core business logic, auth, concurrency, persistence, and API protocols
- Prefer implementation files over generated files, docs, snapshots, and obvious resource files
- reasons max 3 items, concise (in Chinese)
- reasons must be in Simplified Chinese`;
}

export function buildVerificationSystemPrompt(): string {
  return `You are a rigorous code-review verifier.

Task:
- Verify whether each finding is actually supported by the visible diff.
- Reject findings that are speculative, generic, or not backed by code evidence.
- Return strict JSON only.

Language:
- All natural-language fields must be in Simplified Chinese.`;
}

/**
 * Stage-2 prompt: verify high-severity issues with a stricter pass.
 */
export function buildIssueVerificationPrompt(params: {
  subject: string;
  diffText: string;
  issues: VerificationPromptIssue[];
}): string {
  return `Please verify the following high-severity issues against the diff evidence.

Change Subject: ${params.subject}

Issues to Verify:
${params.issues
  .map(({ index, issue }) => `#${index}
- title: ${issue.title}
- category: ${issue.category}
- severity: ${issue.severity}
- file: ${issue.file || 'unknown'}
- line: ${issue.line ?? 'unknown'}
- description: ${issue.description}`)
  .join('\n\n')}

Diff:
${params.diffText}

Return strict JSON (no markdown):
{
  "results": [
    {
      "index": 0,
      "status": "confirmed" | "rejected" | "uncertain",
      "reason": "Verification reason (under 20 words, in Chinese)"
    }
  ]
}

Rules:
- Mark confirmed only if clear evidence exists
- If evidence is insufficient, prefer uncertain
- Reject generic findings that are not directly grounded in the diff
- Do not return non-existent indices
- reason must be in Simplified Chinese`;
}

export function buildRiskAssessmentSystemPrompt(): string {
  return `You are a fast Gerrit change-risk assessor.

Task:
- Estimate risk quickly using only metadata such as title, project, size, and changed-file summary.
- Return strict JSON only.

Language:
- All natural-language fields must be in Simplified Chinese.`;
}

/**
 * Build a lightweight prompt for quick risk assessment (used in change list).
 */
export function buildRiskAssessmentPrompt(params: {
  subject: string;
  project: string;
  insertions: number;
  deletions: number;
  filesSummary: string;
}): string {
  return `Quickly assess the risk level of the following code change.

Change: ${params.subject}
Project: ${params.project}
Size: +${params.insertions}/-${params.deletions}

File List:
${params.filesSummary}

Return strict JSON (no markdown):
{
  "riskLevel": "low" | "medium" | "high",
  "briefReason": "One sentence reason (under 15 words, in Chinese)"
}

Criteria:
- high: Security, auth, DB migration, core logic, massive refactor (>500 lines)
- medium: API changes, state management, concurrency, medium size
- low: Docs, config, tests, small fixes, renames`;
}
