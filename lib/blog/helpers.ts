import type { ApiBlogPost, BlogPost } from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

export const CATEGORIES = ['Engineering', 'Design', 'Product', 'Infrastructure', 'DevOps', 'Security'];

export const TAGS = [
  'React', 'TypeScript', 'Performance', 'CI/CD', 'GraphQL',
  'Kubernetes', 'Testing', 'Architecture', 'Monitoring', 'API',
  'Frontend', 'Backend', 'Database', 'Docker', 'Microservices',
];

export const SORT_OPTIONS = [
  { label: '最新', value: 'newest' },
  { label: '最早', value: 'oldest' },
  { label: '最多赞', value: 'tokenCount' },
  { label: '推荐', value: 'recommended' },
];

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** Known image file extensions for client-side MIME inference */
export const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif',
]);

// ─── Date helpers ────────────────────────────────────────────────────────────

export function formatEpoch(epoch: number): string {
  if (!epoch) return '';
  const d = new Date(epoch * 1000);
  return d.toISOString().slice(0, 10);
}

export function getWeekday(epoch: number): string {
  if (!epoch) return '';
  return WEEKDAY_NAMES[new Date(epoch * 1000).getDay()];
}

export function getISOWeek(epoch: number): number {
  const d = new Date(epoch * 1000);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/**
 * Returns a default weekly report title like "【工作周报】20260202-20260206"
 * covering the most recent completed Mon–Fri work week.
 */
export function getLastWeekRange(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysBack = day >= 6 || day === 0 ? (day === 0 ? 6 : day - 1) : day - 1 + 7;
  const lastMon = new Date(now);
  lastMon.setDate(now.getDate() - daysBack);
  lastMon.setHours(0, 0, 0, 0);
  const lastFri = new Date(lastMon);
  lastFri.setDate(lastMon.getDate() + 4);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
  };
  return `【工作周报】${fmt(lastMon)}-${fmt(lastFri)}`;
}

// ─── Data transforms ─────────────────────────────────────────────────────────

export function apiPostToBlogPost(p: ApiBlogPost): BlogPost {
  return {
    id: p.id,
    title: p.title,
    summary: p.summary,
    author: p.authorName,
    publishedAt: formatEpoch(p.datePublished || p.dateCreated),
    category: '',
    tags: p.projectTags || [],
    readTime: p.readTime,
    tokenCount: p.tokenCount ?? 0,
  };
}

/** Compute dynamic trend thresholds from all posts: top 10% = hot, top 30% = trending */
export function computeTrendThresholds(posts: { tokenCount: number }[]): { hot: number; trend: number } {
  const counts = posts.map(p => p.tokenCount).filter(c => c > 0).sort((a, b) => b - a);
  if (counts.length === 0) return { hot: Infinity, trend: Infinity };
  const hotIdx = Math.max(0, Math.ceil(counts.length * 0.1) - 1);
  const trendIdx = Math.max(0, Math.ceil(counts.length * 0.3) - 1);
  return {
    hot: Math.max(counts[hotIdx] ?? Infinity, 3),
    trend: Math.max(counts[trendIdx] ?? Infinity, 1),
  };
}
