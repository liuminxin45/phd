/**
 * Shared LLM API client utilities for server-side AI features.
 * Centralizes URL normalization, JSON parsing, and the chat-completion call.
 */

const VALID_RISK_LEVELS = new Set(['low', 'medium', 'high']);

/**
 * Normalize an OpenAI-compatible base URL to a full chat/completions endpoint.
 */
export function normalizeLlmUrl(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '');
  if (!url.endsWith('/chat/completions')) {
    if (!url.endsWith('/v1')) url += '/v1';
    url += '/chat/completions';
  }
  return url;
}

/**
 * Strip optional markdown code-fence wrappers from LLM output and parse JSON.
 */
export function parseJsonContent(rawContent: string): any {
  const cleaned = rawContent
    .replace(/^\s*```(?:json)?\s*\r?\n?/i, '')
    .replace(/\r?\n?```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const startIndex = cleaned.search(/[\[{]/);
    if (startIndex < 0) throw new Error('LLM output does not contain JSON');

    let depth = 0;
    let inString = false;
    let escaped = false;
    const opening = cleaned[startIndex];
    const closing = opening === '[' ? ']' : '}';

    for (let i = startIndex; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === opening) depth += 1;
      if (char === closing) {
        depth -= 1;
        if (depth === 0) {
          return JSON.parse(cleaned.slice(startIndex, i + 1));
        }
      }
    }

    throw new Error('Unable to recover JSON from LLM output');
  }
}

/**
 * Validate and coerce a string to a RiskLevel, defaulting to 'low'.
 */
export function safeRiskLevel(value: unknown): 'low' | 'medium' | 'high' {
  if (typeof value === 'string' && VALID_RISK_LEVELS.has(value)) {
    return value as 'low' | 'medium' | 'high';
  }
  return 'low';
}

export interface CallLlmParams {
  url: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

/**
 * Call an OpenAI-compatible chat/completions endpoint and parse the JSON response.
 * Throws on HTTP errors or JSON parse failures.
 */
export async function callLlm<T>(params: CallLlmParams): Promise<T> {
  const response = await fetch(params.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      temperature: params.temperature ?? 0.3,
      max_tokens: params.maxTokens,
      top_p: params.topP,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API 返回 ${response.status} (model=${params.model}): ${text.slice(0, 500)}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || '';
  return parseJsonContent(rawContent);
}
