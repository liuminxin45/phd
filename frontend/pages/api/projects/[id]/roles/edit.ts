import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

type EditRolesResponse = { success: true } | { success: false; error: string; debug?: any };

type RolesPayload = {
  projectManagerPHID: string | null;
  productManagerPHID: string | null;
  assistantPHID: string | null;
  developersPHID: string[];
};

function pickFirst(obj: any, keys: string[]): any {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EditRolesResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, error: 'Project ID is required' });
    }

    const projectId = parseInt(id, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const roles: Partial<RolesPayload> | undefined = req.body?.roles;
    if (!roles || typeof roles !== 'object') {
      return res.status(400).json({ success: false, error: 'roles is required' });
    }

    const projectManagerPHID = typeof roles.projectManagerPHID === 'string' ? roles.projectManagerPHID : null;
    const productManagerPHID = typeof roles.productManagerPHID === 'string' ? roles.productManagerPHID : null;
    const assistantPHID = typeof roles.assistantPHID === 'string' ? roles.assistantPHID : null;
    const developersPHID = Array.isArray(roles.developersPHID)
      ? roles.developersPHID.filter((p: any): p is string => typeof p === 'string' && p.startsWith('PHID-USER-'))
      : [];

    const client = new ConduitClient(host, token);

    // Convert PHIDs to real names for schedule.pre.edit (schedule system stores names, not PHIDs)
    const allRolePHIDs = [projectManagerPHID, productManagerPHID, assistantPHID, ...developersPHID].filter(Boolean) as string[];
    const phidToName: Record<string, string> = {};

    if (allRolePHIDs.length > 0) {
      try {
        const usersResult = await client.call<any>('user.search', {
          constraints: { phids: allRolePHIDs },
          limit: 100,
        });

        if (usersResult?.data?.length) {
          usersResult.data.forEach((userData: any) => {
            const phid = userData.phid;
            const realName = userData.fields?.realName || userData.fields?.username || '';
            if (phid && realName) {
              phidToName[phid] = realName;
            }
          });
        }
      } catch (error) {
        console.error('[roles/edit] Failed to fetch user names:', error);
      }
    }

    // Fetch schedule export and find matching record (same data source as roles read)
    const scheduleResult = await client.call<any>('schedule.export.all', {
      objectType: 'project',
      formatKey: 'json',
    });

    if (!scheduleResult?.['download URI']) {
      return res.status(500).json({ success: false, error: 'Failed to get schedule export download URI' });
    }

    const resp = await fetch(scheduleResult['download URI']);
    if (!resp.ok) {
      return res.status(500).json({ success: false, error: `Failed to download schedule data: ${resp.status}` });
    }

    const jsonData = await resp.json();
    const scheduleData: any[] = Array.isArray(jsonData) ? jsonData : (Array.isArray(jsonData?.data) ? jsonData.data : []);

    // Also get project basic info to help matching
    const projectInfo = await client.call<any>('project.search', {
      constraints: { ids: [projectId] },
      limit: 1,
    });

    if (!projectInfo?.data?.length) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const project = projectInfo.data[0];
    const projectPHID: string = project.phid;
    const projectName: string = project.fields?.name || '';
    const projectSlug: string = project.fields?.slug || '';

    const matchRecord = (item: any): boolean => {
      if (!item) return false;

      const itemPHID = item.projectPHID || item.phid || item.projectPhid || item.project?.phid || item.project?.projectPHID;
      if (itemPHID && String(itemPHID) === String(projectPHID)) return true;

      const itemId = item.projectId ?? item.projectID ?? item.id;
      if (typeof itemId === 'number' && itemId === projectId) return true;
      if (typeof itemId === 'string' && parseInt(itemId, 10) === projectId) return true;

      const uri = item.uri || item.projectUrl || item.url;
      if (typeof uri === 'string' && uri.includes(`/project/schedule/${projectId}/`)) return true;

      const itemName = pickFirst(item, ['projectName', 'project_name', 'name', 'project']);
      if (itemName && projectName && String(itemName).trim() === String(projectName).trim()) return true;
      if (itemName && projectName && String(itemName).toLowerCase().includes(String(projectName).toLowerCase())) return true;

      const monogram = item.monogram || item.projectNumber || item.projectSlug;
      if (monogram && projectSlug && String(monogram).toLowerCase() === String(projectSlug).toLowerCase()) return true;

      return false;
    };

    const record = scheduleData.find(matchRecord);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Schedule record not found for project' });
    }

    // schedule.pre.edit expects projectNumber as the schedule monogram (e.g. SC20496)
    const scheduleProjectNumber: string = String(record.monogram || record.projectNumber || '').trim();
    if (!scheduleProjectNumber) {
      return res.status(500).json({ success: false, error: 'Missing schedule projectNumber/monogram in schedule record' });
    }

    // Try to preserve existing schedule fields to avoid wiping data.
    // Convert PHIDs to real names (schedule system expects names, not PHIDs)
    const projectManagerName = projectManagerPHID ? (phidToName[projectManagerPHID] || '') : '';
    const productManagerName = productManagerPHID ? (phidToName[productManagerPHID] || '') : '';
    const assistantName = assistantPHID ? (phidToName[assistantPHID] || '') : '';
    const developerNames = developersPHID.map(phid => phidToName[phid]).filter(Boolean);

    const params: Record<string, any> = {
      projectNumber: scheduleProjectNumber,
      projectUrl: record.uri || `${host}/project/schedule/${projectId}/`,
      projectName: record.projectName || projectName,

      // roles (use real names, not PHIDs)
      projectManager: projectManagerName,
      productManager: productManagerName,
      developers: developerNames,
      assistant: assistantName,
    };

    const passthroughMap: Array<[string, string[]]> = [
      ['projectDescription', ['projectDescription', 'projectInfo']],
      ['projectType', ['projectType', 'type']],
      ['projectPriority', ['projectPriority', 'priority']],
      ['currentGoal', ['currentGoal']],
      ['productType', ['productType']],
      ['productRequiredDate', ['productRequiredDate']],
      ['mainChip', ['mainChip']],
      ['sensorChip', ['sensorChip']],
      ['wifiChip', ['wifiChip']],
      ['chipInfo', ['chipInfo', 'otherChipInfo']],
      ['workload', ['workload']],
      ['docsID', ['docsID']],
      ['subscribers', ['subscribers']],
    ];

    for (const [paramKey, recordKeys] of passthroughMap) {
      const v = pickFirst(record, recordKeys);
      if (v !== undefined && v !== null && v !== '') {
        params[paramKey] = v;
      }
    }

    // Debug: log params before calling schedule.pre.edit
    console.log('[roles/edit] Calling schedule.pre.edit with params:', JSON.stringify(params, null, 2));
    console.log('[roles/edit] Matched schedule record:', JSON.stringify(record, null, 2));

    try {
      await client.call<any>('schedule.pre.edit', params);
      return res.status(200).json({ success: true });
    } catch (conduitError: any) {
      console.error('[roles/edit] schedule.pre.edit failed:', conduitError.message);
      console.error('[roles/edit] Failed params were:', JSON.stringify(params, null, 2));
      // Return debug info in error for now
      return res.status(500).json({ 
        success: false, 
        error: conduitError.message || 'Failed to call schedule.pre.edit',
        debug: {
          params,
          recordKeys: Object.keys(record || {}),
          projectId: parseInt(req.query.id as string, 10),
        }
      });
    }
  } catch (error: any) {
    console.error('[roles/edit] Outer error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to edit project roles' });
  }
}
