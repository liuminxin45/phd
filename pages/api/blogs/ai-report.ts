import type { NextApiRequest, NextApiResponse } from 'next';
import { readLlmConfig } from '@/lib/llm/config';

/**
 * Proxy for the BoostAgent weekly-report generation service.
 *
 * Flow (mirrors the Tampermonkey script):
 *   1. POST to the generate endpoint with { username, date }
 *   2. Response contains a download_url for the markdown file
 *   3. GET the download_url to retrieve the markdown content
 *   4. Return the markdown content to the client
 */

const GENERATE_URL =
  'http://boostagent.rd.tp-link.com.cn:3000/api/agents/weekly-report/generate';

async function polishWeeklyReportWithLlm({
  reportMarkdown,
  manualNotes,
}: {
  reportMarkdown: string;
  manualNotes: string;
}): Promise<string> {
  const config = readLlmConfig();
  if (!config.baseUrl || !config.apiKey || !config.model) {
    throw new Error('LLM is not configured in Settings');
  }

  let url = config.baseUrl.replace(/\/+$/, '');
  if (!url.endsWith('/chat/completions')) {
    if (!url.endsWith('/v1')) url += '/v1';
    url += '/chat/completions';
  }

  const systemPrompt = [
    'You are an enterprise weekly-report editor.',
    'Task:',
    '1. Merge the user notes into the existing structured weekly report.',
    '2. Keep the report structure clear and professional.',
    '3. Use formal, official workplace tone.',
    '4. Expand content moderately with concrete, plausible work detail.',
    '5. Output ONLY final Markdown report content. No explanation.',
  ].join('\n');

  const userPrompt = [
    'User notes (colloquial):',
    manualNotes,
    '',
    'Existing structured weekly report:',
    reportMarkdown,
  ].join('\n');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: config.temperature ?? 0.4,
      max_tokens: config.maxTokens ?? 2200,
      top_p: config.topP,
      frequency_penalty: config.frequencyPenalty,
      presence_penalty: config.presencePenalty,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM polish failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim?.() || '';
  if (!content) {
    throw new Error('LLM returned empty polished content');
  }

  return content;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, date, manualNotes } = req.body as {
    username?: string;
    date?: string;
    manualNotes?: string;
  };

  if (!username) {
    return res.status(400).json({ error: '缺少 username 参数' });
  }

  const dateStr =
    date || new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // Step 1: Call generate endpoint
    const genRes = await fetch(GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, date: dateStr }),
    });

    if (!genRes.ok) {
      const text = await genRes.text();
      return res.status(genRes.status).json({
        error: `生成服务返回 ${genRes.status}: ${text.slice(0, 500)}`,
      });
    }

    const genData = await genRes.json();

    if (genData.error_code !== 0 || !genData.data?.download_url) {
      return res.status(502).json({
        error: `生成服务返回异常: ${JSON.stringify(genData).slice(0, 500)}`,
      });
    }

    // Step 2: Download the markdown file
    const dlRes = await fetch(genData.data.download_url);

    if (!dlRes.ok) {
      return res.status(502).json({
        error: `下载周报内容失败 (${dlRes.status})`,
      });
    }

    const generatedContent = await dlRes.text();

    const normalizedManualNotes = typeof manualNotes === 'string' ? manualNotes.trim() : '';
    if (!normalizedManualNotes) {
      return res.status(200).json({
        content: generatedContent,
        polished: false,
      });
    }

    try {
      const polishedContent = await polishWeeklyReportWithLlm({
        reportMarkdown: generatedContent,
        manualNotes: normalizedManualNotes,
      });
      return res.status(200).json({
        content: polishedContent,
        polished: true,
      });
    } catch (polishError: unknown) {
      const warning = polishError instanceof Error ? polishError.message : 'LLM polish failed';
      return res.status(200).json({
        content: generatedContent,
        polished: false,
        polishWarning: warning,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '请求周报生成服务失败';
    return res.status(500).json({ error: message });
  }
}
