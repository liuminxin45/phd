import { ConduitClient } from './client';

export interface BatchRequest {
  id: string;
  method: string;
  params?: Record<string, any>;
}

export interface BatchResult<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

export interface BatchOptions {
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
}

export class ConduitBatch {
  private client: ConduitClient;
  private defaultConcurrency = 5;

  constructor(client: ConduitClient) {
    this.client = client;
  }

  async execute<T = any>(
    requests: BatchRequest[],
    options: BatchOptions = {}
  ): Promise<BatchResult<T>[]> {
    const { concurrency = this.defaultConcurrency, onProgress } = options;
    const results: BatchResult<T>[] = [];
    let completed = 0;

    const chunks = this.chunkArray(requests, concurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (req) => {
          try {
            const data = await this.client.call<T>(req.method, req.params || {});
            return { id: req.id, success: true, data } as BatchResult<T>;
          } catch (error: any) {
            return { id: req.id, success: false, error: error.message } as BatchResult<T>;
          }
        })
      );

      results.push(...chunkResults);
      completed += chunk.length;
      onProgress?.(completed, requests.length);
    }

    return results;
  }

  async executeParallel<T = any>(
    requests: BatchRequest[],
    options: BatchOptions = {}
  ): Promise<Map<string, T>> {
    const results = await this.execute<T>(requests, options);
    const map = new Map<string, T>();

    for (const result of results) {
      if (result.success && result.data !== undefined) {
        map.set(result.id, result.data);
      }
    }

    return map;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

let batchInstance: ConduitBatch | null = null;

export function getConduitBatch(): ConduitBatch {
  if (!batchInstance) {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;
    if (!host || !token) {
      throw new Error('Missing PHA_HOST or PHA_TOKEN');
    }
    batchInstance = new ConduitBatch(new ConduitClient(host, token));
  }
  return batchInstance;
}

export async function batchFetchUsers(
  phids: string[],
  concurrency = 3
): Promise<Map<string, any>> {
  if (phids.length === 0) return new Map();

  const batch = getConduitBatch();
  const chunks = chunkArray(phids, 100);

  const requests: BatchRequest[] = chunks.map((chunk, idx) => ({
    id: `users_${idx}`,
    method: 'user.search',
    params: { constraints: { phids: chunk } },
  }));

  const results = await batch.execute(requests, { concurrency });
  const usersMap = new Map<string, any>();

  for (const result of results) {
    if (result.success && result.data?.data) {
      for (const user of result.data.data) {
        usersMap.set(user.phid, user);
      }
    }
  }

  return usersMap;
}

export async function batchFetchProjects(
  phids: string[],
  concurrency = 3
): Promise<Map<string, any>> {
  if (phids.length === 0) return new Map();

  const batch = getConduitBatch();
  const chunks = chunkArray(phids, 100);

  const requests: BatchRequest[] = chunks.map((chunk, idx) => ({
    id: `projects_${idx}`,
    method: 'project.search',
    params: { constraints: { phids: chunk } },
  }));

  const results = await batch.execute(requests, { concurrency });
  const projectsMap = new Map<string, any>();

  for (const result of results) {
    if (result.success && result.data?.data) {
      for (const project of result.data.data) {
        projectsMap.set(project.phid, project);
      }
    }
  }

  return projectsMap;
}

export async function batchFetchTasks(
  phids: string[],
  concurrency = 3
): Promise<Map<string, any>> {
  if (phids.length === 0) return new Map();

  const batch = getConduitBatch();
  const chunks = chunkArray(phids, 100);

  const requests: BatchRequest[] = chunks.map((chunk, idx) => ({
    id: `tasks_${idx}`,
    method: 'maniphest.search',
    params: { constraints: { phids: chunk } },
  }));

  const results = await batch.execute(requests, { concurrency });
  const tasksMap = new Map<string, any>();

  for (const result of results) {
    if (result.success && result.data?.data) {
      for (const task of result.data.data) {
        tasksMap.set(task.phid, task);
      }
    }
  }

  return tasksMap;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
