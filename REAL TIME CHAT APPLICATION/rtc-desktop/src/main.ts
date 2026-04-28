import {
  app, BrowserWindow, Notification, ipcMain, Menu, shell
} from 'electron';
import * as path from 'path';
import * as http from 'http';
import * as fs from 'fs';
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

// Use Electron's bundled Node.js so we don't depend on system node/npm being in PATH.
// This matters especially when the app is launched from a desktop shortcut where PATH
// is minimal and may not include the user's node installation.
function spawnWithElectronNode(
  scriptPath: string,
  args: string[],
  options: import('child_process').SpawnOptions
): ChildProcess {
  return spawn(process.execPath, ['--', scriptPath, ...args], {
    ...options,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...options.env as object },
  });
}

function initDatabase(backendPath: string, dbPath: string): void {
  const templatePath = path.join(backendPath, 'prisma', 'template.db');
  if (fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, dbPath);
    console.log('[Electron] Database initialized from template');
  } else {
    console.error('[Electron] template.db not found at', templatePath);
  }
}

function startBackend(databaseUrl: string): void {
  const backendPath = getResourcePath('rtc-backend');
  const scriptPath = path.join(backendPath, 'dist', 'src', 'index.js');
  console.log('[Electron] Starting backend at:', scriptPath);

  // Prisma binary engine executable — needed because AppImage is read-only and
  // Prisma can't rely on relative paths when run under ELECTRON_RUN_AS_NODE.
  const prismaEngineDir = path.join(backendPath, 'node_modules', '.prisma', 'client');
  const engineFiles = fs.existsSync(prismaEngineDir)
    ? fs.readdirSync(prismaEngineDir).filter(f => f.startsWith('query-engine-') && !f.endsWith('.node'))
    : [];
  const engineEnv: Record<string, string> = engineFiles.length > 0
    ? { PRISMA_QUERY_ENGINE_BINARY: path.join(prismaEngineDir, engineFiles[0]) }
    : {};

  backendProcess = spawnWithElectronNode(scriptPath, [], {
    cwd: backendPath,
    env: { NODE_ENV: 'production', DATABASE_URL: databaseUrl, ...engineEnv },
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
  const nextBin = path.join(frontendPath, 'node_modules', 'next', 'dist', 'bin', 'next');
  console.log('[Electron] Starting frontend at:', frontendPath);

  frontendProcess = spawnWithElectronNode(nextBin, ['start', '-p', String(FRONTEND_PORT)], {
    cwd: frontendPath,
    env: { NODE_ENV: 'production' },
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

  // Prepare a writable database path in userData (AppImage is read-only)
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'prisma');
  const dbPath = path.join(dbDir, 'dev.db');
  const DATABASE_URL = `file:${dbPath}`;
  fs.mkdirSync(dbDir, { recursive: true });

  // Start servers only if not already running (avoids EADDRINUSE when using start-dev.sh)
  const backendAlive = await isPortAlive(BACKEND_PORT);
  if (!backendAlive) {
    const backendPath = getResourcePath('rtc-backend');
    if (!fs.existsSync(dbPath)) {
      initDatabase(backendPath, dbPath);
    }
    startBackend(DATABASE_URL);
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
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    const errTitle = lang === 'fr' ? 'Erreur de démarrage' : 'Startup Error';
    const errMsg = lang === 'fr'
      ? 'Les serveurs n\'ont pas pu démarrer dans les temps impartis.'
      : 'The servers could not start in time.';
    const errHint = lang === 'fr'
      ? 'Consultez les journaux de l\'application pour plus de détails.'
      : 'Check the application logs for details.';
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
              padding: 2rem; text-align: center;
            }
            h1 { font-size: 1.5rem; margin-bottom: 1rem; color: #ed4245; }
            p { color: #b5bac1; font-size: 0.9rem; margin-top: 0.5rem; }
          </style>
        </head>
        <body>
          <h1>⚠ ${errTitle}</h1>
          <p>${errMsg}</p>
          <p>${errHint}</p>
        </body>
      </html>
    `)}`);
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
