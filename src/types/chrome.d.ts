interface ChromeRuntime {
    runtime: {
      sendMessage: (
        extensionId: string | undefined,
        message: any,
        callback?: (response: any) => void
      ) => void;
      lastError?: { message?: string };
    };
  }
  
  interface Window {
    chrome: ChromeRuntime;
  }