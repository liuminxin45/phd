import type { NextApiRequest, NextApiResponse } from 'next';
import { refreshPhabricatorSession, isSessionExpired } from '@/lib/auto-refresh-session';

export interface UnstandardItem {
  type: 'task' | 'project' | 'milestone';
  id: string;
  name: string;
  url: string;
  reason?: string;
  owner?: string; // 项目负责人（中文名称）
}

export interface UnstandardResponse {
  tasks: UnstandardItem[];
  projects: UnstandardItem[];
  milestones: UnstandardItem[];
  total: number;
}

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

function parseUnstandardHtml(html: string, host: string): UnstandardResponse {
  const tasks: UnstandardItem[] = [];
  const projects: UnstandardItem[] = [];
  const milestones: UnstandardItem[] = [];

  // Split HTML into sections by table headers
  const taskSection = html.match(/<span class="phui-header-header">任务不规范<\/span>[\s\S]*?(?=<span class="phui-header-header">项目不规范<\/span>|$)/i);
  const projectSection = html.match(/<span class="phui-header-header">项目不规范<\/span>[\s\S]*?(?=<span class="phui-header-header">节点不规范<\/span>|$)/i);
  const milestoneSection = html.match(/<span class="phui-header-header">节点不规范<\/span>[\s\S]*?(?=<div class="phabricator-standard-page-footer|$)/i);

  // Parse tasks from task section
  if (taskSection) {
    // Parse table rows in task section
    const tableRowRegex = /<tr(?![^>]*class="[^"]*aphront-table-view-fixed-head[^"]*")[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    
    while ((rowMatch = tableRowRegex.exec(taskSection[0])) !== null) {
      const rowHtml = rowMatch[1];
      
      // Skip header rows and "no data" rows
      if (rowHtml.includes('no-data') || rowHtml.includes('<th')) {
        continue;
      }
      
      // Extract cells from row
      const cells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(cellMatch[1]);
      }
      
      if (cells.length >= 5) {
        // Extract owner from cell 1 (任务负责人)
        const owner = cells[1].replace(/<[^>]*>/g, '').trim();
        
        // Extract task link from cell 3 (任务名称)
        const taskMatch = cells[3].match(/<a[^>]*href="([^"]*\/T(\d+)[^"]*)"[^>]*>([^<]*)<\/a>/i);
        
        if (taskMatch && owner) {
          const url = taskMatch[1].startsWith('http') ? taskMatch[1] : `${host}${taskMatch[1]}`;
          const id = taskMatch[2];
          const name = taskMatch[3].trim() || `T${id}`;
          
          if (!tasks.find(t => t.id === id)) {
            tasks.push({
              type: 'task',
              id,
              name,
              url,
              owner,
            });
          }
        }
      }
    }
  }

  // Parse projects from project section
  if (projectSection) {
    // Parse table rows in project section
    const tableRowRegex = /<tr(?![^>]*class="[^"]*aphront-table-view-fixed-head[^"]*")[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    
    while ((rowMatch = tableRowRegex.exec(projectSection[0])) !== null) {
      const rowHtml = rowMatch[1];
      
      // Skip header rows and "no data" rows
      if (rowHtml.includes('no-data') || rowHtml.includes('<th')) {
        continue;
      }
      
      // Extract cells from row
      const cells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(cellMatch[1]);
      }
      
      if (cells.length >= 5) {
        // Extract owner from cell 2 (项目负责人)
        const owner = cells[2].replace(/<[^>]*>/g, '').trim();
        
        // Extract schedule link and project name from cell 4 (项目名称)
        const scheduleMatch = cells[4].match(/<a[^>]*href="([^"]*\/project\/schedule\/(\d+)\/[^"]*)"[^>]*>([^<]*)<\/a>/i);
        
        if (scheduleMatch && owner) {
          const url = scheduleMatch[1].startsWith('http') ? scheduleMatch[1] : `${host}${scheduleMatch[1]}`;
          const id = scheduleMatch[2];
          const name = scheduleMatch[3].trim();
          
          if (id && name && !projects.find(p => p.id === id)) {
            projects.push({
              type: 'project',
              id,
              name,
              url,
              owner,
            });
          }
        }
      }
    }
  }

  // Parse milestones from milestone section
  if (milestoneSection) {
    // Parse table rows in milestone section
    const tableRowRegex = /<tr(?![^>]*class="[^"]*aphront-table-view-fixed-head[^"]*")[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    
    while ((rowMatch = tableRowRegex.exec(milestoneSection[0])) !== null) {
      const rowHtml = rowMatch[1];
      
      // Skip header rows and "no data" rows
      if (rowHtml.includes('no-data') || rowHtml.includes('<th')) {
        continue;
      }
      
      // Extract cells from row
      const cells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(cellMatch[1]);
      }
      
      if (cells.length >= 8) {
        // Extract owner from cell 2 (项目负责人)
        const owner = cells[2].replace(/<[^>]*>/g, '').trim();
        
        // Extract schedule link and project name from cell 4 (项目名称)
        const scheduleMatch = cells[4].match(/<a[^>]*href="([^"]*\/project\/schedule\/(\d+)\/[^"]*)"[^>]*>([^<]*)<\/a>/i);
        const milestoneName = cells[7].replace(/<[^>]*>/g, '').trim();
        
        if (scheduleMatch && milestoneName && owner) {
          const scheduleId = scheduleMatch[2];
          const projectName = scheduleMatch[3].trim();
          const url = scheduleMatch[1].startsWith('http') ? scheduleMatch[1] : `${host}${scheduleMatch[1]}`;
          
          // Use schedule ID + milestone name as unique ID
          const milestoneId = `${scheduleId}-${milestoneName}`;
          
          if (!milestones.find(m => m.id === milestoneId)) {
            milestones.push({
              type: 'milestone',
              id: milestoneId,
              name: `${projectName} - ${milestoneName}`,
              url,
              owner,
            });
          }
        }
      }
    }
  }

  return {
    tasks,
    projects,
    milestones,
    total: tasks.length + projects.length + milestones.length,
  };
}
