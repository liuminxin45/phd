import type { GerritDiffInfo } from '@/lib/gerrit/types';

export const COMMIT_MESSAGE_FILE_PATH = '/COMMIT_MSG';

export interface CommitMessageTypoIssue {
  line: number;
  startColumn: number;
  endColumn: number;
  text: string;
  suggestion?: string;
  reason?: string;
}

export interface CommitMessageCheckResponse {
  issues: CommitMessageTypoIssue[];
}

export function buildCommitMessageDiff(message: string): GerritDiffInfo {
  const normalized = String(message || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  return {
    change_type: 'MODIFIED',
    meta_b: {
      name: COMMIT_MESSAGE_FILE_PATH,
      content_type: 'text/plain',
      lines: lines.length,
    },
    content: [
      {
        b: lines,
      },
    ],
  };
}
