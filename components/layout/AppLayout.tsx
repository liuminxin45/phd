import { useRouter } from 'next/router';
import { ReactNode, useMemo, useState, useEffect, useRef } from 'react';
import { Home, CheckSquare, Folder, BookOpen, GitPullRequest, X, Minus, Square, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/contexts/UserContext';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PinnedPanel } from './PinnedPanel';
import { usePinnedPanel } from '@/contexts/PinnedPanelContext';
import { NotificationPanel } from '@/components/NotificationPanel';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';

function normalizePath(url: string): string {
  const [path] = (url || '/').split('?');
  const [cleanPath] = path.split('#');
  return cleanPath || '/';
}

// Loading component for dynamic imports
const PageLoader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
  </div>
);

// Dynamically import pages to keep them mounted
const DashboardPage = dynamic(() => import('@/pages/index'), { ssr: false, loading: PageLoader });
const TasksPage = dynamic(() => import('@/pages/tasks'), { ssr: false, loading: PageLoader });
const ProjectsPage = dynamic(() => import('@/pages/projects'), { ssr: false, loading: PageLoader });
const BlogsPage = dynamic(() => import('@/pages/blogs'), { ssr: false, loading: PageLoader });
const ReviewPage = dynamic(() => import('@/pages/review'), { ssr: false, loading: PageLoader });
const ReviewAutoAiPage = dynamic(() => import('@/pages/review-auto-ai'), { ssr: false, loading: PageLoader });
const SettingsPage = dynamic(() => import('@/pages/settings'), { ssr: false, loading: PageLoader });

