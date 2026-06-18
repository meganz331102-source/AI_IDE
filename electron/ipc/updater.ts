// Auto-update przez GitHub Releases (electron-updater).
// Publish config jest w package.json -> build.publish (provider: github).
// Releases muszą być publiczne — repo jest public, więc działa bez tokenu.
import { IpcMain, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

const LS_AUTO_KEY = 'autoCheckOnStartup'; // tylko nazwa – wartość trzyma renderer w localStorage

autoUpdater.autoDownload = false;     // pobieramy dopiero po klik użytkownika
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow: BrowserWindow | null = null;

function emit(event: string, payload?: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(`updater:${event}`, payload);
  }
}

export function setUpdaterWindow(win: BrowserWindow) {
  mainWindow = win;
}

export function registerUpdaterHandlers(ipcMain: IpcMain) {
  autoUpdater.on('checking-for-update', () => emit('checking'));
  autoUpdater.on('update-available', (info) => emit('available', { version: info.version, releaseNotes: info.releaseNotes, releaseDate: info.releaseDate }));
  autoUpdater.on('update-not-available', (info) => emit('not-available', { version: info.version }));
  autoUpdater.on('error', (err) => emit('error', { message: String(err?.message || err) }));
  autoUpdater.on('download-progress', (p) => emit('progress', {
    percent: Math.round(p.percent),
    bytesPerSecond: p.bytesPerSecond,
    transferred: p.transferred,
    total: p.total,
  }));
  autoUpdater.on('update-downloaded', (info) => emit('downloaded', { version: info.version }));

  ipcMain.handle('updater:check', async () => {
    try {
      const r = await autoUpdater.checkForUpdates();
      return { ok: true, version: r?.updateInfo?.version || null };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  });

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  });

  ipcMain.handle('updater:install', async () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('updater:getCurrentVersion', () => {
    return autoUpdater.currentVersion?.version || null;
  });
}

export { LS_AUTO_KEY };
