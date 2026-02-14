/**
 * Serialize Gerrit diff data into a compact text representation for LLM consumption.
 * Preserves file paths, line numbers, and change context while staying within token budgets.
 */

import type { GerritDiffInfo, GerritFileInfo } from './types';

const MAX_DIFF_CHARS = 60_000;

interface FileDiffInput {
  path: string;
  info: GerritFileInfo;
  diff: GerritDiffInfo;
}

/**
 * Convert a single file's Gerrit diff into a unified-diff-like text block
 * with line numbers for AI to reference.
 */
function serializeFileDiff(file: FileDiffInput): string {
  const header = `--- a/${file.path}\n+++ b/${file.path}`;
  const statusTag = file.info.status === 'A' ? ' (new file)' :
                    file.info.status === 'D' ? ' (deleted)' :
                    file.info.status === 'R' ? ` (renamed from ${file.info.old_path})` : '';

  if (file.diff.binary) {
    return `${header}${statusTag}\n[binary file]\n`;
  }

  const lines: string[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const chunk of file.diff.content) {
    if (chunk.skip) {
      oldLine += chunk.skip;
      newLine += chunk.skip;
      continue;
    }

    if (chunk.ab) {
      // Context lines — only include first/last 2 of large blocks
      if (chunk.ab.length > 6) {
        for (let i = 0; i < 2; i++) {
          lines.push(` ${oldLine + i}:${newLine + i} | ${chunk.ab[i]}`);
        }
        lines.push(`  ... (${chunk.ab.length - 4} unchanged lines) ...`);
        for (let i = chunk.ab.length - 2; i < chunk.ab.length; i++) {
          lines.push(` ${oldLine + i}:${newLine + i} | ${chunk.ab[i]}`);
        }
      } else {
        for (let i = 0; i < chunk.ab.length; i++) {
          lines.push(` ${oldLine + i}:${newLine + i} | ${chunk.ab[i]}`);
        }
      }
      oldLine += chunk.ab.length;
      newLine += chunk.ab.length;
    }

    if (chunk.a) {
      for (const line of chunk.a) {
        lines.push(`-${oldLine} | ${line}`);
        oldLine++;
      }
    }

    if (chunk.b) {
      for (const line of chunk.b) {
        lines.push(`+${newLine} | ${line}`);
        newLine++;
      }
    }
  }

  return `${header}${statusTag}\n${lines.join('\n')}\n`;
}

/**
 * Build a complete diff text from multiple files, respecting a character budget.
 * Returns { text, truncated, fileCount }.
 */
export function buildDiffText(
  files: FileDiffInput[],
  maxChars: number = MAX_DIFF_CHARS,
): { text: string; truncated: boolean; fileCount: number; totalFiles: number } {
  const parts: string[] = [];
  let totalChars = 0;
  let included = 0;

  for (const file of files) {
    const block = serializeFileDiff(file);
    if (totalChars + block.length > maxChars && included > 0) {
      parts.push(`\n... (${files.length - included} more files truncated due to size) ...`);
      return { text: parts.join('\n'), truncated: true, fileCount: included, totalFiles: files.length };
    }
    parts.push(block);
    totalChars += block.length;
    included++;
  }

  return { text: parts.join('\n'), truncated: false, fileCount: included, totalFiles: files.length };
}

/**
 * Build a lightweight summary of files for risk assessment (no full diff content).
 */
export function buildFilesSummary(
  filesMap: Record<string, GerritFileInfo>,
): string {
  const entries = Object.entries(filesMap)
    .filter(([p]) => p !== '/COMMIT_MSG')
    .sort(([a], [b]) => a.localeCompare(b));

  return entries.map(([path, info]) => {
    const status = info.status || 'M';
    const ins = info.lines_inserted || 0;
    const del = info.lines_deleted || 0;
    return `${status} ${path} (+${ins}/-${del})${info.binary ? ' [binary]' : ''}`;
  }).join('\n');
}

export type { FileDiffInput };
