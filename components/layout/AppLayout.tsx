import { useRouter } from 'next/router';
import { ReactNode, useMemo, useState, useEffect, useRef } from 'react';
import { Home, CheckSquare, Folder, BookOpen, Search, X, Minus, Square, Settings } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PinnedPanel } from './PinnedPanel';
import { usePinnedPanel } from '@/contexts/PinnedPanelContext';
import { NotificationPanel } from '@/components/NotificationPanel';
import dynamic from 'next/dynamic';

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
const SettingsPage = dynamic(() => import('@/pages/settings'), { ssr: false, loading: PageLoader });

interface AppLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Projects', href: '/projects', icon: Folder },
  { name: 'Blogs', href: '/blogs', icon: BookOpen },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { user } = useUser();
  const { isPanelExpanded } = usePinnedPanel();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [mountedPages, setMountedPages] = useState<Set<string>>(new Set(['/']));
  const [pageReloadKeys, setPageReloadKeys] = useState<Record<string, number>>({});
  const [isElectron, setIsElectron] = useState(false);
  const contentAreaRef = useRef<HTMLElement | null>(null);

  // Track current path and mounted pages
  useEffect(() => {
    setCurrentPath(router.pathname);
    setMountedPages(prev => new Set(prev).add(router.pathname));
  }, [router.pathname]);

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

  // Mock search data
  const allData = {
    tasks: [
      { id: 'T123', title: 'Implement user authentication', type: 'Task' },
      { id: 'T124', title: 'Fix memory leak in data processor', type: 'Task' },
      { id: 'T125', title: 'Update API documentation', type: 'Task' },
    ],
    projects: [
      { id: 'P1', title: 'Backend Services', type: 'Project' },
      { id: 'P2', title: 'Frontend Redesign', type: 'Project' },
      { id: 'P3', title: 'Mobile App', type: 'Project' },
    ],
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const results: any[] = [];
    const lowerQuery = query.toLowerCase();

    Object.values(allData).forEach((category) => {
      category.forEach((item) => {
        if (item.title.toLowerCase().includes(lowerQuery) || item.id.toLowerCase().includes(lowerQuery)) {
          results.push(item);
        }
      });
    });

    setSearchResults(results.slice(0, 8));
  };

  const currentPage = navigation.find((item) => item.href === router.pathname)?.name || 'Dashboard';

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Fixed Sidebar - Always Collapsed */}
      <aside className="bg-white border-r border-neutral-200 flex flex-col w-16">
        {/* Search Icon */}
        <div className="p-4 border-b border-neutral-200 flex justify-center">
          <button
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            title="Search"
          >
            <Search className="h-5 w-5 text-neutral-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navigation.filter((item: any) => !item.hidden).map((item) => {
              const isActive = router.pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <a
                    href={item.href}
                    onClick={(e) => handleNavigation(item.href, e)}
                    className={`flex items-center rounded-lg transition-colors cursor-pointer justify-center p-3 ${
                      isActive
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                    title={item.name}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Settings Button - Bottom */}
        <div className="p-4 border-t border-neutral-200">
          <a
            href="/settings"
            onClick={(e) => handleNavigation('/settings', e)}
            className={`flex items-center rounded-lg transition-colors cursor-pointer justify-center p-3 ${
              currentPath === '/settings'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-700 hover:bg-neutral-100'
            }`}
            title="Settings"
          >
            <Settings className="h-5 w-5 flex-shrink-0" />
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden h-full min-h-0">
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
          {/* Custom TitleBar (frameless window) */}
          <div
            className="h-10 flex items-center justify-end px-3 bg-white border-b border-neutral-200"
            style={({ WebkitAppRegion: isElectron ? 'drag' : undefined } as any)}
          >
            <div className="flex items-center gap-1" style={({ WebkitAppRegion: 'no-drag' } as any)}>
              {/* Notification Panel */}
              <NotificationPanel />
              
              {/* Window Controls (Electron only) */}
              {isElectron && (
                <>
                  <button
                    onClick={() => window.phabdash?.windowMinimize?.()}
                    className="p-2 rounded hover:bg-neutral-100 text-neutral-600"
                    title="Minimize"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => window.phabdash?.windowToggleMaximize?.()}
                    className="p-2 rounded hover:bg-neutral-100 text-neutral-600"
                    title="Maximize"
                  >
                    <Square className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => window.phabdash?.windowClose?.()}
                    className="p-2 rounded hover:bg-red-50 text-neutral-600 hover:text-red-600"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Page Content - All pages mounted, show/hide based on route */}
          <main ref={contentAreaRef} className="flex-1 overflow-hidden relative min-h-0">
            {mountedPages.has('/') && (
              <div style={{ display: currentPath === '/' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
                <DashboardPage key={pageReloadKeys['/'] || 0} />
              </div>
            )}
            {mountedPages.has('/tasks') && (
              <div style={{ display: currentPath === '/tasks' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
                <TasksPage key={pageReloadKeys['/tasks'] || 0} />
              </div>
            )}
            {mountedPages.has('/projects') && (
              <div style={{ display: currentPath === '/projects' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
                <ProjectsPage key={pageReloadKeys['/projects'] || 0} />
              </div>
            )}
            {mountedPages.has('/blogs') && (
              <div data-blog-scroll style={{ display: currentPath === '/blogs' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
                <BlogsPage key={pageReloadKeys['/blogs'] || 0} />
              </div>
            )}
            {mountedPages.has('/settings') && (
              <div style={{ display: currentPath === '/settings' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
                <SettingsPage key={pageReloadKeys['/settings'] || 0} />
              </div>
            )}
          </main>
        </div>

        {/* Pinned Panel */}
        <PinnedPanel />
      </div>
    </div>
  );
}
