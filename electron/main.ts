import { app, BrowserWindow, ipcMain, shell } from 'electron';
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

  // Otwieranie URL w zewnętrznej przeglądarce (np. logowanie GitHub)
  ipcMain.handle('shell:openExternal', async (_e, url: string) => {
    await shell.openExternal(url);
  });

  createMainWindow();

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
