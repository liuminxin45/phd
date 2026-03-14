import fs from 'fs';
import { ConduitClient } from '@/lib/conduit/client';
import { readLlmConfig } from '@/lib/llm/config';
import { callLlm, normalizeLlmUrl } from '@/lib/llm/client';
import type {
  ExportedComment,
  ExportedTaskItem,
  TaskExportJobState,
  TaskExportResult,
  TaskExportResultGroup,
  TaskExportScope,
  TaskExportStage,
  TaskExportTaskIssue,
} from '@/lib/tasks/export/types';
import {
  getResultJsonPath,
  getResultMarkdownPath,
  getTaskExportDownloadName,
  getTaskExportJob,
  markTaskExportJobDone,
  markTaskExportJobError,
  markTaskExportJobStarted,
  transitionTaskExportJob,
  updateTaskExportJob,
} from '@/lib/tasks/export/store';

type TaskRecord = {
  id: number;
  phid: string;
  fields: {
    name?: string;
    description?: string | { raw?: string };
    dateCreated?: number;
  };
};

type TransactionRecord = {
  id: number;
  phid: string;
  authorPHID?: string;
  dateCreated?: number;
  comments?: Array<{ content?: { raw?: string } }>;
};

type RawComment = {
  phid: string;
  authorPHID: string;
  dateCreated: number;
  content: string;
};

type TaskBaseItem = {
  taskId: number;
  title: string;
  description: string;
  createdAtUnix: number;
  comments: ExportedComment[];
};

type LlmOptimizationResult = {
  optimizedDescription?: string;
  optimizedCommentHistory?: ExportedComment[];
  keyPoints?: string[];
};

function mustGetConduitClient(): ConduitClient {
  const host = process.env.PHA_HOST;
  const token = process.env.PHA_TOKEN;
  if (!host || !token) {
    throw new Error('Server configuration error: missing PHA_HOST or PHA_TOKEN');
  }
  return new ConduitClient(host, token);
}

async function mapLimit<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runOne = async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: safeConcurrency }, runOne));
  return results;
}

function normalizeDescription(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && typeof (value as { raw?: unknown }).raw === 'string') {
    return String((value as { raw?: string }).raw || '').trim();
  }
  return '';
}

function cleanCommentText(raw: string): string {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';
  const collapsed = text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  if (!collapsed) return '';

  const lowValue = new Set(['ok', '好的', '收到', '+1', '👍', 'done', 'lgtm']);
  if (lowValue.has(collapsed.toLowerCase())) return '';
  if (/^[\s\-*#>+=.]{1,8}$/.test(collapsed)) return '';
  if (/^this comment has been deleted\.?$/i.test(collapsed)) return '';
  return collapsed;
}

function extractNormalizedComments(transactions: TransactionRecord[]): RawComment[] {
  const commentTransactions = transactions
    .filter((t) => Array.isArray(t.comments) && t.comments.length > 0)
    .slice()
    .sort((a, b) => Number(a.dateCreated || 0) - Number(b.dateCreated || 0));

  const commentOverrides = new Map<string, { kind: 'edit' | 'delete'; text: string }>();
  const hiddenTransactionPHIDs = new Set<string>();
  const deletedTargetPHIDs = new Set<string>();

  for (const tx of commentTransactions) {
    for (const c of tx.comments || []) {
      const raw = c?.content?.raw || '';
      const editMatch = raw.match(/^\[phabdash-edit:(PHID-XACT-[^\]]+)\]\s*\n([\s\S]*)$/);
      if (editMatch) {
        commentOverrides.set(editMatch[1], { kind: 'edit', text: (editMatch[2] || '').trim() });
        hiddenTransactionPHIDs.add(tx.phid);
        continue;
      }
      const deleteMatch = raw.match(/^\[phabdash-delete:(PHID-XACT-[^\]]+)\]\s*\n([\s\S]*)$/);
      if (deleteMatch) {
        commentOverrides.set(deleteMatch[1], { kind: 'delete', text: '' });
        hiddenTransactionPHIDs.add(tx.phid);
        deletedTargetPHIDs.add(deleteMatch[1]);
      }
    }
  }

  return commentTransactions
    .filter((tx) => !hiddenTransactionPHIDs.has(tx.phid) && !deletedTargetPHIDs.has(tx.phid))
    .map((tx) => {
      const originalText = tx.comments?.[0]?.content?.raw || '';
      const override = commentOverrides.get(tx.phid);
      const effectiveText = cleanCommentText(override ? override.text : originalText);
      return {
        phid: tx.phid,
        authorPHID: tx.authorPHID || '',
        dateCreated: Number(tx.dateCreated || 0),
        content: effectiveText,
      };
    })
    .filter((c) => !!c.content);
}

