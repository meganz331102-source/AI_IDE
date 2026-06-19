import { IpcMain } from 'electron';
import { startPreviewServer, setPreviewRoot, stopPreviewServer, listAllHtmlFiles, findStartHtml } from '../preview-server';

export function registerPreviewHandlers(ipcMain: IpcMain) {
  ipcMain.handle('preview:start', async (_e, rootPath: string) => {
    setPreviewRoot(rootPath);
    const port = await startPreviewServer();
    const found = await findStartHtml(rootPath); // np. "public/index.html" albo null
    return {
      port,
      url: `http://127.0.0.1:${port}/`,
      indexPath: found, // ścieżka do startowego HTML względem root
    };
  });

  ipcMain.handle('preview:listHtml', async (_e, rootPath: string) => {
    return listAllHtmlFiles(rootPath);
  });

  ipcMain.handle('preview:setRoot', async (_e, rootPath: string) => {
    setPreviewRoot(rootPath);
  });

  ipcMain.handle('preview:stop', async () => {
    stopPreviewServer();
  });
}
