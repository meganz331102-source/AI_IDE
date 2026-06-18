import { IpcMain } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'dist-electron', 'release', '.next',
  '.cache', 'build', 'out', '.DS_Store',
]);
const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.mov', '.zip',
  '.tar', '.gz', '.pdf', '.dmg', '.exe', '.lock',
]);
const MAX_FILE_SIZE = 500_000;
const MAX_RESULTS = 200;

export interface SearchHit {
  filePath: string;
  relativePath: string;
  lineNum: number;
  line: string;
}

export function registerSearchHandlers(ipcMain: IpcMain) {
  ipcMain.handle('search:inFiles', async (_e, rootPath: string, query: string): Promise<SearchHit[]> => {
    if (!query || !rootPath) return [];
    const lq = query.toLowerCase();
    const hits: SearchHit[] = [];

    async function walk(dir: string) {
      if (hits.length >= MAX_RESULTS) return;
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); }
      catch { return; }
      for (const e of entries) {
        if (hits.length >= MAX_RESULTS) return;
        if (SKIP_DIRS.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { await walk(full); continue; }
        const ext = path.extname(e.name).toLowerCase();
        if (SKIP_EXT.has(ext)) continue;
        try {
          const stat = await fs.stat(full);
          if (stat.size > MAX_FILE_SIZE) continue;
          const content = await fs.readFile(full, 'utf8');
          if (!content.toLowerCase().includes(lq)) continue;
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(lq)) {
              hits.push({
                filePath: full,
                relativePath: path.relative(rootPath, full),
                lineNum: i + 1,
                line: lines[i].slice(0, 200),
              });
              if (hits.length >= MAX_RESULTS) return;
            }
          }
        } catch { /* skip unreadable */ }
      }
    }
    await walk(rootPath);
    return hits;
  });
}
