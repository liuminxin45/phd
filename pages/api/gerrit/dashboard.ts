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
  { title: 'Your Turn', query: 'attention:self status:open -owner:self -is:wip' },
  { title: 'Outgoing Reviews', query: 'owner:self status:open' },
  { title: 'Incoming Reviews', query: 'reviewer:self status:open -owner:self -is:wip' },
  { title: 'CC\'ed On', query: 'cc:self status:open -owner:self -reviewer:self' },
  { title: 'Recently Closed', query: '(owner:self OR reviewer:self OR cc:self) status:closed limit:25' },
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
