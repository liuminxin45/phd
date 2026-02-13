// ─── Gerrit Frontend Helpers ─────────────────────────────────────────────────

import type { GerritChange, GerritLabelInfo, GerritAccount } from './types';

/**
 * Parse Gerrit timestamp "2026-02-13 07:00:00.000000000" to Date.
 */
export function parseGerritDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // Gerrit format: "2026-02-13 07:00:00.000000000" (UTC)
  const normalized = dateStr.replace(' ', 'T').replace(/\.0+$/, '') + 'Z';
  return new Date(normalized);
}

/**
 * Relative time string: "5 分钟前", "2 小时前", "3 天前"
 */
export function relativeTime(dateStr: string): string {
  const date = parseGerritDate(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return '刚刚';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} 个月前`;
  return `${Math.floor(diffMonth / 12)} 年前`;
}

/**
 * Format Gerrit date as "YYYY-MM-DD HH:mm"
 */
export function formatGerritDate(dateStr: string): string {
  const date = parseGerritDate(dateStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

// ─── Label Helpers ───────────────────────────────────────────────────────────

export type LabelScore = -2 | -1 | 0 | 1 | 2;

/**
 * Get the max score for a label (from the 'all' field).
 */
export function getLabelMaxScore(label: GerritLabelInfo | undefined): LabelScore {
  if (!label) return 0;
  if (label.rejected) return -2;
  if (label.approved) return 2;
  if (label.disliked) return -1;
  if (label.recommended) return 1;
  if (label.all && label.all.length > 0) {
    const maxAbsEntry = label.all.reduce((prev, curr) =>
      Math.abs(curr.value) > Math.abs(prev.value) ? curr : prev
    );
    return maxAbsEntry.value as LabelScore;
  }
  return 0;
}

/**
 * CSS classes for label score display.
 */
export function getLabelScoreColor(score: number): string {
  if (score >= 2) return 'bg-green-100 text-green-800 border-green-300';
  if (score === 1) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (score === 0) return 'bg-neutral-100 text-neutral-500 border-neutral-200';
  if (score === -1) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-300'; // -2
}

export function getLabelScoreText(score: number): string {
  if (score > 0) return `+${score}`;
  return String(score);
}

// ─── File Status Helpers ─────────────────────────────────────────────────────

export function getFileStatusLabel(status?: string): string {
  switch (status) {
    case 'A': return '新增';
    case 'D': return '删除';
    case 'R': return '重命名';
    case 'C': return '复制';
    case 'W': return '重写';
    default: return '修改';
  }
}

export function getFileStatusColor(status?: string): string {
  switch (status) {
    case 'A': return 'text-green-600';
    case 'D': return 'text-red-600';
    case 'R': return 'text-blue-600';
    default: return 'text-amber-600';
  }
}

// ─── Change Helpers ──────────────────────────────────────────────────────────

export function getStatusColor(status: string): string {
  switch (status) {
    case 'NEW': return 'bg-blue-100 text-blue-800';
    case 'MERGED': return 'bg-purple-100 text-purple-800';
    case 'ABANDONED': return 'bg-neutral-100 text-neutral-600';
    default: return 'bg-neutral-100 text-neutral-600';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'NEW': return 'Open';
    case 'MERGED': return 'Merged';
    case 'ABANDONED': return 'Abandoned';
    default: return status;
  }
}

/**
 * Build the Gerrit web URL for a change.
 */
export function getChangeUrl(gerritUrl: string, changeNumber: number): string {
  return `${gerritUrl}/c/${changeNumber}`;
}

/**
 * Get display name for an account.
 */
export function getAccountName(account?: GerritAccount): string {
  if (!account) return 'Unknown';
  return account.name || account.username || account.email || `Account #${account._account_id}`;
}

/**
 * Abbreviate project name: "platform/packages/apps/Settings" → "p/p/a/Settings"
 */
export function abbreviateProject(project: string): string {
  const parts = project.split('/');
  if (parts.length <= 2) return project;
  return parts.slice(0, -1).map((p) => p[0]).join('/') + '/' + parts[parts.length - 1];
}
