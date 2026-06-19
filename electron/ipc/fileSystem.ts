import { IpcMain, dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { ProjectFile } from '../../src/shared/types';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-electron', '.next', 'build']);

async function buildTree(dirPath: string, rootPath: string): Promise<ProjectFile[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result: ProjectFile[] = [];

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;

    const absolutePath = path.join(dirPath, entry.name);
    const relativePath = path.relative(rootPath, absolutePath);

    if (entry.isDirectory()) {
      const children = await buildTree(absolutePath, rootPath);
      result.push({
        path: relativePath,
        absolutePath,
        name: entry.name,
        isDirectory: true,
        children,
      });
    } else {
      const stat = await fs.stat(absolutePath);
      result.push({
        path: relativePath,
        absolutePath,
        name: entry.name,
        isDirectory: false,
        sizeBytes: stat.size,
      });
    }
  }

  // Foldery najpierw, potem alfabetycznie
  return result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function registerFileSystemHandlers(ipcMain: IpcMain) {
  ipcMain.handle('fs:openProjectDialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('fs:readDirectory', async (_event, rootPath: string) => {
    return buildTree(rootPath, rootPath);
  });

  ipcMain.handle('fs:readFileContent', async (_event, absolutePath: string) => {
    return fs.readFile(absolutePath, 'utf-8');
  });

  ipcMain.handle(
    'fs:writeFileContent',
    async (_event, absolutePath: string, content: string) => {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, 'utf-8');
    }
  );

  ipcMain.handle('fs:deleteFile', async (_event, absolutePath: string) => {
    await fs.unlink(absolutePath);
  });
}
