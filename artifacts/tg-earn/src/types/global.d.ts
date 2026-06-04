declare global {
  interface Window {
    show_10411910?: () => Promise<void>;
    Telegram?: {
      WebApp: {
        ready: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            username?: string;
            first_name?: string;
          };
        };
        themeParams: Record<string, string>;
      };
    };
  }
}

export {};
