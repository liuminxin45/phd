import { httpPost } from './httpClient';
import { chunkArray } from './utils/array';
import { BATCH_CONFIG, CACHE_CONFIG } from './constants/batch';

interface BatchRequestItem {
  id: string;
  method: string;
  params?: Record<string, any>;
}

interface BatchResultItem<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

interface BatchOptions {
  concurrency?: number;
  batchSize?: number;
  onProgress?: (completed: number, total: number) => void;
}

async function executeBatch<T = any>(
  requests: BatchRequestItem[]
): Promise<BatchResultItem<T>[]> {
  return httpPost<BatchResultItem<T>[]>('/api/conduit/batch', { requests });
}


export async function batchConduitCall<T = any>(
  requests: BatchRequestItem[],
  options: BatchOptions = {}
): Promise<Map<string, T>> {
  const {
    concurrency = BATCH_CONFIG.DEFAULT_CONCURRENCY,
    batchSize = BATCH_CONFIG.DEFAULT_BATCH_SIZE,
    onProgress,
  } = options;

  if (requests.length === 0) return new Map();

  const batches = chunkArray(requests, batchSize);
  const concurrencyBatches = chunkArray(batches, concurrency);
  const resultMap = new Map<string, T>();
  let completed = 0;

  for (const concurrentBatch of concurrencyBatches) {
    const batchResults = await Promise.all(
      concurrentBatch.map((batch) => executeBatch<T>(batch))
    );

    for (const results of batchResults) {
      for (const result of results) {
        if (result.success && result.data !== undefined) {
          resultMap.set(result.id, result.data);
        }
      }
      completed += results.length;
    }

    onProgress?.(completed, requests.length);
  }

  return resultMap;
}

export async function batchFetchUsers(phids: string[]): Promise<Map<string, any>> {
  if (phids.length === 0) return new Map();

  const uniquePhids = [...new Set(phids)];
  const chunks = chunkArray(uniquePhids, BATCH_CONFIG.CHUNK_SIZE_USERS);

  const requests: BatchRequestItem[] = chunks.map((chunk, idx) => ({
    id: `users_${idx}`,
    method: 'user.search',
    params: { constraints: { phids: chunk } },
  }));

  const results = await batchConduitCall(requests);
  const usersMap = new Map<string, any>();

  results.forEach((result: any) => {
    if (result?.data) {
      for (const user of result.data) {
        usersMap.set(user.phid, {
          phid: user.phid,
          userName: user.fields?.username,
          realName: user.fields?.realName,
          image: user.fields?.image || null,
        });
      }
    }
  });

  return usersMap;
}

export async function batchFetchProjects(phids: string[]): Promise<Map<string, any>> {
  if (phids.length === 0) return new Map();

  const uniquePhids = [...new Set(phids)];
  const chunks = chunkArray(uniquePhids, BATCH_CONFIG.CHUNK_SIZE_PROJECTS);

  const requests: BatchRequestItem[] = chunks.map((chunk, idx) => ({
    id: `projects_${idx}`,
    method: 'project.search',
    params: { constraints: { phids: chunk } },
  }));

  const results = await batchConduitCall(requests);
  const projectsMap = new Map<string, any>();

  results.forEach((result: any) => {
    if (result?.data) {
      for (const project of result.data) {
        projectsMap.set(project.phid, project);
      }
    }
  });

  return projectsMap;
}

export async function batchFetchTasksWithSubtasks(
  taskPhids: string[],
  options: BatchOptions = {}
): Promise<{ tasks: Map<string, any>; subtasks: Map<string, any[]> }> {
  if (taskPhids.length === 0) {
    return { tasks: new Map(), subtasks: new Map() };
  }

  const uniquePhids = [...new Set(taskPhids)];

  const taskRequests: BatchRequestItem[] = uniquePhids.map((phid) => ({
    id: phid,
    method: 'maniphest.search',
    params: { constraints: { phids: [phid] } },
  }));

  const subtaskRequests: BatchRequestItem[] = uniquePhids.map((phid) => ({
    id: `subtask_${phid}`,
    method: 'maniphest.search',
    params: { constraints: { parentIDs: [phid.replace('PHID-TASK-', '')] } },
  }));

  const allRequests = [...taskRequests, ...subtaskRequests];
  const results = await batchConduitCall(allRequests, options);

  const tasks = new Map<string, any>();
  const subtasks = new Map<string, any[]>();

  results.forEach((result: any, id: string) => {
    if (id.startsWith('subtask_')) {
      const parentPhid = id.replace('subtask_', '');
      subtasks.set(parentPhid, result?.data || []);
    } else {
      if (result?.data?.[0]) {
        tasks.set(id, result.data[0]);
      }
    }
  });

  return { tasks, subtasks };
}

