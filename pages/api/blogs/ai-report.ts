import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';
import { readLlmConfig } from '@/lib/llm/config';
import {
  buildGenerateReportPrompt,
  buildMergePolishPrompt,
  type TaskInfo,
  type ReportGenerationInput,
} from '@/lib/blog/ai-report-prompts';

/**
 * AI Weekly Report Generation API
 *
 * Flow:
 *   1. Search for user's tasks closed last week (completed)
 *   2. Search for user's open tasks (ongoing)
 *   3. Fetch task details including comments
 *   4. Use LLM to generate markdown report
 *   5. If manualNotes provided, merge and polish with LLM
 *   6. Return the final report
 */

interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * Get the date range for last week (Monday to Friday)
 */
function getLastWeekRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Calculate days back to last Monday
  const daysBack = day >= 6 || day === 0 ? (day === 0 ? 6 : day - 1) : day - 1 + 7;
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysBack);
  lastMonday.setHours(0, 0, 0, 0);

  const lastFriday = new Date(lastMonday);
  lastFriday.setDate(lastMonday.getDate() + 4);
  lastFriday.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
  };

  return {
    start: lastMonday,
    end: lastFriday,
    label: `${fmt(lastMonday)}-${fmt(lastFriday)}`,
  };
}

/**
 * Format date to Unix timestamp for Conduit API
 * Conduit expects integer timestamps for closedStart/closedEnd
 */
