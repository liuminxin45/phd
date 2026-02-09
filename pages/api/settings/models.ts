import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { baseUrl, apiKey } = req.body;

    if (!baseUrl || typeof baseUrl !== 'string') {
      return res.status(400).json({ error: 'baseUrl is required' });
    }
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: 'apiKey is required' });
    }

    // Normalize URL: strip trailing slash, ensure /v1/models or /models
    let url = baseUrl.replace(/\/+$/, '');
    if (!url.endsWith('/models')) {
      if (!url.endsWith('/v1')) {
        url += '/v1';
      }
      url += '/models';
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: `API returned ${response.status}: ${text.slice(0, 200)}`,
      });
    }

    const data = await response.json();

    // OpenAI-compatible: { data: [{ id, object, ... }] }
    const models: string[] = (data.data || [])
      .map((m: any) => m.id || m.name || '')
      .filter(Boolean)
      .sort();

    return res.status(200).json({ models });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch models' });
  }
}
