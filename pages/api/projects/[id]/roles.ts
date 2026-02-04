import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

type RolesResponse =
  | {
      projectId: number;
      projectPHID: string;
      projectName: string;
      delay?: {
        delayGroup?: string | null;
        delayName?: string | null;
        delayType?: string | null;
        delayResp?: string | null;
        delayDesc?: string | null;
        mileFinishOriginal?: number | null;
        mileFinishUpdate?: number | null;
        estimateFinishProduceDate?: number | null;
      };
      roles: {
        projectManagerPHID: string | null;
        productManagerPHID: string | null;
        assistantPHID: string | null;
        developersPHID: string[];
      };
      users: Record<string, any>;
    }
  | { error: string };

function parseUserIdentifier(raw: unknown): { phid?: string; username?: string } {
  if (!raw) return {};

  if (typeof raw === 'object') {
    const obj: any = raw;
    const phid = obj.phid || obj.PHID || obj.userPHID || obj.userPhid;
    const username = obj.username || obj.userName || obj.user || obj.name || obj.handle;
    const fieldsUsername = obj.fields?.username;

    const resolvedPHID = typeof phid === 'string' && phid.startsWith('PHID-USER-') ? phid : undefined;
    const resolvedUsername = typeof fieldsUsername === 'string'
      ? fieldsUsername
      : (typeof username === 'string' ? username : undefined);

    if (resolvedPHID || resolvedUsername) {
      return { phid: resolvedPHID, username: resolvedUsername };
    }

    return {};
  }

  if (typeof raw !== 'string') return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('PHID-USER-')) {
    return { phid: trimmed };
  }
  const match = trimmed.match(/\(([^)]+)\)/);
  if (match?.[1]) return { username: match[1].trim() };
  return { username: trimmed };
}

function splitUsernames(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => parseUserIdentifier(x).username)
      .filter((x): x is string => Boolean(x));
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,，]/)
      .map((s) => parseUserIdentifier(s).username)
      .filter((x): x is string => Boolean(x));
  }
  return [];
}

function pickFirst(obj: any, keys: string[]): any {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function extractPHIDs(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('PHID-USER-')) return [trimmed];
    return [];
  }
  if (Array.isArray(raw)) {
    return raw
      .flatMap((x) => {
        if (typeof x === 'string' && x.trim().startsWith('PHID-USER-')) return [x.trim()];
        const ident = parseUserIdentifier(x);
        return ident.phid ? [ident.phid] : [];
      })
      .filter(Boolean);
  }
  if (typeof raw === 'object') {
    const ident = parseUserIdentifier(raw);
    return ident.phid ? [ident.phid] : [];
  }
  return [];
}

function findValueByKeyMatch(containers: any[], keyMatcher: (k: string) => boolean): any {
  for (const c of containers) {
    if (!c || typeof c !== 'object') continue;
    for (const k of Object.keys(c)) {
      if (keyMatcher(k)) {
        return c[k];
      }
    }
  }
  return undefined;
}