const userCache = new Map<string, any>();
const projectCache = new Map<string, any>();
let lastCacheClear = Date.now();

function clearStaleCache() {
  const now = Date.now();
  if (now - lastCacheClear > CACHE_CONFIG.TTL_MS) {
    userCache.clear();
    projectCache.clear();
    lastCacheClear = now;
  }
}

export async function getCachedUsers(phids: string[]): Promise<Map<string, any>> {
  clearStaleCache();

  const uncachedPhids = phids.filter((phid) => !userCache.has(phid));

  if (uncachedPhids.length > 0) {
    const fetched = await batchFetchUsers(uncachedPhids);
    fetched.forEach((user, phid) => userCache.set(phid, user));
  }

  const result = new Map<string, any>();
  phids.forEach((phid) => {
    const user = userCache.get(phid);
    if (user) result.set(phid, user);
  });

  return result;
}

export async function getCachedProjects(phids: string[]): Promise<Map<string, any>> {
  clearStaleCache();

  const uncachedPhids = phids.filter((phid) => !projectCache.has(phid));

  if (uncachedPhids.length > 0) {
    const fetched = await batchFetchProjects(uncachedPhids);
    fetched.forEach((project, phid) => projectCache.set(phid, project));
  }

  const result = new Map<string, any>();
  phids.forEach((phid) => {
    const project = projectCache.get(phid);
    if (project) result.set(phid, project);
  });

  return result;
}

export async function batchFetchSubtasks(
  taskIds: number[],
  options: BatchOptions = {}
): Promise<Map<number, any[]>> {
  const { onProgress } = options;
  
  if (taskIds.length === 0) return new Map();

  const uniqueIds = [...new Set(taskIds)];
  const chunks = chunkArray(uniqueIds, BATCH_CONFIG.CHUNK_SIZE_SUBTASKS);
  const resultMap = new Map<number, any[]>();
  let completed = 0;

  const chunkPromises = chunks.map(async (chunk) => {
    const response = await httpPost<{ results: Record<number, any[]> }>(
      '/api/tasks/batch-subtasks',
      { taskIds: chunk }
    );
    return response.results;
  });

  const results = await Promise.all(chunkPromises);

  for (const chunkResult of results) {
    for (const [taskId, subtasks] of Object.entries(chunkResult)) {
      resultMap.set(parseInt(taskId), subtasks);
      completed++;
    }
    onProgress?.(completed, uniqueIds.length);
  }

  return resultMap;
}

export async function batchFetchProjectStats(
  projectIds: number[],
  options: BatchOptions = {}
): Promise<Map<number, { 
  progress: number; 
  total: number;
  open: number;
  inProgress: number;
  completed: number;
}>> {
  const { onProgress } = options;
  
  if (projectIds.length === 0) return new Map();

  const uniqueIds = [...new Set(projectIds)];
  const chunks = chunkArray(uniqueIds, BATCH_CONFIG.CHUNK_SIZE_STATS);
  const resultMap = new Map<number, { 
    progress: number; 
    total: number;
    open: number;
    inProgress: number;
    completed: number;
  }>();
  let completed = 0;

  const chunkPromises = chunks.map(async (chunk) => {
    const response = await httpPost<{ 
      results: Record<number, { 
        progress: number; 
        total: number;
        open: number;
        inProgress: number;
        completed: number;
      }> 
    }>(
      '/api/projects/batch-stats',
      { projectIds: chunk }
    );
    return response.results;
  });

  const results = await Promise.all(chunkPromises);

  for (const chunkResult of results) {
    for (const [projectId, stats] of Object.entries(chunkResult)) {
      resultMap.set(parseInt(projectId), stats);
      completed++;
    }
    onProgress?.(completed, uniqueIds.length);
  }

  return resultMap;
}
