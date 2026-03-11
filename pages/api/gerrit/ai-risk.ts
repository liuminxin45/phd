import type { NextApiRequest, NextApiResponse } from 'next';
import { readLlmConfig } from '@/lib/llm/config';
import { normalizeLlmUrl, callLlm, safeRiskLevel } from '@/lib/llm/client';
import { buildRiskAssessmentSystemPrompt } from '@/lib/gerrit/ai-prompts';
import type { AiRiskSummary } from '@/lib/gerrit/ai-types';

/**
 * Batch risk assessment — ONE LLM call for all changes.
 * No Gerrit file-list fetching needed; uses only metadata from the client.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const llmConfig = readLlmConfig();
  if (!llmConfig.baseUrl || !llmConfig.apiKey || !llmConfig.model) {
    return res.status(400).json({ error: '未配置 LLM (请在设置中配置)' });
  }

  const { changes } = req.body as {
    changes: { _number: number; subject: string; project: string; insertions: number; deletions: number }[];
  };
  if (!Array.isArray(changes) || changes.length === 0) {
    return res.status(400).json({ error: '缺少 changes 数组参数' });
  }

  // Limit to 20 changes per call
  const batch = changes.slice(0, 20);

  try {
    const changesList = batch.map((c) =>
      JSON.stringify({
        n: c._number,
        subject: c.subject,
        project: c.project,
        insertions: c.insertions || 0,
        deletions: c.deletions || 0,
      })
    ).join('\n');

    const userPrompt = `请评估以下 ${batch.length} 个 Gerrit 变更的风险等级。仅基于题目、项目和变更规模判断。

每一行代表一个变更：
${changesList}

返回 strict JSON array（不要 markdown）：
[
  { "n": changeNumber, "r": "low"|"medium"|"high", "reason": "中文一句话理由，15字以内" }
]

要求：
- 必须覆盖输入中的每个 n
- reason 必须简洁、具体，避免空话`;

    let parsed: { n: number; r: string; reason: string }[];
    try {
      parsed = await callLlm<{ n: number; r: string; reason: string }[]>({
        url: normalizeLlmUrl(llmConfig.baseUrl),
        apiKey: llmConfig.apiKey,
        model: llmConfig.model,
        systemPrompt: buildRiskAssessmentSystemPrompt(),
        userPrompt,
        maxTokens: 1000,
        temperature: 0.1,
      });
    } catch {
      return res.status(200).json({ risks: [] });
    }

    // Map back to AiRiskSummary using the _number from the input
    const results: AiRiskSummary[] = [];
    for (const item of parsed) {
      const change = batch.find((c) => c._number === item.n);
      if (change) {
        results.push({
          changeNumber: item.n,
          riskLevel: safeRiskLevel(item.r),
          briefReason: item.reason || '',
        });
      }
    }

    return res.status(200).json({ risks: results });
  } catch (error: any) {
    console.error('AI risk assessment error:', error);
    return res.status(500).json({ error: error.message || 'Risk assessment failed' });
  }
}
