import { useEffect, useRef, useState } from 'react';
import { X, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Pin } from 'lucide-react';
import { usePinnedPanel, PinnedItem } from '@/contexts/PinnedPanelContext';

const WEBVIEW_HEIGHT = 450;
const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

export function PinnedPanel() {
  const { pinnedItems, isPanelExpanded, togglePanel, removePinnedItem } = usePinnedPanel();
  const webviewRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [isElectron, setIsElectron] = useState(false);
  const [phabricatorUrl, setPhabricatorUrl] = useState('');
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());

  const openExternal = (url: string) => {
    try {
      if (window.phabdash?.openExternal) {
        void window.phabdash.openExternal(url);
        return;
      }
      if ((window as any).require) {
        const { shell } = (window as any).require('electron');
        void shell.openExternal(url);
        return;
      }
      window.open(url, '_blank');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && navigator.userAgent.includes('Electron'));
  }, []);

  // Fetch Phabricator URL from config API
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.phabricatorUrl) {
          setPhabricatorUrl(data.phabricatorUrl);
        }
      })
      .catch(() => {
        // ignore
      });
  }, []);

  // Setup webview event listeners
  useEffect(() => {
    if (!isElectron) return;
    
    pinnedItems.forEach(item => {
      const el = webviewRefs.current.get(item.id);
      if (el) {
        const webviewAny = el as any;
        if (!webviewAny.__PINNED_WEBVIEW_SETUP__) {
          webviewAny.__PINNED_WEBVIEW_SETUP__ = true;

          const handleNewWindow = (event: any) => {
            try {
              const targetUrl = event?.url;
              if (typeof targetUrl !== 'string' || !targetUrl.trim()) return;
              
              // Get current webview URL to check domain
              const currentSrc = (webviewAny.getURL && typeof webviewAny.getURL === 'function') ? webviewAny.getURL() : webviewAny.src;
              const currentUrl = new URL(currentSrc);
              const newUrl = new URL(targetUrl);
              
              // Same domain - navigate within webview
              if (currentUrl.hostname === newUrl.hostname) {
                if (typeof event.preventDefault === 'function') {
                  event.preventDefault();
                }
                webviewAny.loadURL(targetUrl);
                return;
              }
              
              // External domain - open in system browser
              if (typeof event.preventDefault === 'function') {
                event.preventDefault();
              }
              openExternal(targetUrl);
            } catch {
              // ignore parsing errors
            }
          };

          const handleWillNavigate = (event: any) => {
            // Allow natural navigation within webview - don't intercept
            // Only the new-window event needs special handling
          };

          webviewAny.addEventListener?.('new-window', handleNewWindow);
          webviewAny.addEventListener?.('will-navigate', handleWillNavigate);
        }

        const handleDomReady = () => {
          try {
            (el as any).setZoomFactor(0.7);
          } catch {
            // ignore
          }
        };
        (el as any).addEventListener?.('dom-ready', handleDomReady);
      }
    });
  }, [pinnedItems, isElectron]);

  const getItemUrl = (item: PinnedItem): string => {
    if (item.url) return item.url;
    if (item.type === 'task' && item.taskId && phabricatorUrl) {
      return `${phabricatorUrl}/T${item.taskId}`;
    }
    if (item.type === 'project' && item.projectId && phabricatorUrl) {
      return `${phabricatorUrl}/project/view/${item.projectId}/`;
    }
    return '';
  };

  const toggleItemCollapse = (itemId: string) => {
    setCollapsedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'task': return 'bg-blue-500';
      case 'project': return 'bg-purple-500';
      case 'bookmark': return 'bg-amber-500';
      default: return 'bg-neutral-500';
    }
  };

  // Always render the panel structure, just with 0 width when collapsed
  // Webviews are always mounted to prevent refresh
  return (
    <div className="relative flex">
      {/* Toggle Button */}
      {pinnedItems.length > 0 && (
        <button
          onClick={togglePanel}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full z-10 bg-white border border-r-0 border-neutral-200 rounded-l-lg p-2 shadow-md hover:bg-neutral-50 transition-all"
          title={isPanelExpanded ? 'Collapse pinned panel' : 'Expand pinned panel'}
        >
          {isPanelExpanded ? (
            <ChevronRight className="h-4 w-4 text-neutral-600" />
          ) : (
            <div className="flex items-center gap-1">
              <Pin className="h-4 w-4 text-neutral-600" />
              <span className="text-xs font-medium text-neutral-600">{pinnedItems.length}</span>
              <ChevronLeft className="h-4 w-4 text-neutral-600" />
            </div>
          )}
        </button>
      )}

      {/* Panel - always render content, just hide with width */}
      <aside
        className={`bg-neutral-100 border-l border-neutral-200 flex flex-col transition-all duration-300 ${
          isPanelExpanded ? 'w-80' : 'w-0 overflow-hidden'
        }`}
      >
        {/* Header */}
        <div className="h-10 flex items-center justify-between px-3 border-b border-neutral-200 flex-shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-neutral-600" />
            <span className="text-sm font-semibold text-neutral-900">Pinned</span>
            <span className="text-xs text-neutral-500">({pinnedItems.length})</span>
          </div>
        </div>

        {/* Pinned Items - always render to prevent refresh */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {pinnedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400 p-4">
              <Pin className="h-8 w-8 mb-2" />
              <p className="text-sm text-center">No pinned items</p>
              <p className="text-xs text-center mt-1">Pin tasks or projects to keep them here</p>
            </div>
          ) : (
            pinnedItems.map((item) => {
              const url = getItemUrl(item);
              const isCollapsed = collapsedItems.has(item.id);
              return (
                <div 
                  key={item.id} 
                  className="rounded-lg overflow-hidden border-2 border-neutral-300 shadow-sm bg-white"
                >
                  {/* Item Header - clickable to collapse/expand */}
                  <div 
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer select-none transition-colors ${getTypeColor(item.type)} hover:opacity-90`}
                    onClick={() => toggleItemCollapse(item.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-white flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-white flex-shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-white uppercase">
                        {item.type}
                      </span>
                      <span className="text-xs text-white/90 truncate" title={item.title}>
                        {item.title}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePinnedItem(item.id);
                      }}
                      className="p-1 hover:bg-white/20 rounded transition-colors flex-shrink-0"
                      title="Unpin"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>

                  {/* Webview/Iframe - always render, hide with CSS */}
                  {url && (
                    <div 
                      style={{ height: isCollapsed ? 0 : WEBVIEW_HEIGHT }} 
                      className="bg-white overflow-hidden transition-all duration-200"
                    >
                      <div className="w-full h-full overflow-x-auto overflow-y-hidden">
                        {isElectron ? (
                          <webview
                            ref={(el) => {
                              if (el) webviewRefs.current.set(item.id, el);
                            }}
                            src={url}
                            useragent={MOBILE_USER_AGENT}
                            partition="persist:pinned"
                            className="border-0"
                            style={{ width: '100%', height: WEBVIEW_HEIGHT, minWidth: '100%' }}
                          />
                        ) : (
                          <iframe
                            src={url}
                            title={item.title}
                            className="border-0"
                            style={{ width: '100%', height: WEBVIEW_HEIGHT, minWidth: '100%' }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
