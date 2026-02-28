import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

const REPORT_PROJECT = 'PHID-PROJ-5r2wcb3ptiy7lmdawmbg';

type PublishType = 'tech' | 'report';
type PublishStatus = 'draft' | 'published';

interface PublishBody {
  type?: PublishType;
  title?: string;
  body?: string;
  status?: PublishStatus;
  category?: string | null;
  projectPHIDs?: string[];
  blogPHID?: string | null;
  objectIdentifier?: string | number | null;
}

function parseBlogPHIDMap(raw: string | undefined): Record<string, string> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed as Record<string, unknown>)
      .map(([k, v]) => [k.trim().toLowerCase(), typeof v === 'string' ? v.trim() : ''] as const)
      .filter(([k, v]) => k && v);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

async function inferBlogPHID(client: ConduitClient): Promise<string> {

  let currentUserPHID = '';
  let currentUserName = '';
  let currentUserRealName = '';
  try {
    const whoami = await client.call<any>('user.whoami', {});
    currentUserPHID = whoami?.phid || '';
    currentUserName = (whoami?.userName || whoami?.username || '').trim();
    currentUserRealName = whoami?.realName || '';
  } catch (error: any) {
    throw new Error(`无法获取当前登录用户信息（user.whoami）：${error?.message || '未知错误'}`);
  }

  if (!currentUserPHID) {
    throw new Error('当前登录用户缺少有效 PHID，无法匹配所属博客');
  }

  try {
    const mappedBlogByUser = parseBlogPHIDMap(process.env.BLOG_PHID_MAP);

    const candidateKeys = [
      currentUserName,
      currentUserRealName,
      currentUserPHID,
    ].map((v) => (v || '').trim().toLowerCase()).filter(Boolean);

    const mappedBlogPHID = candidateKeys
      .map((k) => mappedBlogByUser[k])
      .find((v) => typeof v === 'string' && v.length > 0);

    if (!mappedBlogPHID) {
      throw new Error(
        `未在 BLOG_PHID_MAP 中找到当前用户映射。请在环境变量配置 JSON（key->blogPHID），例如 {"${currentUserName || 'yourUserName'}":"PHID-BLOG-..."}。当前候选key：${JSON.stringify(candidateKeys)}`
      );
    }

    const mappedBlogSearch = await client.call<{ data?: Array<{ id?: number; phid?: string; fields?: { name?: string } }> }>('phame.blog.search', {
      queryKey: 'all',
      constraints: { phids: [mappedBlogPHID] },
      order: 'newest',
      limit: 1,
    });

    const mappedBlog = (mappedBlogSearch?.data || [])[0];
    if (!mappedBlog?.phid) {
      throw new Error(`BLOG_PHID_MAP 配置的 blogPHID 无效或无权限访问：${mappedBlogPHID}`);
    }
    return mappedBlog.phid;
  } catch (error: any) {
    if (
      error?.message?.includes('未在 BLOG_PHID_MAP') ||
      error?.message?.includes('BLOG_PHID_MAP 配置的 blogPHID 无效')
    ) {
      throw error;
    }
    throw new Error(`根据 BLOG_PHID_MAP 解析博客失败：${error?.message || '未知错误'}`);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const host = process.env.PHA_HOST;
  const token = process.env.PHA_TOKEN;

  if (!host || !token) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const {
    type = 'tech',
    title,
    body,
    status = 'published',
    category,
    projectPHIDs = [],
    blogPHID,
    objectIdentifier,
  } = (req.body || {}) as PublishBody;

  if (type !== 'tech' && type !== 'report') {
    return res.status(400).json({ error: 'type must be tech or report' });
  }

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'body is required' });
  }

  if (status !== 'draft' && status !== 'published') {
    return res.status(400).json({ error: 'status must be draft or published' });
  }

  try {
    const client = new ConduitClient(host, token);

    const resolvedBlogPHID = blogPHID && blogPHID.trim()
      ? blogPHID.trim()
      : await inferBlogPHID(client);

    const transactions: Array<{ type: string; value: any }> = [
      { type: 'blog', value: resolvedBlogPHID },
      { type: 'title', value: title.trim() },
      { type: 'body', value: body.trim() },
      { type: 'subtitle', value: (category || '').trim() },
    ];

    // Deployment-specific: visibility values are numeric enums in this Conduit instance.
    if (status === 'draft') {
      transactions.push({ type: 'visibility', value: '100' });
    }

    const normalizedProjectPHIDs = Array.from(new Set(projectPHIDs.filter((phid) => typeof phid === 'string' && phid.trim())));
    if (type === 'report' && !normalizedProjectPHIDs.includes(REPORT_PROJECT)) {
      normalizedProjectPHIDs.push(REPORT_PROJECT);
    }
    if (normalizedProjectPHIDs.length > 0) {
      transactions.push({ type: 'projects.set', value: normalizedProjectPHIDs });
    }

    const result = await client.call<any>('phame.post.edit', {
      objectIdentifier: objectIdentifier ? String(objectIdentifier) : '',
      transactions,
    });

    return res.status(200).json({
      success: true,
      result,
      blogPHID: resolvedBlogPHID,
    });
  } catch (error: any) {
    const message = error?.message || 'Failed to publish post';
    const isUnboundBlogError =
      message.includes('未在 BLOG_PHID_MAP') ||
      message.includes('BLOG_PHID_MAP 配置的 blogPHID 无效');

    if (isUnboundBlogError) {
      return res.status(400).json({
        error: `${message}。请前往“设置 -> 环境变量”，点击“绑定博客”后重试。`,
        code: 'BLOG_NOT_BOUND',
        action: {
          label: '去设置绑定博客',
          path: '/settings',
        },
      });
    }

    console.error('[Blog Publish] Error:', message);
    return res.status(500).json({ error: message });
  }
}
