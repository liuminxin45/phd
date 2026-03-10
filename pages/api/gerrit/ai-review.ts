import type { NextApiRequest, NextApiResponse } from 'next';
import { createGerritClient } from '@/lib/gerrit/client';
import { readLlmConfig } from '@/lib/llm/config';
import { normalizeLlmUrl, callLlm } from '@/lib/llm/client';
import { readTeamRules } from '@/lib/gerrit/ai-rules';
import { buildDiffText, buildFilesSummary, type FileDiffInput } from '@/lib/gerrit/ai-diff';
import {
  buildReviewSystemPrompt,
  buildReviewPrompt,
  buildFileTriagePrompt,
  buildIssueVerificationPrompt,
} from '@/lib/gerrit/ai-prompts';
import type { GerritDiffInfo, GerritFileInfo } from '@/lib/gerrit/types';
import type { AiReviewResult, AiOverview, AiIssue, AiFeedbackEntry, AiTeamRules } from '@/lib/gerrit/ai-types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const llmConfig = readLlmConfig();
  if (!llmConfig.baseUrl || !llmConfig.apiKey || !llmConfig.model) {
    return res.status(400).json({ error: '未配置 LLM 设置 (请在设置中配置)' });
  }

  const { changeNumber, revisionId, baseRevisionId, feedbackEntries, rulesOverride } = req.body;
  if (!changeNumber) {
    return res.status(400).json({ error: '缺少 changeNumber 参数' });
  }

  try {
    const gerritClient = await createGerritClient();
    const storedRules = readTeamRules();
    const teamRules: AiTeamRules = {
      ...storedRules,
      ...(rulesOverride && typeof rulesOverride === 'object' ? rulesOverride : {}),
    };
    const llmUrl = normalizeLlmUrl(llmConfig.baseUrl);
    const normalizedFeedbackEntries: AiFeedbackEntry[] = Array.isArray(feedbackEntries)
      ? feedbackEntries.slice(0, 40).filter((entry: any) => !!entry?.value)
      : [];

    // Fetch change detail
    const detailOptions = ['ALL_REVISIONS', 'CURRENT_COMMIT', 'MESSAGES'];
    const optionQuery = detailOptions.map((o) => `o=${o}`).join('&');
    const change = await gerritClient.get(`/changes/${changeNumber}/detail?${optionQuery}`);

    if (!change.current_revision) {
      return res.status(400).json({ error: '变更没有当前版本' });
    }

    const targetRevision = revisionId || change.current_revision;

    // Fetch files for current revision
    const filesMap: Record<string, GerritFileInfo> = await gerritClient.get(
      `/changes/${changeNumber}/revisions/${targetRevision}/files${baseRevisionId ? `?base=${encodeURIComponent(baseRevisionId)}` : ''}`
    ).catch(() => ({}));

    // Filter files based on team rules ignore patterns
    const filteredPaths = Object.keys(filesMap)
      .filter((p) => p !== '/COMMIT_MSG')
      .filter((p) => {
        if (!teamRules.ignorePatterns || teamRules.ignorePatterns.length === 0) return true;
        return !teamRules.ignorePatterns.some((pattern) => {
          if (pattern.startsWith('*.')) {
            return p.endsWith(pattern.slice(1));
          }
          return p.includes(pattern);
        });
      })
      .sort();

    // Stage-1: triage likely risky files to maximize useful diff context under token budget
    let triageHints: string[] = [];
    if (filteredPaths.length > 0) {
      try {
        const triage = await callLlm<{ highRiskFiles?: string[] }>({
          url: llmUrl,
          apiKey: llmConfig.apiKey,
          model: llmConfig.model,
          systemPrompt: 'You are a precision code review triage assistant. Return JSON only. All natural language output must be in Simplified Chinese.',
          userPrompt: buildFileTriagePrompt({
            subject: change.subject,
            project: change.project,
            branch: change.branch,
            filesSummary: buildFilesSummary(
              Object.fromEntries(filteredPaths.map((path) => [path, filesMap[path]]))
            ),
          }),
          maxTokens: 400,
          temperature: 0.1,
          topP: 1,
        });

        const candidateSet = new Set(filteredPaths);
        triageHints = (triage.highRiskFiles || [])
          .filter((path) => candidateSet.has(path))
          .slice(0, 8);
      } catch {
        triageHints = [];
      }
    }

    const orderedPaths = [
      ...triageHints,
      ...filteredPaths.filter((path) => !new Set(triageHints).has(path)),
    ];

    // Fetch diffs for each file (in parallel, limited concurrency)
    const CONCURRENCY = 5;
    const fileDiffs: FileDiffInput[] = [];

    for (let i = 0; i < orderedPaths.length; i += CONCURRENCY) {
      const batch = orderedPaths.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (filePath) => {
          try {
            const encodedPath = encodeURIComponent(filePath);
            const diff: GerritDiffInfo = await gerritClient.get(
              `/changes/${changeNumber}/revisions/${targetRevision}/files/${encodedPath}/diff${baseRevisionId ? `?base=${encodeURIComponent(baseRevisionId)}` : ''}`
            );
            return { path: filePath, info: filesMap[filePath], diff };
          } catch {
            return null;
          }
        })
      );
      for (const r of results) {
        if (r) fileDiffs.push(r);
      }
    }

    // Build diff text
    const { text: diffText, truncated, fileCount, totalFiles } = buildDiffText(fileDiffs);

    // Extract commit message
    const currentRev = change.revisions?.[targetRevision];
    const commitMessage = currentRev?.commit?.message || '';

    // Build prompts
    const systemPrompt = buildReviewSystemPrompt(teamRules.enabled ? teamRules : undefined);
    const userPrompt = buildReviewPrompt({
      subject: change.subject,
      commitMessage,
      project: change.project,
      branch: change.branch,
      diffText,
      truncated,
      fileCount,
      totalFiles,
      triageHints,
      feedbackContext: { entries: normalizedFeedbackEntries },
    });

    const parsed = await callLlm<{ overview: AiOverview; issues: any[] }>({
      url: llmUrl,
      apiKey: llmConfig.apiKey,
      model: llmConfig.model,
      systemPrompt,
      userPrompt,
      maxTokens: llmConfig.maxTokens,
      temperature: 0.3,
      topP: llmConfig.topP,
    });
    const usedModel = llmConfig.model;

    // Normalize issues with stable IDs
    const issues: AiIssue[] = (parsed.issues || []).map((issue: any, idx: number) => {
      const evidenceFile = issue.evidence?.file || issue.file;
      const evidenceSnippet = (issue.evidence?.snippet || issue.description || issue.title || '').slice(0, 200);
      return {
      id: `ai-${changeNumber}-${idx}`,
      category: issue.category || 'style',
      severity: issue.severity || 'low',
      title: issue.title || '',
      description: issue.description || '',
      file: issue.file,
      line: issue.line,
      suggestion: issue.suggestion,
      evidence: evidenceFile && evidenceSnippet
        ? {
            file: evidenceFile,
            line: issue.evidence?.line || issue.line,
            snippet: evidenceSnippet,
          }
        : undefined,
    };
    });

    // Stage-2: verify high-severity findings and suppress likely false positives
    const highIssueCandidates = issues
      .map((issue, index) => ({ issue, index }))
      .filter(({ issue }) => issue.severity === 'high');

    const verificationMap = new Map<number, { status: 'confirmed' | 'rejected' | 'uncertain'; reason?: string }>();
    if (highIssueCandidates.length > 0) {
      try {
        const verifyRes = await callLlm<{ results?: Array<{ index: number; status: 'confirmed' | 'rejected' | 'uncertain'; reason?: string }> }>({
          url: llmUrl,
          apiKey: llmConfig.apiKey,
          model: llmConfig.model,
          systemPrompt: 'You are a rigorous code review verifier. Judge only based on the provided diff evidence and return JSON only. All natural language output must be in Simplified Chinese.',
          userPrompt: buildIssueVerificationPrompt({
            subject: change.subject,
            diffText,
            issues: highIssueCandidates.map(({ index, issue }) => ({
              index,
              issue: {
                category: issue.category,
                severity: issue.severity,
                title: issue.title,
                description: issue.description,
                file: issue.file,
                line: issue.line,
                suggestion: issue.suggestion,
              },
            })),
          }),
          maxTokens: 600,
          temperature: 0.1,
          topP: 1,
        });

        for (const item of verifyRes.results || []) {
          if (typeof item.index === 'number' && ['confirmed', 'rejected', 'uncertain'].includes(item.status)) {
            verificationMap.set(item.index, { status: item.status, reason: item.reason });
          }
        }
      } catch {
        // If verification fails, preserve first-pass output.
      }
    }

    const reviewedIssues = issues
      .map((issue, index) => {
        const verification = verificationMap.get(index);
        if (!verification) return issue;
        return {
          ...issue,
          verification,
        };
      })
      .filter((issue) => issue.verification?.status !== 'rejected');

    const result: AiReviewResult = {
      changeNumber,
      revision: targetRevision,
      usedModel,
      overview: {
        riskLevel: parsed.overview?.riskLevel || 'low',
        changeTypes: parsed.overview?.changeTypes || ['mixed'],
        summary: parsed.overview?.summary || '',
        focusPoints: parsed.overview?.focusPoints || [],
      },
      issues: reviewedIssues,
      generatedAt: new Date().toISOString(),
    };

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('AI review error:', error);
    return res.status(500).json({ error: error.message || 'AI review failed' });
  }
}
