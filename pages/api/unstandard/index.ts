import type { NextApiRequest, NextApiResponse } from 'next';
import { refreshPhabricatorSession, isSessionExpired } from '@/lib/auto-refresh-session';
import { parseUnstandardHtml, type ParsedUnstandardData } from '@/lib/parsers/phabricator-html';

export type { UnstandardItem } from '@/lib/parsers/phabricator-html';
export type UnstandardResponse = ParsedUnstandardData;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const phaUser = process.env.PHA_USER;
    const phaSession = process.env.PHA_SESSION;

    if (!host) {
      return res.status(500).json({ error: 'Server configuration error: PHA_HOST not set' });
    }

    if (!phaUser || !phaSession) {
      return res.status(500).json({ error: 'Server configuration error: PHA_USER or PHA_SESSION not set' });
    }

    // Get team ID from query params, default to 16
    const teamId = req.query.teamId || req.body?.teamId || '16';
    const dimensions = req.query.dimensions || req.body?.dimensions || ['task', 'project', 'milestone'];

    // Build the query URL
    const queryParams = new URLSearchParams();
    queryParams.append('selectTeam[0]', String(teamId));
    queryParams.append('selectPMTeam[0]', String(teamId));
    
    // Add dimensions
    const dimensionArray = Array.isArray(dimensions) ? dimensions : [dimensions];
    dimensionArray.forEach((dim, index) => {
      queryParams.append(`selectDimension[${index}]`, dim);
    });
    
    queryParams.append('query', 'Y');

    const url = `${host}/dataAnalysis/unstandardized/?${queryParams.toString()}`;

    // Make request to Phabricator with session cookie
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cookie': `phusr=${phaUser}; phsid=${phaSession}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Phabricator request failed: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Check if session expired
    if (isSessionExpired(html)) {
      console.log('[Unstandard API] Session expired, refreshing...');
      
      try {
        // Refresh session
        const newSession = await refreshPhabricatorSession();
        
        // Retry the request with new session
        const retryResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cookie': `phusr=${newSession.phusr}; phsid=${newSession.phsid}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!retryResponse.ok) {
          throw new Error(`Retry failed: ${retryResponse.status} ${retryResponse.statusText}`);
        }

        const retryHtml = await retryResponse.text();
        const result = parseUnstandardHtml(retryHtml, host);
        return res.status(200).json(result);
      } catch (refreshError: any) {
        console.error('[Unstandard API] Session refresh failed:', refreshError);
        return res.status(500).json({ 
          error: 'Session expired and refresh failed: ' + refreshError.message 
        });
      }
    }

    // Parse the HTML response to extract unstandard items
    const result = parseUnstandardHtml(html, host);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Unstandard API error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch unstandard data' 
    });
  }
}
