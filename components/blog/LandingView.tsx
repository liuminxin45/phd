import {
  Calendar,
  FileText,
  Star,
  User,
  ChevronRight,
  ClipboardList,
  Newspaper,
  Loader2,
} from 'lucide-react';
import type { ApiBlogPost } from '@/lib/blog/types';
import { formatEpoch, getWeekday } from '@/lib/blog/helpers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { glassSectionClass } from '@/components/ui/glass';

export function LandingView({ onNavigate, techPosts, reportPosts, loading }: {
  onNavigate: (view: 'tech' | 'report') => void;
  techPosts: ApiBlogPost[];
  reportPosts: ApiBlogPost[];
  loading: boolean;
}) {
  const latestReport = reportPosts[0];
  const latestTech = techPosts[0];

  return (
    <div className="space-y-6 py-3">
      {/* Dual Entry Cards */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-1 md:grid-cols-2">
        {/* Entry 1: Weekly Report */}
        <Card
          onClick={() => onNavigate('report')}
          className={cn(
            "glass-interactive group cursor-pointer overflow-hidden rounded-3xl border border-white/65 bg-white/66",
            "shadow-[0_16px_34px_rgba(15,23,42,0.12)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/52",
            "transition-all duration-300 hover:-translate-y-1 hover:border-sky-200/85 hover:bg-white/78"
          )}
        >
          <CardContent className="p-7 md:p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-200/70 bg-sky-50/82 text-sky-700 shadow-[0_10px_22px_rgba(14,116,144,0.14)] transition-transform duration-300 group-hover:scale-105">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground transition-colors group-hover:text-sky-700">Weekly Report</h2>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Weekly Digest</p>
              </div>
            </div>
            
            <p className="mb-7 h-10 text-sm leading-relaxed text-slate-600">
              Focus on weekly progress, blockers, and collaboration updates.
            </p>
            
            <div className={cn(glassSectionClass, "mb-7 space-y-3 rounded-2xl border border-white/60 bg-white/70 p-4 transition-all group-hover:border-sky-200/70 group-hover:bg-sky-50/56")}>
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : latestReport ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Latest: {formatEpoch(latestReport.datePublished || latestReport.dateCreated)} ({getWeekday(latestReport.datePublished || latestReport.dateCreated)})</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-1">{latestReport.title}</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">No weekly reports yet</div>
              )}
            </div>
            
            <Button className="h-10 w-full rounded-xl border border-sky-300/75 bg-sky-500 text-white shadow-[0_12px_24px_rgba(14,116,144,0.24)] transition-all hover:-translate-y-0.5 hover:bg-sky-600" variant="secondary">
              Open Weekly Reports
              <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>

        {/* Entry 2: Tech Blog */}
        <Card
          onClick={() => onNavigate('tech')}
          className={cn(
            "glass-interactive group cursor-pointer overflow-hidden rounded-3xl border border-white/65 bg-white/66",
            "shadow-[0_16px_34px_rgba(15,23,42,0.12)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/52",
            "transition-all duration-300 hover:-translate-y-1 hover:border-sky-200/85 hover:bg-white/78"
          )}
        >
          <CardContent className="p-7 md:p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-50/84 text-amber-700 shadow-[0_10px_22px_rgba(217,119,6,0.14)] transition-transform duration-300 group-hover:scale-105">
                <Newspaper className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground transition-colors group-hover:text-amber-700">Tech Blog</h2>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Tech Blog</p>
              </div>
            </div>
            
            <p className="mb-7 h-10 text-sm leading-relaxed text-slate-600">
              Deep dives on engineering practice, architecture, and lessons learned.
            </p>
            
            <div className={cn(glassSectionClass, "mb-7 space-y-3 rounded-2xl border border-white/60 bg-white/70 p-4 transition-all group-hover:border-amber-200/70 group-hover:bg-amber-50/50")}>
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : latestTech ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                    <span className="line-clamp-1">Latest: {latestTech.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span>{latestTech.authorName}</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">No tech posts yet</div>
              )}
            </div>
            
            <Button className="h-10 w-full rounded-xl border border-amber-300/75 bg-amber-500 text-white shadow-[0_12px_24px_rgba(217,119,6,0.24)] transition-all hover:-translate-y-0.5 hover:bg-amber-600" variant="secondary">
              Open Tech Blog
              <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
