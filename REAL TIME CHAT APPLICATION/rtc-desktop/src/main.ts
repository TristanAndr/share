import {
  app, BrowserWindow, Notification, ipcMain, Menu, shell, nativeImage
} from 'electron';
import * as path from 'path';
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';

// ─── Config ──────────────────────────────────────────────────────────────────

const BACKEND_PORT = 3001;
const FRONTEND_PORT = 3000;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const IS_PACKAGED = app.isPackaged;

// ─── i18n (native Electron UI) ───────────────────────────────────────────────

const systemLocale = app.getLocale();
const lang: 'fr' | 'en' = systemLocale.startsWith('fr') ? 'fr' : 'en';

const nativeT = {
  fr: {
    appName: 'Chat en Temps Réel',
    quit: 'Quitter',
    show: 'Afficher',
    hide: 'Masquer',
    edit: 'Édition',
    view: 'Affichage',
    undo: 'Annuler',
    redo: 'Rétablir',
    cut: 'Couper',
    copy: 'Copier',
    paste: 'Coller',
    selectAll: 'Tout sélectionner',
    reload: 'Recharger',
    fullscreen: 'Plein écran',
    zoomIn: 'Zoom avant',
    zoomOut: 'Zoom arrière',
    resetZoom: 'Zoom réel',
    starting: 'Démarrage...',
    newMessage: 'Nouveau message',
    newDM: 'Nouveau message privé',
  },
  en: {
    appName: 'Real Time Chat',
    quit: 'Quit',
    show: 'Show',
    hide: 'Hide',
    edit: 'Edit',
    view: 'View',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    reload: 'Reload',
    fullscreen: 'Toggle Fullscreen',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    resetZoom: 'Actual Size',
    starting: 'Starting...',
    newMessage: 'New message',
    newDM: 'New direct message',
  },
};

const t = nativeT[lang];

// ─── State ────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let frontendProcess: ChildProcess | null = null;
let isQuitting = false;

// ─── Paths ────────────────────────────────────────────────────────────────────

function getResourcePath(...segments: string[]): string {
  if (IS_PACKAGED) {
    return path.join(process.resourcesPath, ...segments);
  }
  // In development: __dirname = dist/, go up one level to rtc-desktop/
  return path.join(__dirname, '..', '..', ...segments);
}

// ─── Server management ────────────────────────────────────────────────────────

