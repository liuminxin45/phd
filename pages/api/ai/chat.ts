import type { NextApiRequest, NextApiResponse } from 'next';
import { readLlmConfig } from '@/lib/llm/config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const config = readLlmConfig();
  if (!config.baseUrl || !config.apiKey || !config.model) {
    return res.status(400).json({ error: '请先在设置中配置 LLM 连接信息（Base URL / API Key / Model）' });
  }

  const { messages, temperature, maxTokens } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 参数不能为空' });
  }

  // Build chat completions URL
  let url = config.baseUrl.replace(/\/+$/, '');
  if (!url.endsWith('/chat/completions')) {
    if (!url.endsWith('/v1')) url += '/v1';
    url += '/chat/completions';
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: temperature ?? config.temperature,
        max_tokens: maxTokens ?? config.maxTokens,
        top_p: config.topP,
        frequency_penalty: config.frequencyPenalty,
        presence_penalty: config.presencePenalty,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: `LLM API 返回 ${response.status}: ${text.slice(0, 500)}`,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'LLM 请求失败';
    return res.status(500).json({ error: message });
  }
}
