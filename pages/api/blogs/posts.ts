import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

// Project PHIDs for blog classification
const MANAGEMENT_PROJECT = 'PHID-PROJ-mrufmvaavu5kxsvys3ko';
const REPORT_PROJECT = 'PHID-PROJ-5r2wcb3ptiy7lmdawmbg';

// Cache token counts (refreshed every 5 minutes)
let tokenCountCache: Map<string, number> | null = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_TTL = 5 * 60 * 1000;

interface PhamePost {
  id: number;
  phid: string;
  fields: {
    title: string;
    slug: string;
    authorPHID: string;
    blogPHID: string;
    body: string;
    datePublished: number;
    dateCreated: number;
    dateModified: number;
    policy: Record<string, any>;
  };
  attachments?: {
    projects?: {
      projectPHIDs: string[];
    };
  };
}

interface PhameSearchResult {
  data: PhamePost[];
  cursor: {
    limit: number;
    after: string | null;
    before: string | null;
  };
}

interface UserInfo {
  phid: string;
  userName: string;
  realName: string;
  image: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
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

    const client = new ConduitClient(host, token);

    const type = (req.query.type as string) || 'tech'; // 'tech' | 'report'
    const limit = parseInt(req.query.limit as string) || 100;
    const after = (req.query.after as string) || null;
    const queryKey = (req.query.queryKey as string) || 'all';
    const sort = (req.query.sort as string) || 'newest'; // newest | oldest | tokenCount | recommended
    const featured = req.query.featured === 'true'; // 90-day popular posts
    const isRecommended = sort === 'recommended';

    // Build project constraints
    // All blogs: exclude management project
    // Tech: also exclude report project
    // Report: require report project
    const projects: string[] = [`not(${MANAGEMENT_PROJECT})`];

    if (type === 'tech') {
      projects.push(`not(${REPORT_PROJECT})`);
    } else if (type === 'report') {
      projects.push(`any(${REPORT_PROJECT})`);
    }

    const constraints: Record<string, any> = { projects };

    // For featured/recommended mode, restrict to last 90 days
    if (featured || isRecommended) {
      const nowEpoch = Math.floor(Date.now() / 1000);
      const ninetyDaysAgo = nowEpoch - 90 * 24 * 60 * 60;
      constraints.publishedStart = ninetyDaysAgo;
    }

    const params: Record<string, any> = {
      queryKey,
      constraints,
      attachments: { projects: true },
      order: (featured || isRecommended) ? 'tokenCount' : sort,
      limit,
    };

    if (after) {
      params.after = after;
    }

    const result = await client.call<PhameSearchResult>('phame.post.search', params);

    // Fetch token counts (cached for 5 minutes)
    const now = Date.now();
    if (!tokenCountCache || now - tokenCacheTime > TOKEN_CACHE_TTL) {
      try {
        const tokensRaw = await client.call<any>('token.given', {});
        const allTokens: any[] = Array.isArray(tokensRaw)
          ? tokensRaw
          : (typeof tokensRaw === 'object' && tokensRaw !== null)
            ? Object.values(tokensRaw)
            : [];
        const counts = new Map<string, number>();
        for (const t of allTokens) {
          counts.set(t.objectPHID, (counts.get(t.objectPHID) || 0) + 1);
        }
        tokenCountCache = counts;
        tokenCacheTime = now;
      } catch {
        if (!tokenCountCache) tokenCountCache = new Map();
      }
    }

    // Collect unique author PHIDs
    const authorPhids = [...new Set(result.data.map((p) => p.fields.authorPHID))];

    // Batch fetch author info
    const usersMap = new Map<string, UserInfo>();
    if (authorPhids.length > 0) {
      try {
        const userResult = await client.call<{ data: any[] }>('user.search', {
          constraints: { phids: authorPhids },
        });
        for (const u of userResult.data) {
          usersMap.set(u.phid, {
            phid: u.phid,
            userName: u.fields?.username || '',
            realName: u.fields?.realName || '',
            image: u.fields?.image || null,
          });
        }
      } catch {
        // If user fetch fails, continue without author info
      }
    }

    // Collect unique project PHIDs for tag name resolution
    const allProjectPhids = [...new Set(
      result.data.flatMap((p) => p.attachments?.projects?.projectPHIDs || [])
    )].filter((phid) => phid !== MANAGEMENT_PROJECT && phid !== REPORT_PROJECT);

    // Batch fetch project names
    const projectsMap = new Map<string, string>();
    if (allProjectPhids.length > 0) {
      try {
        const projResult = await client.call<{ data: any[] }>('project.search', {
          constraints: { phids: allProjectPhids },
        });
        for (const p of projResult.data) {
          projectsMap.set(p.phid, p.fields?.name || '');
        }
      } catch {
        // If project fetch fails, continue without tag names
      }
    }

    // Transform posts
    const posts = result.data.map((post) => {
      const author = usersMap.get(post.fields.authorPHID);
      const body = post.fields.body || '';
      // Estimate read time: ~200 words/min for Chinese, ~250 chars/min
      const readTimeMin = Math.max(1, Math.ceil(body.length / 250));

      const projectPHIDs = (post.attachments?.projects?.projectPHIDs || [])
        .filter((phid: string) => phid !== MANAGEMENT_PROJECT && phid !== REPORT_PROJECT);
      const projectTags = projectPHIDs
        .map((phid: string) => projectsMap.get(phid))
        .filter(Boolean) as string[];

      return {
        id: post.id,
        phid: post.phid,
        title: post.fields.title,
        slug: post.fields.slug,
        body,
        summary: body.replace(/[=#*\[\]{}|>~`]/g, '').slice(0, 200),
        authorPHID: post.fields.authorPHID,
        authorName: author?.realName || author?.userName || 'Unknown',
        authorImage: author?.image || null,
        blogPHID: post.fields.blogPHID,
        datePublished: post.fields.datePublished,
        dateCreated: post.fields.dateCreated,
        dateModified: post.fields.dateModified,
        readTime: `${readTimeMin} min`,
        tokenCount: tokenCountCache?.get(post.phid) || 0,
        projectPHIDs,
        projectTags,
      };
    });

    res.status(200).json({
      data: posts,
      cursor: result.cursor,
    });
  } catch (error: any) {
    console.error('Blog posts API error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch blog posts' });
  }
}
