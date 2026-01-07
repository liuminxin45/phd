import { useRouter } from 'next/router';
import { ReactNode, useMemo, useState, useEffect, useRef } from 'react';
import { Home, CheckSquare, Folder, FileText, Search, ChevronLeft, ChevronRight, X, Minus, Square, Pin } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PinnedPanel } from './PinnedPanel';
import { usePinnedPanel } from '@/contexts/PinnedPanelContext';
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

interface AppLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Projects', href: '/projects', icon: Folder },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { user } = useUser();
  const { isPanelExpanded } = usePinnedPanel();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
      {/* Fixed Sidebar */}
      <aside className={`bg-white border-r border-neutral-200 flex flex-col transition-all duration-300 ${
        isSidebarCollapsed ? 'w-16' : 'w-64'
      }`}>
        {/* Search Section */}
        {!isSidebarCollapsed && (
          <div className="p-4 border-b border-neutral-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search tasks, projects..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchQuery && setIsSearching(true)}
                onBlur={() => setTimeout(() => setIsSearching(false), 200)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
              {isSearching && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="px-3 py-2 hover:bg-neutral-50 cursor-pointer border-b border-neutral-100 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-neutral-900">{result.title}</p>
                          <p className="text-xs text-neutral-500">{result.id}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                          {result.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapsed Search Icon */}
        {isSidebarCollapsed && (
          <div className="p-4 border-b border-neutral-200 flex justify-center">
            <button
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              title="Search"
            >
              <Search className="h-5 w-5 text-neutral-600" />
            </button>
          </div>
        )}

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
                    className={`flex items-center rounded-lg transition-colors cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2'
                    } ${
                      isActive
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                    title={isSidebarCollapsed ? item.name : ''}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!isSidebarCollapsed && (
                      <span className="text-sm font-medium">{item.name}</span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Toggle Button */}
        <div className={`border-t border-neutral-200 ${isSidebarCollapsed ? 'p-2' : 'p-4'}`}>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`flex items-center rounded-lg transition-colors text-neutral-700 hover:bg-neutral-100 ${
              isSidebarCollapsed ? 'justify-center p-3 w-full' : 'gap-3 px-3 py-2 w-full'
            }`}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden h-full min-h-0">
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
          {/* Custom TitleBar (frameless window) */}
          <div
            className="h-10 flex items-center justify-between px-3 bg-white border-b border-neutral-200"
            style={({ WebkitAppRegion: isElectron ? 'drag' : undefined } as any)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-neutral-900 truncate">Neo</span>
              <span className="text-xs text-neutral-500 truncate">{currentPage}</span>
            </div>
            {isElectron && (
              <div className="flex items-center gap-1" style={({ WebkitAppRegion: 'no-drag' } as any)}>
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
              </div>
            )}
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
          </main>
        </div>

        {/* Pinned Panel */}
        <PinnedPanel />
      </div>
    </div>
  );
}