interface AppLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Projects', href: '/projects', icon: Folder },
  { name: 'Blogs', href: '/blogs', icon: BookOpen },
  { name: 'Review', href: '/review', icon: GitPullRequest },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { user } = useUser();
  const { isPanelExpanded } = usePinnedPanel();
  const [currentPath, setCurrentPath] = useState('/');
  const [mountedPages, setMountedPages] = useState<Set<string>>(new Set(['/', '/review', '/review-auto-ai']));
  const [pageReloadKeys, setPageReloadKeys] = useState<Record<string, number>>({});
  const [isElectron, setIsElectron] = useState(false);
  const contentAreaRef = useRef<HTMLElement | null>(null);

  // Track current path and mounted pages
  useEffect(() => {
    if (!router.isReady) return;

    const syncPath = (url?: string) => {
      const nextPath = normalizePath(url || router.asPath || router.pathname || '/');
      setCurrentPath(nextPath);
      setMountedPages((prev) => new Set(prev).add(nextPath));
    };

    syncPath();

    const handleRouteChange = (url: string) => {
      syncPath(url);
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    router.events.on('hashChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
      router.events.off('hashChangeComplete', handleRouteChange);
    };
  }, [router.isReady, router.asPath, router.pathname, router.events]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsElectron(navigator.userAgent.includes('Electron'));
  }, []);


  // Handle navigation clicks
  const handleNavigation = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    
    // If clicking already active nav item, reload the page
    if (currentPath === href) {
      setPageReloadKeys(prev => ({
        ...prev,
        [href]: (prev[href] || 0) + 1
      }));
      return;
    }
    
    // Update state immediately for instant UI feedback
    setCurrentPath(href);
    setMountedPages(prev => new Set(prev).add(href));
    
    // Use shallow routing to prevent blocking navigation
    // This allows the UI to update immediately without waiting for data fetching
    router.push(href, undefined, { shallow: true }).catch((err) => {
      // Ignore abort errors - they happen when navigation is interrupted
      if (err.message && err.message.includes('Abort')) {
        return;
      }
      console.error('[Navigation] Error:', err);
    });
  };

  const activePath = normalizePath(router.asPath || currentPath || '/');
  const currentPage = navigation.find((item) => item.href === activePath)?.name || 'Dashboard';

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Fixed Sidebar */}
      <aside className="group m-3 mr-0 flex w-16 flex-col rounded-3xl border border-white/60 bg-white/52 shadow-[0_18px_46px_rgba(15,23,42,0.12)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/42 transition-[width] duration-300 data-[collapsed=false]:w-64">
        {/* Sidebar Header */}
        <div className="flex h-14 items-center justify-center border-b border-white/45 px-3">
          <div className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-[0_0_0_6px_rgba(56,189,248,0.18)]" aria-hidden="true" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-2">
            {navigation.filter((item: any) => !item.hidden).map((item) => {
              const isActive = activePath === item.href;
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <a
                    href={item.href}
                    onClick={(e) => handleNavigation(item.href, e)}
                    className={cn(
                      "glass-interactive flex items-center justify-center rounded-xl border border-transparent p-2.5 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sky-500/45",
                      isActive
                        ? "border-white/65 bg-white/82 text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
                        : "text-slate-600 hover:border-white/55 hover:bg-white/62 hover:text-slate-900"
                    )}
                    title={item.name}
                  >
                    <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer / Settings */}
        <div className="mt-auto border-t border-white/45 p-3">
          <a
            href="/settings"
            onClick={(e) => handleNavigation('/settings', e)}
            className={cn(
              "glass-interactive flex items-center justify-center rounded-xl border border-transparent p-2.5 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sky-500/45",
              currentPath === '/settings'
                ? "border-white/65 bg-white/82 text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
                : "text-slate-600 hover:border-white/55 hover:bg-white/62 hover:text-slate-900"
            )}
            title="Settings"
          >
            <Settings className="h-5 w-5 shrink-0" />
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        {/* Custom TitleBar (frameless window) */}
        <div
          className="flex h-10 shrink-0 items-center justify-end border-b border-border bg-background px-4 select-none"
          style={({ WebkitAppRegion: isElectron ? 'drag' : undefined } as any)}
        >
          <div className="flex items-center gap-2" style={({ WebkitAppRegion: 'no-drag' } as any)}>
            {/* Notification Panel */}
            <NotificationPanel />
            
            {/* Window Controls (Electron only) */}
            {isElectron && (
              <div className="ml-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.phabdash?.windowMinimize?.()}
                  className="h-7 w-7 rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  title="Minimize"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.phabdash?.windowToggleMaximize?.()}
                  className="h-7 w-7 rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  title="Maximize"
                >
                  <Square className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.phabdash?.windowClose?.()}
                  className="h-7 w-7 rounded-sm text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Page Content */}
        <main ref={contentAreaRef} className="flex-1 overflow-hidden relative min-h-0 bg-muted/20">
          {mountedPages.has('/') && (
                        <div style={{ display: activePath === '/' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
              <DashboardPage key={pageReloadKeys['/'] || 0} />
            </div>
          )}
          {mountedPages.has('/tasks') && (
              <div style={{ display: activePath === '/tasks' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
              <TasksPage key={pageReloadKeys['/tasks'] || 0} />
            </div>
          )}
          {mountedPages.has('/projects') && (
              <div style={{ display: activePath === '/projects' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
              <ProjectsPage key={pageReloadKeys['/projects'] || 0} />
            </div>
          )}
          {mountedPages.has('/blogs') && (
              <div data-blog-scroll style={{ display: activePath === '/blogs' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
              <BlogsPage key={pageReloadKeys['/blogs'] || 0} />
            </div>
          )}
          {mountedPages.has('/review') && (
              <div style={{ display: activePath === '/review' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
              <ReviewPage key={pageReloadKeys['/review'] || 0} />
            </div>
          )}
          {mountedPages.has('/review-auto-ai') && (
              <div style={{ display: activePath === '/review-auto-ai' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
              <ReviewAutoAiPage key={pageReloadKeys['/review-auto-ai'] || 0} />
            </div>
          )}
          {mountedPages.has('/settings') && (
              <div style={{ display: activePath === '/settings' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
              <SettingsPage key={pageReloadKeys['/settings'] || 0} />
            </div>
          )}
        </main>
      </div>

      {/* Pinned Panel */}
      <PinnedPanel />
    </div>
  );
}
