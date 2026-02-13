/**
 * Unified priority constants for Phabricator tasks.
 *
 * Phabricator Conduit API accepts keyword strings ('unbreak', 'high', …)
 * for maniphest.edit transactions. Numeric values (100, 90, …) are used
 * in API responses and for display ordering.
 */

export interface PriorityDef {
  key: string;
  numericValue: number;
  label: string;
  shortLabel: string;
  /** Solid Tailwind bg-color class for dots / left-borders */
  dotColor: string;
  /** Solid Tailwind border-color class for left-borders */
  borderColor: string;
  /** Specific Tailwind class for left border color (e.g. border-l-pink-500) - needed for JIT detection */
  leftBorderColor: string;
  /** Badge-style Tailwind classes (bg + text + hover) */
  badgeColor: string;
  /** Hex color for inline styles (robust against Tailwind purging) */
  hexColor: string;
}

/**
 * Canonical priority list, ordered from highest to lowest.
 */
export const PRIORITIES: PriorityDef[] = [
  { key: 'unbreak', numericValue: 100, label: '紧急',   shortLabel: 'P1', dotColor: 'bg-red-700',     borderColor: 'border-red-700',     leftBorderColor: 'border-l-red-700',     badgeColor: 'bg-red-100 text-red-800 hover:bg-red-200',       hexColor: '#b91c1c' },
  { key: 'triage',  numericValue: 90,  label: '需分配', shortLabel: 'P2', dotColor: 'bg-orange-500',  borderColor: 'border-orange-500',  leftBorderColor: 'border-l-orange-500',  badgeColor: 'bg-orange-100 text-orange-700 hover:bg-orange-200', hexColor: '#f97316' },
  { key: 'high',    numericValue: 80,  label: '高',     shortLabel: 'P3', dotColor: 'bg-pink-500',    borderColor: 'border-pink-500',    leftBorderColor: 'border-l-pink-500',    badgeColor: 'bg-pink-100 text-pink-700 hover:bg-pink-200',     hexColor: '#ec4899' },
  { key: 'normal',  numericValue: 50,  label: '普通',   shortLabel: 'P4', dotColor: 'bg-slate-600',   borderColor: 'border-slate-600',   leftBorderColor: 'border-l-slate-600',   badgeColor: 'bg-slate-100 text-slate-700 hover:bg-slate-200',    hexColor: '#475569' },
  { key: 'low',     numericValue: 25,  label: '低',     shortLabel: 'P5', dotColor: 'bg-slate-400',   borderColor: 'border-slate-400',   leftBorderColor: 'border-l-slate-400',   badgeColor: 'bg-slate-100 text-slate-600 hover:bg-slate-200',    hexColor: '#94a3b8' },
  { key: 'wish',    numericValue: 0,   label: '愿望',   shortLabel: 'P6', dotColor: 'bg-slate-300',   borderColor: 'border-slate-300',   leftBorderColor: 'border-l-slate-300',   badgeColor: 'bg-slate-50 text-slate-500 hover:bg-slate-100',     hexColor: '#cbd5e1' },
];

/** Lookup by Conduit keyword (e.g. 'high') */
export const PRIORITY_BY_KEY: Record<string, PriorityDef> =
  Object.fromEntries(PRIORITIES.map(p => [p.key, p]));

/** Lookup by numeric value (e.g. 100) */
export const PRIORITY_BY_VALUE: Record<number, PriorityDef> =
  Object.fromEntries(PRIORITIES.map(p => [p.numericValue, p]));

/** Map numeric-string → keyword (e.g. '100' → 'unbreak'). Used by API routes. */
export const NUMERIC_TO_KEY: Record<string, string> =
  Object.fromEntries(PRIORITIES.map(p => [String(p.numericValue), p.key]));

/** Set of valid keyword strings for quick validation */
export const VALID_PRIORITY_KEYS = new Set(PRIORITIES.map(p => p.key));

/**
 * Get the solid dot-color class for a numeric priority value.
 * Falls back to slate for unknown values.
 */
export function getPriorityDotColor(numericValue: number | undefined): string {
  if (numericValue === undefined) return 'bg-slate-200';
  return PRIORITY_BY_VALUE[numericValue]?.dotColor ?? 'bg-slate-200';
}

/**
 * Get the solid border-color class for a numeric priority value.
 * Falls back to slate for unknown values.
 */
export function getPriorityBorderColor(numericValue: number | undefined): string {
  if (numericValue === undefined) return 'border-slate-200';
  return PRIORITY_BY_VALUE[numericValue]?.borderColor ?? 'border-slate-200';
}

/**
 * Get the specific border-l-* class for a numeric priority value.
 * Explicitly returns full Tailwind classes to ensure JIT detection.
 */
export function getPriorityLeftBorderColor(numericValue: number | undefined): string {
  if (numericValue === undefined) return 'border-l-slate-200';
  return PRIORITY_BY_VALUE[numericValue]?.leftBorderColor ?? 'border-l-slate-200';
}

/**
 * Get the hex color string for a numeric priority value.
 * Useful for inline styles when Tailwind classes might be purged or fail.
 */
export function getPriorityHexColor(numericValue: number | undefined): string {
  if (numericValue === undefined) return '#e2e8f0'; // slate-200
  return PRIORITY_BY_VALUE[numericValue]?.hexColor ?? '#e2e8f0';
}