function formatDateForConduit(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Get user PHID by username
 */
async function getUserPHID(client: ConduitClient, username: string): Promise<string | null> {
  try {
    const result = await client.call<{ data: any[] }>('user.search', {
      constraints: {
        usernames: [username],
      },
    });

    if (result.data && result.data.length > 0) {
      return result.data[0].phid;
    }
    return null;
  } catch (error) {
    console.error('Failed to get user PHID:', error);
    return null;
  }
}

/**
 * Search for tasks closed by user in date range
 */
async function searchCompletedTasks(
  client: ConduitClient,
  userPHID: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  try {
    const result = await client.call<{ data: any[]; cursor: { after: string | null } }>('maniphest.search', {
      constraints: {
        assigned: [userPHID],
        closedStart: formatDateForConduit(startDate),
        closedEnd: formatDateForConduit(endDate),
        statuses: ['closed'],
      },
      attachments: {
        projects: true,
        columns: true,
      },
      limit: 100,
    });

    return result.data || [];
  } catch (error) {
    console.error('Failed to search completed tasks:', error);
    return [];
  }
}

/**
 * Search for open tasks assigned to user
 */
async function searchOngoingTasks(
  client: ConduitClient,
  userPHID: string
): Promise<any[]> {
  try {
    const result = await client.call<{ data: any[]; cursor: { after: string | null } }>('maniphest.search', {
      constraints: {
        assigned: [userPHID],
        statuses: ['open'],
      },
      attachments: {
        projects: true,
        columns: true,
      },
      limit: 100,
    });

    return result.data || [];
  } catch (error) {
    console.error('Failed to search ongoing tasks:', error);
    return [];
  }
}

/**
 * Fetch task comments/transactions
 */
async function fetchTaskComments(client: ConduitClient, taskPHID: string): Promise<string[]> {
  try {
    const result = await client.call<{ data: any[] }>('transaction.search', {
      objectIdentifier: taskPHID,
      limit: 50,
    });

    const comments: string[] = [];
    if (result.data) {
      for (const transaction of result.data) {
        const commentText = transaction?.comments?.[0]?.content?.raw;
        if (commentText && commentText.trim()) {
          comments.push(commentText.trim());
        }
      }
    }

    return comments;
  } catch (error) {
    console.error(`Failed to fetch comments for ${taskPHID}:`, error);
    return [];
  }
}

/**
 * Fetch project names for project PHIDs
 */
async function fetchProjectNames(
  client: ConduitClient,
  projectPHIDs: string[]
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();

  if (projectPHIDs.length === 0) {
    return nameMap;
  }

  try {
    // Remove duplicates
    const uniquePHIDs = [...new Set(projectPHIDs)];

    // Fetch in batches of 100
    const batchSize = 100;
    for (let i = 0; i < uniquePHIDs.length; i += batchSize) {
      const batch = uniquePHIDs.slice(i, i + batchSize);
      const result = await client.call<{ data: any[] }>('project.search', {
        constraints: {
          phids: batch,
        },
      });

      if (result.data) {
        for (const project of result.data) {
          nameMap.set(project.phid, project.fields?.name || project.phid);
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch project names:', error);
  }

  return nameMap;
}

/**
 * Convert raw task data to TaskInfo
 */
async function buildTaskInfo(
  client: ConduitClient,
  task: any,
  projectNameMap: Map<string, string>
): Promise<TaskInfo> {
  const fields = task.fields || {};
  const attachments = task.attachments || {};

  // Get project names
  const projectPHIDs: string[] = [];
  const projectsAttachment = attachments.projects;
  if (projectsAttachment?.projects) {
    for (const phid of Object.keys(projectsAttachment.projects)) {
      projectPHIDs.push(phid);
    }
  }

  const projectNames = projectPHIDs
    .map(phid => projectNameMap.get(phid) || phid)
    .filter(Boolean);

  // Fetch comments
  const comments = await fetchTaskComments(client, task.phid);

  // Ensure description is a string (Phabricator may return null or object)
  let description = '';
  if (fields.description) {
    if (typeof fields.description === 'string') {
      description = fields.description;
    } else if (typeof fields.description === 'object') {
      // Try to extract raw text from remarkup format
      description = fields.description.raw || fields.content || JSON.stringify(fields.description);
    }
  }

  return {
    id: task.id,
    phid: task.phid,
    title: fields.name || 'Untitled',
    description,
    status: fields.status?.name || fields.status?.value || 'unknown',
    priority: fields.priority?.name || 'normal',
    projectNames,
    dateCreated: fields.dateCreated || 0,
    dateModified: fields.dateModified || 0,
    dateClosed: fields.dateClosed,
    comments,
  };
}

/**
 * Call LLM to generate report
 */
async function generateReportWithLlm(
  config: LlmConfig,
  input: ReportGenerationInput
): Promise<string> {
  const url = buildLlmUrl(config.baseUrl);
  const prompt = buildGenerateReportPrompt(input);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: '你是一位专业的技术周报撰写助手。根据提供的任务数据生成结构化的工作周报。只输出 Markdown 格式。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: config.temperature ?? 0.4,
      max_tokens: config.maxTokens ?? 4096,
      top_p: config.topP ?? 0.9,
      frequency_penalty: config.frequencyPenalty ?? 0,
      presence_penalty: config.presencePenalty ?? 0,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';

  if (!content) {
    throw new Error('LLM returned empty content');
  }

  return content;
}

/**
 * Call LLM to merge and polish report with manual notes
 */
async function polishReportWithLlm(
  config: LlmConfig,
  reportMarkdown: string,
  manualNotes: string
): Promise<string> {
  const url = buildLlmUrl(config.baseUrl);
  const prompt = buildMergePolishPrompt(reportMarkdown, manualNotes);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: '你是一位周报编辑。将用户备注合并润色到现有周报中。只输出最终 Markdown。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: config.temperature ?? 0.3,
      max_tokens: config.maxTokens ?? 4096,
      top_p: config.topP ?? 0.9,
      frequency_penalty: config.frequencyPenalty ?? 0,
      presence_penalty: config.presencePenalty ?? 0,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM polish failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';

  if (!content) {
    throw new Error('LLM returned empty polished content');
  }

  return content;
}

/**
 * Build LLM API URL
 */
function buildLlmUrl(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '');
  if (!url.endsWith('/chat/completions')) {
    if (!url.endsWith('/v1')) url += '/v1';
    url += '/chat/completions';
  }
  return url;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, manualNotes } = req.body as {
    username?: string;
    manualNotes?: string;
  };

  if (!username) {
    return res.status(400).json({ error: '缺少 username 参数' });
  }

  const host = process.env.PHA_HOST;
  const token = process.env.PHA_TOKEN;

  if (!host || !token) {
    return res.status(500).json({ error: 'Server configuration error: missing PHA_HOST or PHA_TOKEN' });
  }

  try {
    const client = new ConduitClient(host, token);

    // Step 1: Get user PHID
    const userPHID = await getUserPHID(client, username);
    if (!userPHID) {
      return res.status(404).json({ error: `未找到用户: ${username}` });
    }

    // Step 2: Get date range
    const dateRange = getLastWeekRange();

    // Step 3: Search for completed and ongoing tasks in parallel
    const [completedTasksRaw, ongoingTasksRaw] = await Promise.all([
      searchCompletedTasks(client, userPHID, dateRange.start, dateRange.end),
      searchOngoingTasks(client, userPHID),
    ]);

    // Step 4: Collect all project PHIDs for name resolution
    const allProjectPHIDs: string[] = [];
    const collectProjectPHIDs = (tasks: any[]) => {
      for (const task of tasks) {
        const projectsAttachment = task.attachments?.projects;
        if (projectsAttachment?.projects) {
          allProjectPHIDs.push(...Object.keys(projectsAttachment.projects));
        }
      }
    };
    collectProjectPHIDs(completedTasksRaw);
    collectProjectPHIDs(ongoingTasksRaw);

    // Step 5: Fetch project names
    const projectNameMap = await fetchProjectNames(client, allProjectPHIDs);

    // Step 6: Build TaskInfo for each task
    const completedTasks = await Promise.all(
      completedTasksRaw.map(task => buildTaskInfo(client, task, projectNameMap))
    );
    const ongoingTasks = await Promise.all(
      ongoingTasksRaw.map(task => buildTaskInfo(client, task, projectNameMap))
    );

    // Step 7: Read LLM config
    const llmConfig = readLlmConfig();
    if (!llmConfig.baseUrl || !llmConfig.apiKey || !llmConfig.model) {
      return res.status(500).json({ error: 'LLM is not configured in Settings' });
    }

    // Step 8: Generate report with LLM
    const reportInput: ReportGenerationInput = {
      dateRange: dateRange.label,
      completedTasks,
      ongoingTasks,
    };

    let generatedReport: string;
    try {
      generatedReport = await generateReportWithLlm(llmConfig, reportInput);
    } catch (error: any) {
      console.error('Failed to generate report:', error);
      return res.status(502).json({ error: `生成报告失败: ${error.message}` });
    }

    // Step 9: If manualNotes provided, merge and polish
    const normalizedManualNotes = typeof manualNotes === 'string' ? manualNotes.trim() : '';
    if (!normalizedManualNotes) {
      return res.status(200).json({
        content: generatedReport,
        polished: false,
        stats: {
          completedTasks: completedTasks.length,
          ongoingTasks: ongoingTasks.length,
        },
      });
    }

    try {
      const polishedContent = await polishReportWithLlm(
        llmConfig,
        generatedReport,
        normalizedManualNotes
      );
      return res.status(200).json({
        content: polishedContent,
        polished: true,
        stats: {
          completedTasks: completedTasks.length,
          ongoingTasks: ongoingTasks.length,
        },
      });
    } catch (polishError: any) {
      // If polish fails, return original report with warning
      const warning = polishError instanceof Error ? polishError.message : 'LLM polish failed';
      return res.status(200).json({
        content: generatedReport,
        polished: false,
        polishWarning: warning,
        stats: {
          completedTasks: completedTasks.length,
          ongoingTasks: ongoingTasks.length,
        },
      });
    }
  } catch (error: any) {
    console.error('AI Report generation error:', error);
    const message = error instanceof Error ? error.message : '请求处理失败';
    return res.status(500).json({ error: message });
  }
}