function startBackend(): void {
  const backendPath = getResourcePath('rtc-backend');
  console.log('[Electron] Starting backend at:', backendPath);

  backendProcess = spawn('node', ['-e', `
    process.chdir(${JSON.stringify(backendPath)});
    require('dotenv').config({ path: require('path').join(${JSON.stringify(backendPath)}, '.env') });
    require('ts-node/register');
    require('./src/index.ts');
  `], {
    cwd: backendPath,
    shell: process.platform === 'win32',
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout?.on('data', (d) => console.log('[Backend]', d.toString().trim()));
  backendProcess.stderr?.on('data', (d) => console.error('[Backend]', d.toString().trim()));
  backendProcess.on('exit', (code) => {
    if (!isQuitting) console.error('[Backend] exited with code', code);
  });
}

function startFrontend(): void {
  const frontendPath = getResourcePath('rtc-frontend');
  console.log('[Electron] Starting frontend at:', frontendPath);

  frontendProcess = spawn('npm', ['run', IS_PACKAGED ? 'start' : 'dev'], {
    cwd: frontendPath,
    shell: true,
    env: { ...process.env, NODE_ENV: IS_PACKAGED ? 'production' : 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  frontendProcess.stdout?.on('data', (d) => console.log('[Frontend]', d.toString().trim()));
  frontendProcess.stderr?.on('data', (d) => console.error('[Frontend]', d.toString().trim()));
  frontendProcess.on('exit', (code) => {
    if (!isQuitting) console.error('[Frontend] exited with code', code);
  });
}

function isPortAlive(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, () => {
      req.destroy();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => { req.destroy(); resolve(false); });
  });
}

function waitForServer(url: string, maxAttempts = 40, intervalMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;
    let resolved = false;

    function tryConnect() {
      if (resolved) return;
      attempts++;
      const req = http.get(url, () => {
        req.destroy();
        if (!resolved) {
          resolved = true;
          console.log(`[Electron] Server ready at ${url}`);
          resolve(true);
        }
      });

      req.on('error', () => {
        if (resolved) return;
        if (attempts >= maxAttempts) {
          resolved = true;
          console.error(`[Electron] Server at ${url} not ready after ${maxAttempts} attempts`);
          resolve(false);
        } else {
          setTimeout(tryConnect, intervalMs);
        }
      });

      req.setTimeout(1500, () => {
        req.destroy();
        if (resolved) return;
        if (attempts >= maxAttempts) {
          resolved = true;
          resolve(false);
        } else {
          setTimeout(tryConnect, intervalMs);
        }
      });
    }

    tryConnect();
  });
}

// ─── Window ───────────────────────────────────────────────────────────────────

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 860,
    minHeight: 600,
    title: t.appName,
    show: false,
    backgroundColor: '#1e1f22',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // Show a loading page while servers start
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            height: 100vh;
            background: #1e1f22;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          h1 { font-size: 2rem; margin-bottom: 1rem; }
          p { color: #b5bac1; font-size: 0.95rem; }
          .spinner {
            width: 40px; height: 40px;
            border: 4px solid #5865f2;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 1.5rem;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="spinner"></div>
        <h1>${t.appName}</h1>
        <p>${t.starting}</p>
      </body>
    </html>
  `)}`);

  mainWindow.show();

  // Start servers only if not already running (avoids EADDRINUSE when using start-dev.sh)
  const backendAlive = await isPortAlive(BACKEND_PORT);
  if (!backendAlive) {
    startBackend();
  } else {
    console.log(`[Electron] Backend already running on port ${BACKEND_PORT}, skipping spawn`);
  }

  const frontendAlive = await isPortAlive(FRONTEND_PORT);
  if (!frontendAlive) {
    startFrontend();
  } else {
    console.log(`[Electron] Frontend already running on port ${FRONTEND_PORT}, skipping spawn`);
  }

  // Wait for frontend to be ready (backend starts faster)
  const ready = await waitForServer(FRONTEND_URL);

  if (ready && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(FRONTEND_URL);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  createMenu();
}

// ─── Application menu ─────────────────────────────────────────────────────────

function createMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: t.appName,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { label: t.quit, role: 'quit' as const },
      ],
    }] : []),
    {
      label: t.edit,
      submenu: [
        { label: t.undo, role: 'undo' },
        { label: t.redo, role: 'redo' },
        { type: 'separator' },
        { label: t.cut, role: 'cut' },
        { label: t.copy, role: 'copy' },
        { label: t.paste, role: 'paste' },
        { label: t.selectAll, role: 'selectAll' },
      ],
    },
    {
      label: t.view,
      submenu: [
        { label: t.reload, role: 'reload' },
        { type: 'separator' },
        { label: t.resetZoom, role: 'resetZoom' },
        { label: t.zoomIn, role: 'zoomIn' },
        { label: t.zoomOut, role: 'zoomOut' },
        { type: 'separator' },
        { label: t.fullscreen, role: 'togglefullscreen' },
      ],
    },
    ...(!isMac ? [{
      label: t.appName,
      submenu: [
        { label: t.quit, role: 'quit' as const },
      ],
    }] : []),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

// System notifications from the renderer
ipcMain.on('notify', (_event, payload: { title: string; body: string; type?: string }) => {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: payload.title,
    body: payload.body,
    urgency: 'normal',
  });

  notification.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  notification.show();
});

// Return system locale to renderer
ipcMain.handle('get-locale', () => lang);

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  backendProcess?.kill('SIGTERM');
  frontendProcess?.kill('SIGTERM');
});
