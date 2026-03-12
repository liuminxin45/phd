import type { NextApiRequest, NextApiResponse } from 'next';
import { readLlmConfig } from '@/lib/llm/config';
import { normalizeLlmUrl, callLlm } from '@/lib/llm/client';
import type { CommitMessageCheckResponse, CommitMessageTypoIssue } from '@/lib/review/commit-message';

function normalizeIssues(raw: any[], lineCount: number): CommitMessageTypoIssue[] {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => ({
      line: Number(item?.line),
      startColumn: Number(item?.startColumn),
      endColumn: Number(item?.endColumn),
      text: String(item?.text || ''),
      suggestion: item?.suggestion ? String(item.suggestion) : undefined,
      reason: item?.reason ? String(item.reason) : undefined,
    }))
    .filter((item) =>
      Number.isFinite(item.line) &&
      item.line >= 1 &&
      item.line <= lineCount &&
      Number.isFinite(item.startColumn) &&
      item.startColumn >= 1 &&
      Number.isFinite(item.endColumn) &&
      item.endColumn >= item.startColumn &&
      item.text.trim().length > 0
    )
    .slice(0, 30);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<CommitMessageCheckResponse | { error: string }>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const llmConfig = readLlmConfig();
  if (!llmConfig.baseUrl || !llmConfig.apiKey || !llmConfig.model) {
    return res.status(400).json({ error: 'LLM is not configured' });
  }

  const message = String(req.body?.message || '').replace(/\r\n/g, '\n');
  if (!message.trim()) {
    return res.status(200).json({ issues: [] });
  }

  try {
    const lines = message.split('\n');
    const parsed = await callLlm<{ issues?: CommitMessageTypoIssue[] }>({
      url: normalizeLlmUrl(llmConfig.baseUrl),
      apiKey: llmConfig.apiKey,
      model: llmConfig.model,
      systemPrompt: [
        'You are a precise commit message typo checker.',
        'Detect only likely Chinese or English typos, misspellings, repeated characters, or clearly wrong words.',
        'Do not flag style preferences, naming debates, or uncertain cases.',
        'Preserve the original line breaks and return JSON only.',
        'Use 1-based line and column positions.',
      ].join(' '),
      userPrompt: [
        'Check this commit message for possible typos.',
        'Return JSON as {"issues":[{"line":1,"startColumn":1,"endColumn":3,"text":"bad","suggestion":"good","reason":"why"}]}.',
        'If nothing is suspicious, return {"issues":[]}.',
        '',
        message,
      ].join('\n'),
      maxTokens: 800,
      temperature: 0.1,
      topP: 1,
    });

    return res.status(200).json({
      issues: normalizeIssues(parsed.issues || [], lines.length),
    });
  } catch (error: any) {
    const messageText = String(error?.message || '');
    // Some third-party models occasionally return non-JSON text even with strict prompts.
    // Treat parse failures as "no findings" instead of breaking the review flow.
    if (
      messageText.includes('Unable to recover JSON from LLM output') ||
      messageText.includes('LLM output does not contain JSON')
    ) {
      console.warn('Commit message check warning: non-JSON LLM output, fallback to empty issues');
      return res.status(200).json({ issues: [] });
    }

    console.error('Commit message check error:', error);
    return res.status(500).json({ error: messageText || 'Failed to check commit message' });
  }
}
