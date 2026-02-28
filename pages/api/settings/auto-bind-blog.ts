import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { ConduitClient } from '@/lib/conduit/client';
import type { EnvEntry } from '@/lib/settings/types';

const PROJECT_ROOT = process.cwd();
const ENV_LOCAL_PATH = path.join(PROJECT_ROOT, '.env.local');

interface BlogLite {
  id: number;
  phid: string;
  name: string;
}

function parseEnvFile(filePath: string): EnvEntry[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf-8');
  const entries: EnvEntry[] = [];
  let pendingComment = '';

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      pendingComment += (pendingComment ? '\n' : '') + trimmed;
      continue;
    }
    if (!trimmed) {
      pendingComment = '';
      continue;
    }
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    entries.push({ key, value, comment: pendingComment || undefined });
    pendingComment = '';
  }

  return entries;
}

function serializeEnvEntries(entries: EnvEntry[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.comment) {
      lines.push(entry.comment);
    }
    lines.push(`${entry.key}=${entry.value}`);
  }
  return lines.join('\n') + '\n';
}

function parseBlogMap(raw: string | undefined): Record<string, string> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const normalized = Object.entries(parsed as Record<string, unknown>)
      .map(([key, value]) => [key.trim().toLowerCase(), typeof value === 'string' ? value.trim() : ''] as const)
      .filter(([key, value]) => key && value);

    return Object.fromEntries(normalized);
  } catch {
    return {};
  }
}

function selectUniqueBlog(blogs: BlogLite[], realName: string): BlogLite {
  if (blogs.length === 1) return blogs[0];

  const exact = realName
    ? blogs.filter((b) => b.name === `${realName}的博客` || b.name === `${realName}博客` || b.name === realName)
    : [];
  if (exact.length === 1) return exact[0];

  const fuzzy = realName ? blogs.filter((b) => b.name.includes(realName)) : [];
  if (fuzzy.length === 1) return fuzzy[0];

  throw new Error(`当前用户命中多个博客，无法自动唯一绑定。候选博客：${JSON.stringify(blogs)}`);
}

