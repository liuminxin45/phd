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
  let base = `你是一位资深代码评审专家。你的任务是对 Gerrit 代码变更进行结构化分析，帮助评审者快速理解变更并发现潜在问题。

核心原则：
- 只报告有实际价值的发现，不要凑数
- 严重问题优先，风格问题最后
- 每条建议必须具体、可操作
- 引用具体文件和行号
- 如果变更质量良好，直接说明，不要强行找问题

输出格式要求：你必须返回严格的 JSON，不要包含任何 markdown 代码块标记或其他文本。

语言要求（强制）：
- 所有自然语言字段必须使用简体中文
- 禁止输出英文句子（代码标识符、文件路径、枚举值除外）`;

  if (teamRules?.customInstructions) {
    base += `\n\n团队自定义规则：\n${teamRules.customInstructions}`;
  }

  if (teamRules?.focusAreas && teamRules.focusAreas.length > 0) {
    base += `\n\n重点关注领域：${teamRules.focusAreas.join('、')}`;
  }

  if (teamRules?.ignorePatterns && teamRules.ignorePatterns.length > 0) {
    base += `\n\n忽略以下文件模式：${teamRules.ignorePatterns.join('、')}`;
  }

  return base;
}

/**
 * Build the user prompt for a full AI review of a change.
 */
export function buildReviewPrompt(params: {
  subject: string;
  commitMessage?: string;
  project: string;
  branch: string;
  diffText: string;
  truncated: boolean;
  fileCount: number;
  totalFiles: number;
  triageHints?: string[];
  feedbackContext?: FeedbackPromptContext;
}): string {
  const truncationNote = params.truncated
    ? `\n注意：由于变更较大，仅展示了 ${params.fileCount}/${params.totalFiles} 个文件的 diff。请基于可见内容进行分析。`
    : '';

  const triageNote = params.triageHints && params.triageHints.length > 0
    ? `\n优先关注文件（来自快速分层分析）：${params.triageHints.join('、')}`
    : '';

  const feedbackNote = params.feedbackContext && params.feedbackContext.entries.length > 0
    ? `\n近期评审者反馈偏好（用于减少误报）：\n${params.feedbackContext.entries
      .slice(0, 20)
      .map((entry) => {
        const location = entry.file ? `${entry.file}${entry.line ? `:${entry.line}` : ''}` : 'unknown';
        const title = entry.title || '未命名问题';
        return `- [${entry.value}] ${title} @ ${location}`;
      })
      .join('\n')}`
    : '';

  return `请分析以下 Gerrit 代码变更并返回结构化 JSON。

## 变更信息
- 标题: ${params.subject}
- 项目: ${params.project}
- 分支: ${params.branch}
${params.commitMessage ? `- 提交信息: ${params.commitMessage}` : ''}
${truncationNote}
${triageNote}
${feedbackNote}

## Diff 内容
行号格式说明：
- " 旧行号:新行号 | 内容" = 未变更的上下文行
- "-旧行号 | 内容" = 删除的行
- "+新行号 | 内容" = 新增的行

${params.diffText}

## 要求的 JSON 结构

{
  "overview": {
    "riskLevel": "low" | "medium" | "high",
    "changeTypes": ["refactor" | "new-feature" | "bugfix" | "config" | "test" | "docs" | "dependency" | "mixed"],
    "summary": "一句话概述本次变更的核心内容",
    "focusPoints": ["建议关注点1", "建议关注点2", "建议关注点3"]
  },
  "issues": [
    {
      "category": "bug" | "performance" | "maintainability" | "style",
      "severity": "low" | "medium" | "high",
      "title": "问题简述",
      "description": "详细说明",
      "file": "文件路径",
      "line": 行号(新文件的行号),
      "suggestion": "修改建议（可选）",
      "evidence": {
        "file": "证据文件路径(必填)",
        "line": 证据行号(可选),
        "snippet": "来自diff的证据片段(必填，20~200字符)"
      }
    }
  ]
}

规则：
- issues 数组按 severity 降序排列（high → medium → low）
- each issue 的 line 必须是 diff 中实际存在的新文件行号（+号后的数字）
- evidence.snippet 必须来自当前 diff 的真实内容，不得编造
- focusPoints 最多 3 条
- 如果没有问题，issues 返回空数组
- riskLevel 判断标准：high=有明确 bug 或安全问题，medium=有性能或逻辑风险，low=仅风格或无问题
- 所有可读文本字段（summary/focusPoints/title/description/suggestion/evidence.snippet）必须是简体中文`;
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
  return `你是代码评审助手。请先做“快速分层分析”，只根据文件列表找出最值得深度分析的文件。

变更标题: ${params.subject}
项目: ${params.project}
分支: ${params.branch}

文件列表:
${params.filesSummary}

返回严格 JSON（不要 markdown 标记）：
{
  "highRiskFiles": ["file1", "file2"],
  "reasons": ["原因1", "原因2"]
}

规则：
- highRiskFiles 最多 8 个
- 优先选择核心业务逻辑、认证授权、并发状态、数据持久化、API协议相关文件
- reasons 最多 3 条，简短即可
- reasons 必须使用简体中文`;
}

/**
 * Stage-2 prompt: verify high-severity issues with a stricter pass.
 */
export function buildIssueVerificationPrompt(params: {
  subject: string;
  diffText: string;
  issues: VerificationPromptIssue[];
}): string {
  return `请对以下高严重度问题做复核，判断是否被 diff 证据支持。

变更标题: ${params.subject}

待复核问题:
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

返回严格 JSON（不要 markdown 标记）：
{
  "results": [
    {
      "index": 0,
      "status": "confirmed" | "rejected" | "uncertain",
      "reason": "复核原因（20字以内）"
    }
  ]
}

规则：
- 只有证据明确支持才标记 confirmed
- 若证据不足，优先 uncertain
- 不得返回不存在的 index
- reason 必须使用简体中文`;
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
  return `快速评估以下代码变更的风险等级。

变更: ${params.subject}
项目: ${params.project}
规模: +${params.insertions}/-${params.deletions}

文件列表:
${params.filesSummary}

返回严格 JSON（不要 markdown 标记）：
{
  "riskLevel": "low" | "medium" | "high",
  "briefReason": "一句话原因（15字以内）"
}

判断标准：
- high: 涉及安全、认证、数据库迁移、核心业务逻辑、大规模重构(>500行)
- medium: 涉及 API 接口变更、状态管理、并发逻辑、中等规模改动
- low: 文档、配置、测试、小规模修改、纯重命名`;
}
