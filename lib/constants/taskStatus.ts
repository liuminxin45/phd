/**
 * Task Status Constants
 * 
 * This file contains the mapping between English status values (used in code/API)
 * and Chinese display names (used in UI).
 * 
 * Usage:
 * - Use English status values for logic and API requests
 * - Use getTaskStatusName() to display Chinese names in UI
 */

export const TASK_STATUS = {
  EXCLUDED: 'excluded',
  INVALID: 'invalid',
  NOT_BEGIN: 'notbegin',
  OPEN: 'open',
  RESOLVED: 'resolved',
  SPITE: 'spite',
  WONTFIX: 'wontfix',
} as const;

export type TaskStatusValue = typeof TASK_STATUS[keyof typeof TASK_STATUS];

/**
 * Task Status Display Names (Chinese)
 * Maps English status values to Chinese display names
 */
export const TASK_STATUS_NAMES: Record<string, string> = {
  excluded: '已完成(不加入统计)',
  invalid: '删除/中止',
  notbegin: '未开始',
  open: '进行中',
  resolved: '已完成',
  spite: '暂停',
  wontfix: '进行中(不加入统计)',
};

/**
 * Get Chinese display name for a task status
 * @param statusValue - English status value from API
 * @returns Chinese display name, or the original value if not found
 */
export function getTaskStatusName(statusValue: string): string {
  return TASK_STATUS_NAMES[statusValue] || statusValue;
}

/**
 * Check if a status represents a completed task
 * @param statusValue - English status value
 * @returns true if the task is completed
 */
export function isTaskCompleted(statusValue: string): boolean {
  return statusValue === TASK_STATUS.RESOLVED || statusValue === TASK_STATUS.EXCLUDED;
}

/**
 * Check if a status represents an in-progress task
 * @param statusValue - English status value
 * @returns true if the task is in progress
 */
export function isTaskInProgress(statusValue: string): boolean {
  return statusValue === TASK_STATUS.OPEN || statusValue === TASK_STATUS.WONTFIX;
}

/**
 * Check if a status represents a not-started task
 * @param statusValue - English status value
 * @returns true if the task has not started
 */
export function isTaskNotStarted(statusValue: string): boolean {
  return statusValue === TASK_STATUS.NOT_BEGIN;
}

/**
 * Check if a status represents a paused task
 * @param statusValue - English status value
 * @returns true if the task is paused
 */
export function isTaskPaused(statusValue: string): boolean {
  return statusValue === TASK_STATUS.SPITE;
}

/**
 * Check if a status represents a cancelled/invalid task
 * @param statusValue - English status value
 * @returns true if the task is cancelled or invalid
 */
export function isTaskCancelled(statusValue: string): boolean {
  return statusValue === TASK_STATUS.INVALID;
}

/**
 * Get all available task statuses
 * @returns Array of all status values
 */
export function getAllTaskStatuses(): string[] {
  return Object.values(TASK_STATUS);
}

/**
 * Get status color for UI display
 * @param statusValue - English status value
 * @returns Tailwind color class
 */
export function getTaskStatusColor(statusValue: string): string {
  switch (statusValue) {
    case TASK_STATUS.RESOLVED:
    case TASK_STATUS.EXCLUDED:
      return 'text-green-700 bg-green-100';
    case TASK_STATUS.OPEN:
    case TASK_STATUS.WONTFIX:
      return 'text-blue-700 bg-blue-100';
    case TASK_STATUS.NOT_BEGIN:
      return 'text-neutral-700 bg-neutral-100';
    case TASK_STATUS.SPITE:
      return 'text-orange-700 bg-orange-100';
    case TASK_STATUS.INVALID:
      return 'text-red-700 bg-red-100';
    default:
      return 'text-neutral-700 bg-neutral-100';
  }
}
