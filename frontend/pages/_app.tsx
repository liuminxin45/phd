import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import AppLayout from '@/components/layout/AppLayout';
import { UserProvider } from '@/contexts/UserContext';
import { PinnedPanelProvider } from '@/contexts/PinnedPanelContext';
import { Toaster } from 'sonner';
import { ToastWrapper } from '@/components/ui/toast-wrapper';
import { useEffect } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

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

    const onDocumentClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
      if (!anchor) return;

      // Skip if anchor is used as a button (role=button, data-radix, etc.)
      if (anchor.getAttribute('role') === 'button') return;
      if (anchor.hasAttribute('data-radix-collection-item')) return;
      if (anchor.closest('[data-radix-popper-content-wrapper]')) return;
      
      // Skip if anchor has no real href or is a hash link
      const href = anchor.getAttribute('href') || '';
      if (!href || href === '#' || href.startsWith('#')) return;
      
      // Only intercept absolute external URLs (http:// or https://)
      if (!/^https?:\/\//i.test(href)) return;

      e.preventDefault();
      e.stopPropagation();
      openExternal(href);
    };

    document.addEventListener('click', onDocumentClickCapture, true);
    return () => {
      document.removeEventListener('click', onDocumentClickCapture, true);
    };
  }, []);

  return (
    <UserProvider>
      <PinnedPanelProvider>
        <AppLayout>
          <Component {...pageProps} />
        </AppLayout>
        <Toaster 
          position="bottom-left"
          duration={4000}
        />
        <ToastWrapper />
      </PinnedPanelProvider>
    </UserProvider>
  );
}
