import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  TaskExportJobState,
  TaskExportScope,
  TaskExportStage,
  TaskExportJobStatus,
  TaskExportOptions,
} from '@/lib/tasks/export/types';

const EXPORT_ROOT_DIR = path.join(process.cwd(), '.cache', 'phabdash', 'task-exports');
const EXPORT_FILE_PREFIX = 'task-export';

const jobs = new Map<string, TaskExportJobState>();

function ensureExportDir(): void {
  if (!fs.existsSync(EXPORT_ROOT_DIR)) {
    fs.mkdirSync(EXPORT_ROOT_DIR, { recursive: true });
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function getStatePath(jobId: string): string {
  return path.join(EXPORT_ROOT_DIR, `${jobId}.state.json`);
}

export function getResultJsonPath(jobId: string): string {
  return path.join(EXPORT_ROOT_DIR, `${jobId}.result.json`);
}

export function getResultMarkdownPath(jobId: string): string {
  return path.join(EXPORT_ROOT_DIR, `${jobId}.result.md`);
}

function safeWriteJson(filePath: string, value: unknown): void {
  ensureExportDir();
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

function loadJobFromDisk(jobId: string): TaskExportJobState | null {
  ensureExportDir();
  const statePath = getStatePath(jobId);
  if (!fs.existsSync(statePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as TaskExportJobState;
    if (!parsed || typeof parsed !== 'object' || parsed.jobId !== jobId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistJob(job: TaskExportJobState): void {
  ensureExportDir();
  safeWriteJson(getStatePath(job.jobId), job);
}

export function createTaskExportJob(input: {
  assigneePHID: string;
  assigneeName?: string;
  scope: TaskExportScope;
  options?: Partial<TaskExportOptions>;
}): TaskExportJobState {
  const createdAt = nowIso();
  const jobId = `txp_${crypto.randomUUID().replace(/-/g, '')}`;
  const options: TaskExportOptions = {
    includeTitle: input.options?.includeTitle ?? true,
    includeDescription: input.options?.includeDescription ?? true,
    descriptionUseLlm: input.options?.descriptionUseLlm ?? false,
    includeComments: input.options?.includeComments ?? true,
    commentsUseLlm: input.options?.commentsUseLlm ?? true,
  };
  const state: TaskExportJobState = {
    jobId,
    scope: input.scope,
    assigneePHID: input.assigneePHID,
    assigneeName: input.assigneeName,
    status: 'queued',
    stage: 'queued',
    stageLabel: '已排队',
    message: '任务已创建，等待执行',
    progressPercent: 0,
    createdAt,
    updatedAt: createdAt,
    warnings: [],
    options,
    skippedTasks: [],
    failedTasks: [],
    metrics: {
      totalTasks: 0,
      fetchedTasks: 0,
      commentsFetched: 0,
      llmTotal: 0,
      llmDone: 0,
      llmFailed: 0,
      skippedLlm: 0,
      processedTasks: 0,
    },
  };
  jobs.set(jobId, state);
  persistJob(state);
  return state;
}

export function getTaskExportJob(jobId: string): TaskExportJobState | null {
  const inMemory = jobs.get(jobId);
  if (inMemory) return inMemory;
  const fromDisk = loadJobFromDisk(jobId);
  if (fromDisk) {
    jobs.set(jobId, fromDisk);
    return fromDisk;
  }
  return null;
}

export function updateTaskExportJob(
  jobId: string,
  patch: Omit<Partial<TaskExportJobState>, 'metrics'> & {
    metrics?: Partial<TaskExportJobState['metrics']>;
  },
): TaskExportJobState | null {
  const current = getTaskExportJob(jobId);
  if (!current) return null;
  const updated: TaskExportJobState = {
    ...current,
    ...patch,
    metrics: {
      ...current.metrics,
      ...(patch.metrics || {}),
    },
    warnings: patch.warnings ? [...patch.warnings] : current.warnings,
    updatedAt: nowIso(),
  };
  jobs.set(jobId, updated);
  persistJob(updated);
  return updated;
}

export function transitionTaskExportJob(
  jobId: string,
  input: {
    status?: TaskExportJobStatus;
    stage?: TaskExportStage;
    stageLabel?: string;
    message?: string;
    progressPercent?: number;
    etaSeconds?: number;
  },
): TaskExportJobState | null {
  return updateTaskExportJob(jobId, {
    status: input.status,
    stage: input.stage,
    stageLabel: input.stageLabel,
    message: input.message,
    progressPercent: input.progressPercent,
    etaSeconds: input.etaSeconds,
  });
}

export function markTaskExportJobStarted(jobId: string): TaskExportJobState | null {
  return updateTaskExportJob(jobId, {
    status: 'running',
    startedAt: nowIso(),
    message: '开始执行导出',
  });
}

export function markTaskExportJobDone(
  jobId: string,
  input: {
    files: TaskExportJobState['files'];
    message: string;
  },
): TaskExportJobState | null {
  return updateTaskExportJob(jobId, {
    status: 'done',
    stage: 'completed',
    stageLabel: '已完成',
    progressPercent: 100,
    finishedAt: nowIso(),
    message: input.message,
    files: input.files,
    etaSeconds: 0,
  });
}

export function markTaskExportJobError(jobId: string, message: string): TaskExportJobState | null {
  return updateTaskExportJob(jobId, {
    status: 'error',
    stage: 'failed',
    stageLabel: '失败',
    message: '导出失败',
    error: message,
    finishedAt: nowIso(),
    etaSeconds: undefined,
  });
}

export function getTaskExportDownloadName(job: TaskExportJobState, format: 'json' | 'md'): string {
  const safeAssignee = (job.assigneeName || job.assigneePHID || 'assignee')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 48);
  const scopePart = job.scope;
  const datePart = (job.finishedAt || job.updatedAt || nowIso()).slice(0, 10);
  const ext = format === 'json' ? 'json' : 'md';
  return `${EXPORT_FILE_PREFIX}_${safeAssignee}_${scopePart}_${datePart}.${ext}`;
}
