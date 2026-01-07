import { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface PageManagerProps {
  children: ReactNode;
  currentPath: string;
}

interface CachedPage {
  path: string;
  component: ReactNode;
  timestamp: number;
}

export default function PageManager({ children, currentPath }: PageManagerProps) {
  const [cachedPages, setCachedPages] = useState<Map<string, CachedPage>>(new Map());
  const router = useRouter();

  useEffect(() => {
    // Cache the current page
    setCachedPages((prev) => {
      const newCache = new Map(prev);
      newCache.set(currentPath, {
        path: currentPath,
        component: children,
        timestamp: Date.now(),
      });
      return newCache;
    });
  }, [currentPath, children]);

  return (
    <>
      {Array.from(cachedPages.values()).map((page) => (
        <div
          key={page.path}
          style={{
            display: page.path === currentPath ? 'block' : 'none',
            height: '100%',
            width: '100%',
          }}
        >
          {page.component}
        </div>
      ))}
    </>
  );
}
