export type TaskExportScope = 'all' | 'year' | 'quarter';

export type TaskExportJobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export type TaskExportStage =
  | 'queued'
  | 'fetch_tasks'
  | 'fetch_comments'
  | 'llm_optimize'
  | 'assemble'
  | 'completed'
  | 'failed';

export interface TaskExportJobMetrics {
  totalTasks: number;
  fetchedTasks: number;
  commentsFetched: number;
  llmTotal: number;
  llmDone: number;
  llmFailed: number;
  skippedLlm: number;
  processedTasks: number;
}

export interface TaskExportOptions {
  includeTitle: boolean;
  includeDescription: boolean;
  descriptionUseLlm: boolean;
  includeComments: boolean;
  commentsUseLlm: boolean;
}

export interface TaskExportTaskIssue {
  taskId: number;
  title: string;
  stage: TaskExportStage;
  reason: string;
}

export interface TaskExportJobResultFiles {
  jsonFilePath: string;
  markdownFilePath: string;
  jsonFileName: string;
  markdownFileName: string;
}

export interface TaskExportJobState {
  jobId: string;
  scope: TaskExportScope;
  assigneePHID: string;
  assigneeName?: string;
  status: TaskExportJobStatus;
  stage: TaskExportStage;
  stageLabel: string;
  message: string;
  progressPercent: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
  metrics: TaskExportJobMetrics;
  warnings: string[];
  options: TaskExportOptions;
  skippedTasks: TaskExportTaskIssue[];
  failedTasks: TaskExportTaskIssue[];
  error?: string;
  etaSeconds?: number;
  files?: TaskExportJobResultFiles;
}

export interface ExportedComment {
  author: string;
  date: string;
  content: string;
}

export interface ExportedTaskItem {
  taskId: number;
  title: string;
  description: string;
  createdAt: string;
  createdAtUnix: number;
  optimizedCommentHistory: ExportedComment[];
  keyPoints: string[];
  llm: {
    invoked: boolean;
    degraded: boolean;
    reason?: string;
  };
}

export interface TaskExportResultGroup {
  key: string;
  label: string;
  taskCount: number;
  tasks: ExportedTaskItem[];
}

export interface TaskExportResult {
  scope: TaskExportScope;
  generatedAt: string;
  assignee: {
    phid: string;
    name?: string;
  };
  summary: {
    totalTasks: number;
    llmInvoked: number;
    llmFailed: number;
    llmSkipped: number;
  };
  groups: TaskExportResultGroup[];
}