function collectRoleKeySamples(containers: any[], matcher: (k: string) => boolean, limit: number = 20) {
  const out: Array<{ key: string; valueType: string }> = [];
  for (const c of containers) {
    if (!c || typeof c !== 'object') continue;
    for (const k of Object.keys(c)) {
      if (matcher(k)) {
        out.push({ key: k, valueType: Array.isArray(c[k]) ? 'array' : typeof c[k] });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RolesResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { id, debug } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const projectId = parseInt(id, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const client = new ConduitClient(host, token);

    const projectInfo = await client.call<any>('project.search', {
      constraints: { ids: [projectId] },
      limit: 1,
    });

    if (!projectInfo?.data?.length) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectInfo.data[0];
    const projectPHID: string = project.phid;
    const projectName: string = project.fields?.name || '';
    const projectSlug: string = project.fields?.slug || '';

    // Try to read role assignments directly from project.search response.
    // Many deployments store these as custom fields that match the web form keys:
    // project-manager / product-manager / developers / assistant
    const rawFields = project.fields || {};
    const rawCustom = rawFields.custom || rawFields.customFields || (project as any).custom || {};
    const roleContainerCandidates = [rawFields, rawCustom, (project as any).attachments?.customFields, (project as any).attachments?.custom];

    const pickFromContainers = (keys: string[]) => {
      for (const c of roleContainerCandidates) {
        const v = pickFirst(c, keys);
        if (v !== undefined) return v;
      }
      return undefined;
    };

    const pmRaw =
      pickFromContainers(['project-manager', 'projectManager', 'projectManagerPHID', 'project_manager']) ??
      findValueByKeyMatch(roleContainerCandidates, (k) => k.endsWith('project-manager') || k.includes('project-manager'));

    const pdRaw =
      pickFromContainers(['product-manager', 'productManager', 'productManagerPHID', 'product_manager']) ??
      findValueByKeyMatch(roleContainerCandidates, (k) => k.endsWith('product-manager') || k.includes('product-manager'));

    const assistantRaw =
      pickFromContainers(['assistant', 'assistantPHID', 'helper']) ??
      findValueByKeyMatch(roleContainerCandidates, (k) => k.endsWith('assistant') || k.includes('assistant'));

    const devRaw =
      pickFromContainers(['developers', 'developersPHID', 'developer', 'devs', 'engineers']) ??
      findValueByKeyMatch(roleContainerCandidates, (k) => k.endsWith('developers') || k.includes('developers'));

    const projectManagerPHIDsFromProject = extractPHIDs(pmRaw);
    const productManagerPHIDsFromProject = extractPHIDs(pdRaw);
    const assistantPHIDsFromProject = extractPHIDs(assistantRaw);
    const developerPHIDsFromProject = extractPHIDs(devRaw);

    const rolesFromProject = {
      projectManagerPHID: projectManagerPHIDsFromProject[0] || null,
      productManagerPHID: productManagerPHIDsFromProject[0] || null,
      assistantPHID: assistantPHIDsFromProject[0] || null,
      developersPHID: developerPHIDsFromProject,
    };

    const scheduleResult = await client.call<any>('schedule.export.all', {
      objectType: 'project',
      formatKey: 'json',
    });

    let scheduleData: any[] = [];
    if (scheduleResult && scheduleResult['download URI']) {
      const downloadUrl = scheduleResult['download URI'];
      const resp = await fetch(downloadUrl);
      if (resp.ok) {
        const jsonData = await resp.json();
        if (Array.isArray(jsonData)) {
          scheduleData = jsonData;
        } else if (jsonData && Array.isArray(jsonData.data)) {
          scheduleData = jsonData.data;
        }
      }
    }

    const matchRecord = (item: any): boolean => {
      if (!item) return false;

      // PHID match
      const itemPHID = item.projectPHID || item.phid || item.projectPhid || item.project?.phid || item.project?.projectPHID;
      if (itemPHID && String(itemPHID) === String(projectPHID)) return true;

      // ID match
      const itemId = item.projectId ?? item.projectID ?? item.id;
      if (typeof itemId === 'number' && itemId === projectId) return true;
      if (typeof itemId === 'string' && parseInt(itemId, 10) === projectId) return true;

      // URI contains ID
      const uri = item.uri || item.projectUrl || item.url;
      if (typeof uri === 'string' && uri.includes(`/project/view/${projectId}`)) return true;

      // Name match (support different field names)
      const itemName = pickFirst(item, ['projectName', 'project_name', 'name', 'project']);
      if (itemName && projectName && String(itemName).trim() === String(projectName).trim()) return true;
      if (itemName && projectName && String(itemName).toLowerCase().includes(String(projectName).toLowerCase())) return true;

      // Slug / monogram match
      const monogram = item.monogram || item.projectNumber || item.projectSlug;
      if (monogram && projectSlug && String(monogram).toLowerCase() === String(projectSlug).toLowerCase()) return true;

      return false;
    };

    const record = scheduleData.find(matchRecord);

    const delay = record ? {
      delayGroup: record.delayGroup ?? null,
      delayName: record.delayName ?? null,
      delayType: record.delayType ?? null,
      delayResp: record.delayResp ?? null,
      delayDesc: record.delayDesc ?? null,
      mileFinishOriginal: record.mileFinishOriginal ?? null,
      mileFinishUpdate: record.mileFinishUpdate ?? null,
      estimateFinishProduceDate: record.estimateFinishProduceDate ?? null,
    } : undefined;

    if (debug === 'true') {
      const roleKeyMatcher = (k: string) => {
        const s = k.toLowerCase();
        return s.includes('project-manager') || s.includes('product-manager') || s.includes('assistant') || s.includes('developers');
      };

      return res.status(200).json({
        projectId,
        projectPHID,
        projectName,
        delay,
        roles: rolesFromProject,
        users: {
          debug: true,
          projectFieldsKeys: Object.keys(rawFields || {}),
          projectCustomKeys: rawCustom ? Object.keys(rawCustom) : [],
          roleKeySamples: collectRoleKeySamples(roleContainerCandidates, roleKeyMatcher),
          rolesFromProject,
          scheduleResult,
          scheduleDataLength: scheduleData.length,
          scheduleDataSample: scheduleData.slice(0, 3),
          projectSlug,
          matchedRecord: record || null,
          matchedRecordKeys: record ? Object.keys(record) : [],
        },
      });
    }

    const hasAnyRoleFromProject = Boolean(
      rolesFromProject.projectManagerPHID ||
        rolesFromProject.productManagerPHID ||
        rolesFromProject.assistantPHID ||
        (rolesFromProject.developersPHID && rolesFromProject.developersPHID.length > 0)
    );

    if (hasAnyRoleFromProject) {
      const allRolePHIDs = [
        rolesFromProject.projectManagerPHID,
        rolesFromProject.productManagerPHID,
        rolesFromProject.assistantPHID,
        ...(rolesFromProject.developersPHID || []),
      ].filter((p): p is string => typeof p === 'string' && p.startsWith('PHID-USER-'));

      let usersMap: Record<string, any> = {};
      if (allRolePHIDs.length > 0) {
        const usersResult = await client.call<any>('user.search', {
          constraints: {
            phids: [...new Set(allRolePHIDs)],
          },
          limit: 100,
        });

        if (usersResult?.data?.length) {
          usersResult.data.forEach((userData: any) => {
            usersMap[userData.phid] = {
              phid: userData.phid,
              userName: userData.fields?.username || '',
              realName: userData.fields?.realName || '',
              image: userData.fields?.image || null,
              uri: `${host}/p/${userData.fields?.username || ''}/`,
            };
          });
        }
      }

      return res.status(200).json({
        projectId,
        projectPHID,
        projectName,
        delay,
        roles: rolesFromProject,
        users: usersMap,
      });
    }

    const safeSplitNames = (raw: any): string[] => {
      if (!raw) return [];
      if (typeof raw !== 'string') return [];
      return raw
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
    };

    const schedulePM = typeof record?.projectManager === 'string' ? record.projectManager.trim() : '';
    const schedulePD = typeof record?.productManager === 'string' ? record.productManager.trim() : '';
    const scheduleAssistant = typeof record?.assistant === 'string' ? record.assistant.trim() : '';
    const scheduleDevelopers = safeSplitNames(record?.developers);

    const uniqueNames = Array.from(new Set([
      schedulePM,
      schedulePD,
      scheduleAssistant,
      ...scheduleDevelopers,
    ].filter(Boolean)));

    const usersByPHID: Record<string, any> = {};
    const nameToPHID: Record<string, string> = {};

    for (const name of uniqueNames) {
      try {
        const searchResult = await client.call<any>('user.search', {
          constraints: {
            nameLike: name,
          },
          limit: 20,
        });

        const candidates: any[] = Array.isArray(searchResult?.data) ? searchResult.data : [];
        const exact = candidates.find((u) => u?.fields?.realName === name) || candidates[0];
        if (exact?.phid) {
          nameToPHID[name] = exact.phid;
          usersByPHID[exact.phid] = {
            phid: exact.phid,
            userName: exact.fields?.username || '',
            realName: exact.fields?.realName || '',
            image: exact.fields?.image || null,
            uri: `${host}/p/${exact.fields?.username || ''}/`,
          };
        }
      } catch (e) {
        // ignore lookup failures
      }
    }

    const rolesFromSchedule = {
      projectManagerPHID: schedulePM ? (nameToPHID[schedulePM] || null) : null,
      productManagerPHID: schedulePD ? (nameToPHID[schedulePD] || null) : null,
      assistantPHID: scheduleAssistant ? (nameToPHID[scheduleAssistant] || null) : null,
      developersPHID: scheduleDevelopers.map((n) => nameToPHID[n]).filter((p): p is string => Boolean(p)),
    };

    return res.status(200).json({
      projectId,
      projectPHID,
      projectName,
      delay,
      roles: rolesFromSchedule,
      users: usersByPHID,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch project roles' });
  }
}
