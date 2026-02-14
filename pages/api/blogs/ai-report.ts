import type { NextApiRequest, NextApiResponse } from 'next';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, date } = req.body as { username?: string; date?: string };

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

    const content = await dlRes.text();

    return res.status(200).json({ content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '请求周报生成服务失败';
    return res.status(500).json({ error: message });
  }
}
