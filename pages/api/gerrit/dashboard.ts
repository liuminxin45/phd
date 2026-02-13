import type { NextApiRequest, NextApiResponse } from 'next';
import { createGerritClient } from '@/lib/gerrit/client';
import type { DashboardResponse, DashboardSection, GerritChange } from '@/lib/gerrit/types';

const QUERY_OPTIONS = [
  'LABELS',
  'DETAILED_ACCOUNTS',
  'CURRENT_REVISION',
  'CURRENT_COMMIT',
  'MESSAGES',
  'DETAILED_LABELS',
];

const DASHBOARD_SECTIONS: { title: string; query: string }[] = [
  { title: '待我评审', query: 'reviewer:self status:open -owner:self -is:wip' },
  { title: '我发起的', query: 'owner:self status:open' },
  { title: '抄送我的', query: 'cc:self status:open -owner:self -reviewer:self' },
  { title: '最近合入', query: 'owner:self status:merged limit:15' },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await createGerritClient();

    // Run all dashboard queries in parallel
    const results = await Promise.all(
      DASHBOARD_SECTIONS.map(async (section) => {
        try {
          const changes = await client.queryChanges(section.query, QUERY_OPTIONS, 25);
          return { title: section.title, query: section.query, changes: changes || [] } as DashboardSection;
        } catch (err: any) {
          console.error(`Gerrit dashboard query failed [${section.title}]:`, err.message);
          return { title: section.title, query: section.query, changes: [] } as DashboardSection;
        }
      })
    );

    // Fetch current user account info
    let account;
    try {
      account = await client.get('/accounts/self');
    } catch {
      // Non-critical
    }

    const response: DashboardResponse = {
      sections: results,
      account,
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Gerrit dashboard error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch Gerrit dashboard' });
  }
}