function getCandidateKeys(userName: string, realName: string, userPHID: string): string[] {
  return [userName, realName, userPHID]
    .map((v) => (v || '').trim().toLowerCase())
    .filter(Boolean);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const host = process.env.PHA_HOST;
  const token = process.env.PHA_TOKEN;

  if (!host || !token) {
    return res.status(500).json({ error: '缺少 PHA_HOST 或 PHA_TOKEN，无法自动绑定博客' });
  }

  try {
    const client = new ConduitClient(host, token);
    const whoami = await client.call<any>('user.whoami', {});

    const userPHID = (whoami?.phid || '').trim();
    const userName = (whoami?.userName || whoami?.username || '').trim();
    const realName = (whoami?.realName || '').trim();

    if (!userPHID) {
      return res.status(400).json({ error: '当前用户缺少有效 PHID，无法自动绑定博客' });
    }

    const candidateKeys = getCandidateKeys(userName, realName, userPHID);

    if (req.method === 'GET' || req.method === 'DELETE') {
      const entries = parseEnvFile(ENV_LOCAL_PATH);
      const existing = parseBlogMap(entries.find((e) => e.key === 'BLOG_PHID_MAP')?.value);
      const mappedBlogPHID = candidateKeys
        .map((k) => existing[k])
        .find((v) => typeof v === 'string' && v.length > 0);

      if (req.method === 'GET') {
        let resolvedBlog: BlogLite | null = null;
        if (mappedBlogPHID) {
          const mappedBlogSearch = await client.call<{ data?: Array<{ id?: number; phid?: string; fields?: { name?: string } }> }>('phame.blog.search', {
            queryKey: 'all',
            constraints: { phids: [mappedBlogPHID] },
            order: 'newest',
            limit: 1,
          });
          const b = (mappedBlogSearch?.data || [])[0];
          if (b?.phid) {
            resolvedBlog = { id: b.id || 0, phid: b.phid || '', name: b.fields?.name || '' };
          }
        }
        return res.status(200).json({
          success: true,
          data: {
            bound: Boolean(mappedBlogPHID),
            user: { phid: userPHID, userName, realName },
            blogPHID: mappedBlogPHID || null,
            resolvedBlog,
          },
        });
      }

      let changed = false;
      for (const key of candidateKeys) {
        if (existing[key]) {
          delete existing[key];
          changed = true;
        }
      }
      if (changed) {
        const mapValue = JSON.stringify(existing);
        const idx = entries.findIndex((e) => e.key === 'BLOG_PHID_MAP');
        if (idx >= 0) {
          entries[idx] = { ...entries[idx], value: mapValue };
        } else {
          entries.push({ key: 'BLOG_PHID_MAP', value: mapValue });
        }
        fs.writeFileSync(ENV_LOCAL_PATH, serializeEnvEntries(entries), 'utf-8');
      }
      return res.status(200).json({
        success: true,
        message: changed ? '已解除当前用户博客绑定。' : '当前用户没有可解除的博客绑定。',
        data: {
          user: { phid: userPHID, userName, realName },
          bound: false,
        },
      });
    }

    const blogSearch = await client.call<{ data?: Array<{ id?: number; phid?: string; fields?: { name?: string } }> }>('phame.blog.search', {
      queryKey: 'all',
      constraints: {
        subscribers: [userPHID],
      },
      order: 'newest',
      limit: 100,
    });

    const blogs: BlogLite[] = (blogSearch?.data || []).map((b) => ({
      id: b.id || 0,
      phid: b.phid || '',
      name: b.fields?.name || '',
    })).filter((b) => b.phid);

    let candidateBlogs = blogs;
    let strategy = 'subscribers';

    if (candidateBlogs.length === 0) {
      const ownPostSearch = await client.call<{ data?: Array<{ phid?: string; fields?: { title?: string; blogPHID?: string } }> }>('phame.post.search', {
        queryKey: 'all',
        constraints: {
          authorPHIDs: [userPHID],
        },
        order: 'newest',
        limit: 30,
      });

      const postSample = (ownPostSearch?.data || []).map((p) => ({
        phid: p.phid || '',
        blogPHID: p.fields?.blogPHID || '',
        title: p.fields?.title || '',
      }));

      const uniqueBlogPHIDs = Array.from(new Set(postSample.map((p) => p.blogPHID).filter(Boolean)));

      if (uniqueBlogPHIDs.length > 0) {
        const fallbackBlogSearch = await client.call<{ data?: Array<{ id?: number; phid?: string; fields?: { name?: string } }> }>('phame.blog.search', {
          queryKey: 'all',
          constraints: { phids: uniqueBlogPHIDs },
          order: 'newest',
          limit: uniqueBlogPHIDs.length,
        });

        candidateBlogs = (fallbackBlogSearch?.data || []).map((b) => ({
          id: b.id || 0,
          phid: b.phid || '',
          name: b.fields?.name || '',
        })).filter((b) => b.phid);
        strategy = 'author-posts';
      }
    }

    if (candidateBlogs.length === 0) {
      return res.status(400).json({
        error: '未找到当前用户可绑定的博客（subscribers 与 author posts 均为空）',
      });
    }

    const resolvedBlog = selectUniqueBlog(candidateBlogs, realName);

    const entries = parseEnvFile(ENV_LOCAL_PATH);
    const existing = parseBlogMap(entries.find((e) => e.key === 'BLOG_PHID_MAP')?.value);

    const nextMap: Record<string, string> = {
      ...existing,
      ...(userName ? { [userName.toLowerCase()]: resolvedBlog.phid } : {}),
      ...(realName ? { [realName.toLowerCase()]: resolvedBlog.phid } : {}),
      [userPHID.toLowerCase()]: resolvedBlog.phid,
    };

    const mapValue = JSON.stringify(nextMap);
    const idx = entries.findIndex((e) => e.key === 'BLOG_PHID_MAP');
    if (idx >= 0) {
      entries[idx] = { ...entries[idx], value: mapValue };
    } else {
      entries.push({ key: 'BLOG_PHID_MAP', value: mapValue });
    }

    fs.writeFileSync(ENV_LOCAL_PATH, serializeEnvEntries(entries), 'utf-8');

    return res.status(200).json({
      success: true,
      message: '已自动绑定当前用户博客到 BLOG_PHID_MAP。',
      data: {
        user: {
          phid: userPHID,
          userName,
          realName,
        },
        resolvedBlog,
        mapKeys: Object.keys(nextMap),
        strategy,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || '自动绑定博客失败' });
  }
}
