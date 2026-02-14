import type { NextApiRequest, NextApiResponse } from 'next';
import { readLlmConfig } from '@/lib/llm/config';
import { normalizeLlmUrl, callLlm, safeRiskLevel } from '@/lib/llm/client';
import { buildReviewSystemPrompt } from '@/lib/gerrit/ai-prompts';
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
    return res.status(400).json({ error: 'LLM not configured' });
  }

  const { changes } = req.body as {
    changes: { _number: number; subject: string; project: string; insertions: number; deletions: number }[];
  };
  if (!Array.isArray(changes) || changes.length === 0) {
    return res.status(400).json({ error: 'Missing changes array' });
  }

  // Limit to 20 changes per call
  const batch = changes.slice(0, 20);

  try {
    const changesList = batch.map((c, i) =>
      `${i + 1}. [#${c._number}] ${c.subject} (${c.project}, +${c.insertions || 0}/-${c.deletions || 0})`
    ).join('\n');

    const userPrompt = `对以下 ${batch.length} 个代码变更进行快速风险评估。仅基于标题、项目和改动规模判断。

${changesList}

返回严格 JSON 数组（不要 markdown 标记）：
[
  { "n": change编号, "r": "low"|"medium"|"high", "reason": "一句话原因(15字以内)" }
]

判断标准：
- high: 涉及安全/认证/数据库/核心业务逻辑/大规模重构(>500行)
- medium: API接口变更/状态管理/并发逻辑/中等规模
- low: 文档/配置/测试/小修改/纯重命名`;

    let parsed: { n: number; r: string; reason: string }[];
    try {
      parsed = await callLlm<{ n: number; r: string; reason: string }[]>({
        url: normalizeLlmUrl(llmConfig.baseUrl),
        apiKey: llmConfig.apiKey,
        model: llmConfig.model,
        systemPrompt: buildReviewSystemPrompt(),
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
