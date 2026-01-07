export {};

declare global {
  interface Window {
    phabdash?: {
      openBookmark?: (url: string, title?: string) => Promise<void> | void;
      openExternal?: (url: string) => Promise<void> | void;
      updateTrayNotification?: (hasNotification: boolean) => Promise<void> | void;

      windowMinimize?: () => Promise<void>;
      windowToggleMaximize?: () => Promise<void>;
      windowClose?: () => Promise<void>;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        style?: React.CSSProperties;
        partition?: string;
        allowpopups?: any;
        nodeintegration?: any;
        plugins?: any;
        preload?: string;
        httpreferrer?: string;
        useragent?: string;
        disablewebsecurity?: any;
        webpreferences?: string;
      };
    }
  }
}
