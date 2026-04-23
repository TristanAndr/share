// Type declarations for the Electron preload API
// Available as window.electronAPI when running inside Electron

export {};

declare global {
  interface Window {
    electronAPI?: {
      notify: (title: string, body: string, type?: string) => void;
      getLocale: () => Promise<string>;
      isElectron: boolean;
    };
  }
}
