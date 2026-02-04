interface ParsedTableRow {
  cells: string[];
}

function parseTableRows(html: string): ParsedTableRow[] {
  const rows: ParsedTableRow[] = [];
  const tableRowRegex = /<tr(?![^>]*class="[^"]*aphront-table-view-fixed-head[^"]*")[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = tableRowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    
    if (rowHtml.includes('no-data') || rowHtml.includes('<th')) {
      continue;
    }
    
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1]);
    }
    
    if (cells.length > 0) {
      rows.push({ cells });
    }
  }
  
  return rows;
}

function extractTextContent(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function extractLinkInfo(html: string, pattern: RegExp): { url: string; id: string; text: string } | null {
  const match = html.match(pattern);
  if (!match) return null;
  
  return {
    url: match[1],
    id: match[2],
    text: match[3]?.trim() || '',
  };
}

export interface UnstandardTask {
  type: 'task';
  id: string;
  name: string;
  url: string;
  owner: string;
  reason?: string;
}

export interface UnstandardProject {
  type: 'project';
  id: string;
  name: string;
  url: string;
  owner: string;
  reason?: string;
}

export interface UnstandardMilestone {
  type: 'milestone';
  id: string;
  name: string;
  url: string;
  owner: string;
  reason?: string;
}

export type UnstandardItem = UnstandardTask | UnstandardProject | UnstandardMilestone;

export interface ParsedUnstandardData {
  tasks: UnstandardTask[];
  projects: UnstandardProject[];
  milestones: UnstandardMilestone[];
  total: number;
}

export function parseUnstandardHtml(html: string, host: string): ParsedUnstandardData {
  const tasks: UnstandardTask[] = [];
  const projects: UnstandardProject[] = [];
  const milestones: UnstandardMilestone[] = [];

  const taskSection = html.match(/<span class="phui-header-header">任务不规范<\/span>[\s\S]*?(?=<span class="phui-header-header">项目不规范<\/span>|$)/i);
  const projectSection = html.match(/<span class="phui-header-header">项目不规范<\/span>[\s\S]*?(?=<span class="phui-header-header">节点不规范<\/span>|$)/i);
  const milestoneSection = html.match(/<span class="phui-header-header">节点不规范<\/span>[\s\S]*?(?=<div class="phabricator-standard-page-footer|$)/i);

  if (taskSection) {
    const rows = parseTableRows(taskSection[0]);
    
    for (const row of rows) {
      if (row.cells.length < 5) continue;
      
      const owner = extractTextContent(row.cells[1]);
      const taskLink = extractLinkInfo(
        row.cells[3],
        /<a[^>]*href="([^"]*\/T(\d+)[^"]*)"[^>]*>([^<]*)<\/a>/i
      );
      
      if (taskLink && owner) {
        const url = taskLink.url.startsWith('http') ? taskLink.url : `${host}${taskLink.url}`;
        const name = taskLink.text || `T${taskLink.id}`;
        
        if (!tasks.find(t => t.id === taskLink.id)) {
          tasks.push({
            type: 'task',
            id: taskLink.id,
            name,
            url,
            owner,
          });
        }
      }
    }
  }

  if (projectSection) {
    const rows = parseTableRows(projectSection[0]);
    
    for (const row of rows) {
      if (row.cells.length < 5) continue;
      
      const owner = extractTextContent(row.cells[2]);
      const scheduleLink = extractLinkInfo(
        row.cells[4],
        /<a[^>]*href="([^"]*\/project\/schedule\/(\d+)\/[^"]*)"[^>]*>([^<]*)<\/a>/i
      );
      
      if (scheduleLink && owner) {
        const url = scheduleLink.url.startsWith('http') ? scheduleLink.url : `${host}${scheduleLink.url}`;
        
        if (!projects.find(p => p.id === scheduleLink.id)) {
          projects.push({
            type: 'project',
            id: scheduleLink.id,
            name: scheduleLink.text,
            url,
            owner,
          });
        }
      }
    }
  }

  if (milestoneSection) {
    const rows = parseTableRows(milestoneSection[0]);
    
    for (const row of rows) {
      if (row.cells.length < 8) continue;
      
      const owner = extractTextContent(row.cells[2]);
      const scheduleLink = extractLinkInfo(
        row.cells[4],
        /<a[^>]*href="([^"]*\/project\/schedule\/(\d+)\/[^"]*)"[^>]*>([^<]*)<\/a>/i
      );
      const milestoneName = extractTextContent(row.cells[7]);
      
      if (scheduleLink && milestoneName && owner) {
        const url = scheduleLink.url.startsWith('http') ? scheduleLink.url : `${host}${scheduleLink.url}`;
        const milestoneId = `${scheduleLink.id}-${milestoneName}`;
        
        if (!milestones.find(m => m.id === milestoneId)) {
          milestones.push({
            type: 'milestone',
            id: milestoneId,
            name: `${scheduleLink.text} - ${milestoneName}`,
            url,
            owner,
          });
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