function getGroupKey(scope: TaskExportScope, createdAtUnix: number): string {
  if (scope === 'all') return 'ALL';
  const d = new Date(createdAtUnix * 1000);
  const year = d.getUTCFullYear();
  if (scope === 'year') return String(year);
  const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

function toGroupLabel(key: string): string {
  if (key === 'ALL') return '全部任务';
  if (/^\d{4}-Q[1-4]$/.test(key)) return key;
  return `${key} 年`;
}

function dateText(unix: number): string {
  if (!unix) return '';
  return new Date(unix * 1000).toISOString();
}

function buildFallbackKeyPoints(task: { title: string; description: string; comments: ExportedComment[] }): string[] {
  const points: string[] = [];
  if (task.title.trim()) points.push(`任务主题：${task.title.trim()}`);
  const firstDescLine = task.description.split(/\n+/).map((line) => line.trim()).find(Boolean);
  if (firstDescLine) points.push(`描述重点：${firstDescLine.slice(0, 160)}`);
  const latestComment = task.comments[task.comments.length - 1];
  if (latestComment?.content) {
    points.push(`最近动态：${latestComment.content.slice(0, 160)}`);
  }
  if (points.length === 0) {
    points.push('该任务暂无可提炼的有效上下文。');
  }
  return points.slice(0, 5);
}

function toMarkdown(result: TaskExportResult): string {
  const lines: string[] = [];
  lines.push('# 任务导出报告');
  lines.push('');
  lines.push(`- 导出时间: ${result.generatedAt}`);
  lines.push(`- 责任人: ${result.assignee.name || result.assignee.phid}`);
  lines.push(`- 导出范围: ${result.scope}`);
  lines.push(`- 任务总数: ${result.summary.totalTasks}`);
  lines.push(`- LLM 调用: ${result.summary.llmInvoked}（失败 ${result.summary.llmFailed}，跳过 ${result.summary.llmSkipped}）`);
  lines.push('');

  for (const group of result.groups) {
    lines.push(`## ${group.label} (${group.taskCount})`);
    lines.push('');
    for (const task of group.tasks) {
      lines.push(`### T${task.taskId} ${task.title || '(未导出标题)'}`);
      lines.push('');
      lines.push(`- 创建时间: ${task.createdAt}`);
      lines.push('');

      lines.push('#### 描述');
      lines.push('');
      lines.push(task.description || '(未导出描述)');
      lines.push('');

      lines.push('#### 评论历史（优化后）');
      lines.push('');
      if (task.optimizedCommentHistory.length === 0) {
        lines.push('- (未导出评论或无有效评论)');
      } else {
        for (const c of task.optimizedCommentHistory) {
          lines.push(`- [${c.date}] ${c.author}: ${c.content}`);
        }
      }
      lines.push('');

      lines.push('#### 任务要点');
      lines.push('');
      if (task.keyPoints.length === 0) {
        lines.push('- (未生成要点)');
      } else {
        for (const point of task.keyPoints) {
          lines.push(`- ${point}`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  options: { label: string; timeoutMs?: number; retries?: number; retryDelayMs?: number },
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 25_000;
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await Promise.race<T>([
        fn(),
        new Promise<T>((_, reject) => {
          setTimeout(() => reject(new Error(`${options.label} timeout (${timeoutMs}ms)`)), timeoutMs);
        }),
      ]);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await delay(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${options.label} failed`);
}

async function fetchAllTasksByAssignee(
  client: ConduitClient,
  assigneePHID: string,
  onProgress: (count: number, cursorExists: boolean, page: number) => void,
  onWarning: (message: string) => void,
): Promise<TaskRecord[]> {
  const all: TaskRecord[] = [];
  let after: string | null = null;
  let page = 0;
  const seenAfter = new Set<string>();

  while (true) {
    const result = await withTimeoutAndRetry(async () => {
      return client.search<{
        data?: TaskRecord[];
        cursor?: { after?: string | null };
      }>(
        'maniphest.search',
        { assigned: [assigneePHID] },
        {},
        100,
        after,
      );
    }, {
      label: 'fetch_tasks_page',
      timeoutMs: 30_000,
      retries: 3,
      retryDelayMs: 700,
    });

    page += 1;
    const batch = result.data || [];
    all.push(...batch);
    const nextAfter = result.cursor?.after || null;
    onProgress(all.length, !!nextAfter, page);

    if (!nextAfter) break;
    if (seenAfter.has(nextAfter)) {
      onWarning(`检测到重复游标（${nextAfter.slice(0, 24)}...），已提前结束分页以避免卡死`);
      break;
    }
    seenAfter.add(nextAfter);
    after = nextAfter;

    if (page >= 3000) {
      onWarning('分页超过 3000 页，已提前停止');
      break;
    }
  }
  return all;
}

async function fetchTransactionsForTask(client: ConduitClient, taskPHID: string): Promise<TransactionRecord[]> {
  const all: TransactionRecord[] = [];
  let after: string | null = null;
  const seenAfter = new Set<string>();

  while (true) {
    const result = await withTimeoutAndRetry(async () => {
      return client.call<{
        data?: TransactionRecord[];
        cursor?: { after?: string | null };
      }>('transaction.search', {
        objectIdentifier: taskPHID,
        limit: 100,
        ...(after ? { after } : {}),
      });
    }, {
      label: `fetch_transactions_${taskPHID}`,
      timeoutMs: 25_000,
      retries: 2,
      retryDelayMs: 500,
    });

    const batch = result.data || [];
    all.push(...batch);
    const nextAfter = result.cursor?.after || null;
    if (!nextAfter) break;
    if (seenAfter.has(nextAfter)) break;
    seenAfter.add(nextAfter);
    after = nextAfter;
  }
  return all;
}

async function resolveUserNames(
  client: ConduitClient,
  phids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(phids.filter(Boolean)));
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const result = await withTimeoutAndRetry(async () => {
      return client.search<{
        data?: Array<{
          phid?: string;
          fields?: { realName?: string; username?: string };
        }>;
      }>('user.search', { phids: chunk }, {}, 100, null);
    }, {
      label: 'resolve_user_names',
      timeoutMs: 20_000,
      retries: 2,
      retryDelayMs: 400,
    });
    for (const user of result.data || []) {
      const phid = String(user.phid || '');
      if (!phid) continue;
      const name = String(user.fields?.realName || user.fields?.username || phid);
      map.set(phid, name);
    }
  }
  return map;
}

async function optimizeTaskWithLlm(input: {
  title: string;
  description: string;
  comments: ExportedComment[];
  optimizeDescription: boolean;
  optimizeComments: boolean;
  generateKeyPoints: boolean;
}): Promise<LlmOptimizationResult> {
  const llm = readLlmConfig();
  if (!llm.baseUrl || !llm.apiKey || !llm.model) {
    throw new Error('LLM 未配置');
  }
  const llmUrl = normalizeLlmUrl(llm.baseUrl);

  const serializedComments = input.comments
    .map((c, idx) => `[${idx + 1}] [${c.date}] [${c.author}] ${c.content}`)
    .join('\n');

  const maxInputChars = 12000;
  const commentPayload = serializedComments.length > maxInputChars
    ? `${serializedComments.slice(0, 6000)}\n...\n${serializedComments.slice(-5500)}`
    : serializedComments;

  const parsed = await callLlm<{
    optimizedDescription?: string;
    optimizedCommentHistory?: Array<{ author?: string; date?: string; content?: string }>;
    keyPoints?: string[];
  }>({
    url: llmUrl,
    apiKey: llm.apiKey,
    model: llm.model,
    systemPrompt: [
      '你是任务信息整理助手。',
      '请只返回 JSON，不要返回额外文字。',
      '必须保持事实一致，不得编造。',
    ].join('\n'),
    userPrompt: [
      '请按以下要求输出 JSON：',
      '{',
      '  "optimizedDescription": "..." (可选),',
      '  "optimizedCommentHistory": [{ "author": "...", "date": "...", "content": "..." }] (可选),',
      '  "keyPoints": ["...", "..."] (可选)',
      '}',
      '',
      `是否优化描述: ${input.optimizeDescription ? '是' : '否'}`,
      `是否优化评论: ${input.optimizeComments ? '是' : '否'}`,
      `是否生成要点: ${input.generateKeyPoints ? '是' : '否'}`,
      '',
      '规则:',
      '1) 优化描述时，只润色可读性，不改变事实。',
      '2) 优化评论时，保持时序，去除无意义噪声。',
      '3) 生成要点时，输出 3-6 条。',
      '',
      `任务标题: ${input.title || '(无标题)'}`,
      `任务描述: ${input.description || '(无描述)'}`,
      '评论历史:',
      commentPayload || '(无评论)',
    ].join('\n'),
    maxTokens: Math.min(llm.maxTokens || 1600, 2200),
    temperature: 0.2,
    topP: llm.topP,
  });

  const result: LlmOptimizationResult = {};

  if (input.optimizeDescription && typeof parsed.optimizedDescription === 'string') {
    const desc = parsed.optimizedDescription.trim();
    if (desc) result.optimizedDescription = desc;
  }

  if (input.optimizeComments) {
    const normalizedComments: ExportedComment[] = Array.isArray(parsed.optimizedCommentHistory)
      ? parsed.optimizedCommentHistory
          .map((c) => ({
            author: String(c?.author || '').trim(),
            date: String(c?.date || '').trim(),
            content: cleanCommentText(String(c?.content || '')),
          }))
          .filter((c) => !!c.content)
      : [];
    result.optimizedCommentHistory = normalizedComments;
  }

  if (input.generateKeyPoints) {
    const keyPoints = Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints.map((p) => String(p || '').trim()).filter(Boolean).slice(0, 8)
      : [];
    result.keyPoints = keyPoints;
  }

  return result;
}

function computeEtaSeconds(startedAt: string | undefined, progressPercent: number): number | undefined {
  if (!startedAt || progressPercent <= 0 || progressPercent >= 100) return undefined;
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
  if (!Number.isFinite(elapsed) || elapsed <= 0) return undefined;
  const remainingRatio = (100 - progressPercent) / progressPercent;
  const eta = Math.round(elapsed * remainingRatio);
  return eta > 0 ? eta : undefined;
}

function buildResult(scope: TaskExportScope, job: TaskExportJobState, tasks: ExportedTaskItem[]): TaskExportResult {
  const grouped = new Map<string, ExportedTaskItem[]>();
  for (const task of tasks) {
    const key = getGroupKey(scope, task.createdAtUnix);
    const list = grouped.get(key) || [];
    list.push(task);
    grouped.set(key, list);
  }

  const sortedGroupKeys = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));
  const groups: TaskExportResultGroup[] = sortedGroupKeys.map((key) => {
    const list = (grouped.get(key) || []).slice().sort((a, b) => b.createdAtUnix - a.createdAtUnix);
    return {
      key,
      label: toGroupLabel(key),
      taskCount: list.length,
      tasks: list,
    };
  });

  return {
    scope,
    generatedAt: new Date().toISOString(),
    assignee: {
      phid: job.assigneePHID,
      name: job.assigneeName,
    },
    summary: {
      totalTasks: tasks.length,
      llmInvoked: tasks.filter((t) => t.llm.invoked).length,
      llmFailed: tasks.filter((t) => t.llm.invoked && t.llm.degraded).length,
      llmSkipped: tasks.filter((t) => !t.llm.invoked).length,
    },
    groups,
  };
}

function appendIssue(
  list: TaskExportTaskIssue[],
  issue: TaskExportTaskIssue,
): TaskExportTaskIssue[] {
  return [...list, issue];
}

function updateProgress(jobId: string, input: {
  stage: TaskExportStage;
  stageLabel: string;
  message: string;
  progressPercent: number;
}) {
  const job = getTaskExportJob(jobId);
  const eta = computeEtaSeconds(job?.startedAt, input.progressPercent);
  transitionTaskExportJob(jobId, {
    stage: input.stage,
    stageLabel: input.stageLabel,
    message: input.message,
    progressPercent: Math.max(0, Math.min(100, Math.round(input.progressPercent))),
    etaSeconds: eta,
  });
}

export async function runTaskExportJob(jobId: string): Promise<void> {
  const seed = getTaskExportJob(jobId);
  if (!seed) return;

  const skippedTasks = [...seed.skippedTasks];
  const failedTasks = [...seed.failedTasks];
  const warnings = [...seed.warnings];

  const pushSkipped = (taskId: number, title: string, stage: TaskExportStage, reason: string) => {
    skippedTasks.push({ taskId, title, stage, reason });
  };
  const pushFailed = (taskId: number, title: string, stage: TaskExportStage, reason: string) => {
    failedTasks.push({ taskId, title, stage, reason });
  };
  const pushWarning = (message: string) => {
    warnings.push(message);
    updateTaskExportJob(jobId, { warnings: [...warnings] });
  };

  try {
    markTaskExportJobStarted(jobId);
    updateProgress(jobId, {
      stage: 'fetch_tasks',
      stageLabel: '拉取任务',
      message: '正在拉取责任人的全部历史任务...',
      progressPercent: 2,
    });

    const client = mustGetConduitClient();
    const tasks = await fetchAllTasksByAssignee(
      client,
      seed.assigneePHID,
      (count, hasMore, page) => {
        const percent = hasMore ? Math.min(20, 2 + Math.floor(page * 1.8)) : 20;
        updateTaskExportJob(jobId, { metrics: { fetchedTasks: count } });
        updateProgress(jobId, {
          stage: 'fetch_tasks',
          stageLabel: '拉取任务',
          message: `已拉取 ${count} 条任务（第 ${page} 页）${hasMore ? '，继续分页中...' : ''}`,
          progressPercent: percent,
        });
      },
      pushWarning,
    );

    updateTaskExportJob(jobId, {
      metrics: { totalTasks: tasks.length, fetchedTasks: tasks.length },
    });

    if (tasks.length === 0) {
      const result: TaskExportResult = buildResult(seed.scope, seed, []);
      const jsonPath = getResultJsonPath(jobId);
      const mdPath = getResultMarkdownPath(jobId);
      fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
      fs.writeFileSync(mdPath, toMarkdown(result), 'utf-8');
      markTaskExportJobDone(jobId, {
        files: {
          jsonFilePath: jsonPath,
          markdownFilePath: mdPath,
          jsonFileName: getTaskExportDownloadName(seed, 'json'),
          markdownFileName: getTaskExportDownloadName(seed, 'md'),
        },
        message: '导出完成（无任务）',
      });
      return;
    }

    updateProgress(jobId, {
      stage: 'fetch_comments',
      stageLabel: '拉取评论',
      message: '正在拉取任务评论与历史...',
      progressPercent: 22,
    });

    const txList = await mapLimit(tasks, 6, async (task, idx) => {
      try {
        const tx = await fetchTransactionsForTask(client, task.phid);
        return tx;
      } catch (error) {
        pushFailed(task.id, String(task.fields?.name || ''), 'fetch_comments', error instanceof Error ? error.message : '评论拉取失败');
        return [] as TransactionRecord[];
      } finally {
        const finished = idx + 1;
        if (finished % 3 === 0 || finished === tasks.length) {
          const progress = 20 + Math.round((finished / tasks.length) * 30);
          updateTaskExportJob(jobId, {
            metrics: { commentsFetched: finished },
            failedTasks: [...failedTasks],
          });
          updateProgress(jobId, {
            stage: 'fetch_comments',
            stageLabel: '拉取评论',
            message: `已拉取 ${finished}/${tasks.length} 条任务评论`,
            progressPercent: progress,
          });
        }
      }
    });

    const authorPhids: string[] = [];
    const normalizedByTask = txList.map((tx) => {
      const normalized = extractNormalizedComments(tx);
      for (const c of normalized) {
        if (c.authorPHID) authorPhids.push(c.authorPHID);
      }
      return normalized;
    });
    const userNameMap = await resolveUserNames(client, authorPhids);

    const baseItems: TaskBaseItem[] = tasks.map((task, idx) => {
      const comments = normalizedByTask[idx].map((c): ExportedComment => ({
        author: userNameMap.get(c.authorPHID) || c.authorPHID || 'Unknown User',
        date: dateText(c.dateCreated),
        content: c.content,
      }));

      return {
        taskId: Number(task.id),
        title: String(task.fields?.name || '').trim(),
        description: normalizeDescription(task.fields?.description),
        createdAtUnix: Number(task.fields?.dateCreated || 0),
        comments,
      };
    });

    updateProgress(jobId, {
      stage: 'llm_optimize',
      stageLabel: 'LLM 优化',
      message: '正在执行内容优化与要点提炼...',
      progressPercent: 52,
    });

    const currentJob = getTaskExportJob(jobId) || seed;
    const options = currentJob.options || {
      includeTitle: true,
      includeDescription: true,
      descriptionUseLlm: false,
      includeComments: true,
      commentsUseLlm: true,
    };
    const llmConfigured = (() => {
      const cfg = readLlmConfig();
      return !!(cfg.baseUrl && cfg.apiKey && cfg.model);
    })();

    const llmCandidates = baseItems.filter((item) => {
      const needsDesc = options.includeDescription && options.descriptionUseLlm && item.description.length > 0;
      const commentsChars = item.comments.reduce((acc, c) => acc + c.content.length, 0);
      const needsComments = options.includeComments && options.commentsUseLlm && commentsChars >= 30;
      return needsDesc || needsComments;
    });

    updateTaskExportJob(jobId, {
      metrics: {
        llmTotal: llmConfigured ? llmCandidates.length : 0,
      },
    });

    let llmDone = 0;
    let llmFailed = 0;
    let skippedCount = 0;

    const exported = await mapLimit(baseItems, 3, async (item, idx): Promise<ExportedTaskItem> => {
      const includeTitle = options.includeTitle;
      const includeDescription = options.includeDescription;
      const includeComments = options.includeComments;
      const wantsDescLlm = includeDescription && options.descriptionUseLlm;
      const wantsCommentLlm = includeComments && options.commentsUseLlm;
      const wantsKeyPoints = includeComments && options.commentsUseLlm;

      let title = includeTitle ? item.title : '';
      let description = includeDescription ? item.description : '';
      let comments = includeComments ? item.comments : [];
      let keyPoints: string[] = [];

      const commentsChars = item.comments.reduce((acc, c) => acc + c.content.length, 0);
      const needsDescLlm = wantsDescLlm && description.length > 0;
      const needsCommentLlm = wantsCommentLlm && commentsChars >= 30;
      const shouldUseLlm = llmConfigured && (needsDescLlm || needsCommentLlm || wantsKeyPoints);

      let llmMeta: ExportedTaskItem['llm'] = {
        invoked: false,
        degraded: false,
      };

      if (!includeComments) {
        comments = [];
      } else if (!options.commentsUseLlm) {
        keyPoints = [];
      } else if (comments.length === 0) {
        keyPoints = [];
        skippedCount += 1;
        pushSkipped(item.taskId, item.title, 'llm_optimize', '未生成要点：评论为空');
      }

      if (!llmConfigured && (wantsDescLlm || wantsCommentLlm)) {
        if (wantsDescLlm || wantsCommentLlm) {
          skippedCount += 1;
          pushSkipped(item.taskId, item.title, 'llm_optimize', 'LLM 未配置，已降级为规则处理');
        }
        llmMeta = {
          invoked: false,
          degraded: false,
          reason: 'LLM 未配置',
        };
      } else if (!shouldUseLlm) {
        const reason = !includeComments
          ? '未导出评论，跳过 LLM'
          : (!wantsCommentLlm && !wantsDescLlm)
              ? '未启用 LLM 处理'
              : '评论过短或描述为空，跳过 LLM';
        if (wantsDescLlm || wantsCommentLlm || wantsKeyPoints) {
          skippedCount += 1;
          pushSkipped(item.taskId, item.title, 'llm_optimize', reason);
        }
        if (wantsKeyPoints && comments.length > 0) {
          keyPoints = buildFallbackKeyPoints({ title: item.title, description: item.description, comments });
        }
        llmMeta = {
          invoked: false,
          degraded: false,
          reason,
        };
      } else {
        try {
          const llmOutput = await optimizeTaskWithLlm({
            title: item.title,
            description: item.description,
            comments,
            optimizeDescription: needsDescLlm,
            optimizeComments: needsCommentLlm,
            generateKeyPoints: wantsKeyPoints,
          });
          if (needsDescLlm && llmOutput.optimizedDescription) {
            description = llmOutput.optimizedDescription;
          }
          if (needsCommentLlm && llmOutput.optimizedCommentHistory && llmOutput.optimizedCommentHistory.length > 0) {
            comments = llmOutput.optimizedCommentHistory;
          }
          if (wantsKeyPoints) {
            keyPoints = (llmOutput.keyPoints || []).length > 0
              ? (llmOutput.keyPoints || [])
              : buildFallbackKeyPoints({ title: item.title, description: item.description, comments });
          }
          llmDone += 1;
          llmMeta = { invoked: true, degraded: false };
        } catch (error) {
          llmFailed += 1;
          const reason = error instanceof Error ? error.message : 'LLM 请求失败';
          pushFailed(item.taskId, item.title, 'llm_optimize', reason);
          if (wantsKeyPoints && comments.length > 0) {
            keyPoints = buildFallbackKeyPoints({ title: item.title, description: item.description, comments });
          }
          llmMeta = { invoked: true, degraded: true, reason };
        }
      }

      const doneCount = idx + 1;
      if (doneCount % 2 === 0 || doneCount === baseItems.length) {
        const progress = 50 + Math.round((doneCount / baseItems.length) * 40);
        updateTaskExportJob(jobId, {
          metrics: {
            llmDone,
            llmFailed,
            skippedLlm: skippedCount,
            processedTasks: doneCount,
          },
          skippedTasks: [...skippedTasks],
          failedTasks: [...failedTasks],
        });
        updateProgress(jobId, {
          stage: 'llm_optimize',
          stageLabel: 'LLM 优化',
          message: `已处理 ${doneCount}/${baseItems.length} 条任务`,
          progressPercent: progress,
        });
      }

      return {
        taskId: item.taskId,
        title,
        description,
        createdAt: dateText(item.createdAtUnix),
        createdAtUnix: item.createdAtUnix,
        optimizedCommentHistory: comments,
        keyPoints,
        llm: llmMeta,
      };
    });

    updateProgress(jobId, {
      stage: 'assemble',
      stageLabel: '组装导出',
      message: '正在生成 JSON 与 Markdown 文件...',
      progressPercent: 94,
    });

    const current = getTaskExportJob(jobId) || seed;
    const result = buildResult(seed.scope, current, exported);
    const jsonPath = getResultJsonPath(jobId);
    const mdPath = getResultMarkdownPath(jobId);

    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
    fs.writeFileSync(mdPath, toMarkdown(result), 'utf-8');

    const finalJob = getTaskExportJob(jobId) || current;
    updateTaskExportJob(jobId, {
      skippedTasks: [...skippedTasks],
      failedTasks: [...failedTasks],
      warnings: [...warnings],
      metrics: {
        skippedLlm: skippedCount,
      },
    });
    markTaskExportJobDone(jobId, {
      files: {
        jsonFilePath: jsonPath,
        markdownFilePath: mdPath,
        jsonFileName: getTaskExportDownloadName(finalJob, 'json'),
        markdownFileName: getTaskExportDownloadName(finalJob, 'md'),
      },
      message: `导出完成，共 ${exported.length} 条任务`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown export error';
    try {
      markTaskExportJobError(jobId, message);
    } catch (markError) {
      console.error('[tasks/export/pipeline] failed to mark job error:', markError);
    }
  }
}
