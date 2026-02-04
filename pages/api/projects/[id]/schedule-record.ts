import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

type Ok = {
  success: true;
  projectId: number;
  projectPHID: string;
  projectName: string;
  record: any;
  paramsTemplate: Record<string, any>;
};

type Err = { success: false; error: string; debug?: any };

function pickFirst(obj: any, keys: string[]): any {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== 'GET') {
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

    const client = new ConduitClient(host, token);

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

    const scheduleResult = await client.call<any>('schedule.export.all', {
      objectType: 'project',
      formatKey: 'json',
    });

    const downloadUrl: string | undefined = scheduleResult?.['download URI'];
    if (!downloadUrl) {
      return res.status(500).json({ success: false, error: 'Failed to get schedule export download URI' });
    }

    const resp = await fetch(downloadUrl);
    if (!resp.ok) {
      return res.status(500).json({ success: false, error: `Failed to download schedule data: ${resp.status}` });
    }

    const jsonData = await resp.json();
    const scheduleData: any[] = Array.isArray(jsonData) ? jsonData : (Array.isArray(jsonData?.data) ? jsonData.data : []);

    const matchRecord = (item: any): boolean => {
      if (!item) return false;

      const itemPHID = item.projectPHID || item.phid || item.projectPhid || item.project?.phid || item.project?.projectPHID;
      if (itemPHID && String(itemPHID) === String(projectPHID)) return true;

      const itemId = item.projectId ?? item.projectID ?? item.id;
      if (typeof itemId === 'number' && itemId === projectId) return true;
      if (typeof itemId === 'string' && parseInt(itemId, 10) === projectId) return true;

      const uri = item.uri || item.projectUrl || item.url;
      if (typeof uri === 'string' && (uri.includes(`/project/view/${projectId}`) || uri.includes(`/project/schedule/${projectId}`))) return true;

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

    const scheduleProjectNumber: string = String(record.monogram || record.projectNumber || '').trim();
    if (!scheduleProjectNumber) {
      return res.status(500).json({ success: false, error: 'Missing schedule projectNumber/monogram in schedule record' });
    }

    // schedule.export.all(project) may use different field names than schedule.pre.edit expects.
    // Use fallbacks based on observed exports (e.g. projectReviewDate/openTime/keyProduct).
    const startDate = pickFirst(record, ['startDate', 'projectReviewDate', 'reviewDate', 'project_review_date']);
    const completeDate = pickFirst(record, ['completeDate', 'openTime', 'publishDate', 'project_open_time']);
    const itemModelList = pickFirst(record, ['itemModelList', 'keyProduct', 'projectOtherName', 'itemModel', 'modelList']);

    const paramsTemplate: Record<string, any> = {
      projectNumber: scheduleProjectNumber,
      projectUrl: record.uri || `${host}/project/schedule/${projectId}/`,
      projectName: record.projectName || projectName,
      startDate,
      completeDate,
      productRequiredDate: pickFirst(record, ['productRequiredDate', 'estimateFinishProduceDate', 'estimateFinishProduce', 'product_required_date']),
      itemModelList,
      projectManager: pickFirst(record, ['projectManager', 'pm', 'project_manager']),
      productManager: pickFirst(record, ['productManager', 'pd', 'product_manager']),
      assistant: pickFirst(record, ['assistant', 'helper']),
    };

    const missing = Object.entries(paramsTemplate)
      .filter(([, v]) => v === undefined || v === null || v === '')
      .map(([k]) => k);

    if (missing.length > 0) {
      return res.status(500).json({
        success: false,
        error: `Matched schedule record is missing required fields: ${missing.join(', ')}`,
        debug: {
          recordKeys: Object.keys(record || {}),
          sample: {
            startDate: paramsTemplate.startDate,
            completeDate: paramsTemplate.completeDate,
            itemModelList: paramsTemplate.itemModelList,
            productRequiredDate: paramsTemplate.productRequiredDate,
            projectManager: paramsTemplate.projectManager,
            productManager: paramsTemplate.productManager,
            assistant: paramsTemplate.assistant,
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      projectId,
      projectPHID,
      projectName,
      record,
      paramsTemplate,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch schedule record' });
  }
}
