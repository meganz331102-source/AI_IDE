import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import path from 'path';
import { registerFileSystemHandlers } from './ipc/fileSystem';
import { registerGitHandlers } from './ipc/git';
import { registerBrowserSessionHandlers, closeAllSessions } from './ipc/browser';
import { registerContextHandlers } from './ipc/context';
import { registerKeychainHandlers } from './ipc/keychain';
import { registerPreviewHandlers } from './ipc/preview';
import { registerSearchHandlers } from './ipc/search';
import { registerPrivacyHandlers } from './ipc/privacy';
import { registerDevServerHandlers, stop as stopDevServer } from './ipc/dev-server';
import { registerTerminalHandlers, killAllTerminals } from './ipc/terminal';
import { registerUpdaterHandlers, setUpdaterWindow } from './ipc/updater';
import { registerOllamaHandlers } from './ipc/ollama';
import { stopPreviewServer } from './preview-server';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    titleBarStyle: 'hiddenInset', // natywny look macOS
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Usuń nagłówki blokujące ładowanie zewnętrznych URL w iframe
  // (Next.js, Vite itp. wysyłają X-Frame-Options: SAMEORIGIN)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers['x-frame-options'];
    delete headers['X-Frame-Options'];
    delete headers['content-security-policy'];
    delete headers['Content-Security-Policy'];
    callback({ responseHeaders: headers });
  });
  // Rejestracja wszystkich kanałów IPC przed utworzeniem okna
  registerFileSystemHandlers(ipcMain);
  registerGitHandlers(ipcMain);
  registerBrowserSessionHandlers(ipcMain);
  registerContextHandlers(ipcMain);
  registerKeychainHandlers(ipcMain);
  registerPreviewHandlers(ipcMain);
  registerSearchHandlers(ipcMain);
  registerPrivacyHandlers(ipcMain);
  registerDevServerHandlers(ipcMain);
  registerTerminalHandlers(ipcMain);
  registerUpdaterHandlers(ipcMain);
  registerOllamaHandlers(ipcMain);

  // Otwieranie URL w zewnętrznej przeglądarce (np. logowanie GitHub)
  ipcMain.handle('shell:openExternal', async (_e, url: string) => {
    await shell.openExternal(url);
  });

  createMainWindow();
  if (mainWindow) setUpdaterWindow(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', async () => {
  await closeAllSessions();
  await stopDevServer();
  killAllTerminals();
  stopPreviewServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  await closeAllSessions();
});
