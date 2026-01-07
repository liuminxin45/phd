import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export interface PinnedItem {
  id: string;
  type: 'task' | 'project' | 'bookmark' | 'url';
  title: string;
  url?: string;
  taskId?: number;
  projectId?: number;
  bookmarkId?: string;
}

interface PinnedPanelContextType {
  pinnedItems: PinnedItem[];
  isPanelExpanded: boolean;
  addPinnedItem: (item: PinnedItem) => void;
  removePinnedItem: (id: string) => void;
  togglePanel: () => void;
  setIsPanelExpanded: (expanded: boolean) => void;
  isPinned: (id: string) => boolean;
}

const PinnedPanelContext = createContext<PinnedPanelContextType | null>(null);

const STORAGE_KEY = 'neo-pinned-items';
const PANEL_STATE_KEY = 'neo-pinned-panel-expanded';

export function PinnedPanelProvider({ children }: { children: ReactNode }) {
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPinnedItems(JSON.parse(stored));
      }
      const panelState = localStorage.getItem(PANEL_STATE_KEY);
      if (panelState) {
        setIsPanelExpanded(JSON.parse(panelState));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save to localStorage when items change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedItems));
    } catch {
      // ignore
    }
  }, [pinnedItems]);

  // Save panel state
  useEffect(() => {
    try {
      localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(isPanelExpanded));
    } catch {
      // ignore
    }
  }, [isPanelExpanded]);

  const addPinnedItem = useCallback((item: PinnedItem) => {
    setPinnedItems(prev => {
      // Check if already pinned
      if (prev.some(p => p.id === item.id)) {
        return prev;
      }
      return [...prev, item];
    });
    // Auto-expand panel when adding
    setIsPanelExpanded(true);
  }, []);

  const removePinnedItem = useCallback((id: string) => {
    setPinnedItems(prev => {
      const newItems = prev.filter(p => p.id !== id);
      // Auto-close panel when no items remain
      if (newItems.length === 0) {
        setIsPanelExpanded(false);
      }
      return newItems;
    });
  }, []);

  const togglePanel = useCallback(() => {
    setIsPanelExpanded(prev => !prev);
  }, []);

  const isPinned = useCallback((id: string) => {
    return pinnedItems.some(p => p.id === id);
  }, [pinnedItems]);

  return (
    <PinnedPanelContext.Provider
      value={{
        pinnedItems,
        isPanelExpanded,
        addPinnedItem,
        removePinnedItem,
        togglePanel,
        setIsPanelExpanded,
        isPinned,
      }}
    >
      {children}
    </PinnedPanelContext.Provider>
  );
}

export function usePinnedPanel() {
  const context = useContext(PinnedPanelContext);
  if (!context) {
    throw new Error('usePinnedPanel must be used within a PinnedPanelProvider');
  }
  return context;
}
