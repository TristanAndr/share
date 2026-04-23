import { contextBridge, ipcRenderer } from 'electron';

// Expose a safe API to the renderer (Next.js frontend)
// Access via window.electronAPI in the browser context
contextBridge.exposeInMainWorld('electronAPI', {
  /** Send a system notification */
  notify: (title: string, body: string, type?: string): void => {
    ipcRenderer.send('notify', { title, body, type });
  },

  /** Get the system locale ('fr' or 'en') */
  getLocale: (): Promise<string> => {
    return ipcRenderer.invoke('get-locale');
  },

  /** Flag to detect Electron in the renderer */
  isElectron: true,
});
