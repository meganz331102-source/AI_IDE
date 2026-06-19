import { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { DEFAULT_CONTEXT_BUDGET, estimateTokens } from '../../src/shared/constants';
import type { SelectedContextFile } from '../../src/shared/types';

export function registerContextHandlers(ipcMain: IpcMain) {
  // Buduje kontekst tylko z plików explicite wybranych przez użytkownika.
  // Jeśli suma przekracza budżet tokenów, ucina najmniej istotne (ostatnie) pliki
  // i dzieli zbyt duże pliki na fragmenty.
  ipcMain.handle('context:build', async (_event, filePaths: string[]): Promise<SelectedContextFile[]> => {
    const budget = DEFAULT_CONTEXT_BUDGET;
    const available = budget.maxTokens - budget.systemPromptTokens - budget.reserveForResponseTokens;

    const files: SelectedContextFile[] = [];
    let usedTokens = 0;

    for (const filePath of filePaths) {
      if (usedTokens >= available) break;

      const content = await fs.readFile(filePath, 'utf-8').catch(() => '');
      if (!content) continue;

      let tokenEstimate = estimateTokens(content);
      let finalContent = content;

      // Chunking – jeśli pojedynczy plik przekracza pozostały budżet, ucinamy go
      const remaining = available - usedTokens;
      if (tokenEstimate > remaining) {
        const ratio = remaining / tokenEstimate;
        const cutoff = Math.floor(content.length * ratio);
        finalContent = content.slice(0, cutoff) + '\n\n/* ... fragment ucięty przez Context Manager ... */';
        tokenEstimate = estimateTokens(finalContent);
      }

      files.push({ path: filePath, content: finalContent, tokenEstimate });
      usedTokens += tokenEstimate;
    }

    return files;
  });

  // Bardzo prosty ranking trafności: pliki, których nazwa lub zawartość
  // zawiera frazy z zapytania, trafiają wyżej. To placeholder – w wersji
  // produkcyjnej warto użyć embeddingów lub analizy importów (AST).
  ipcMain.handle('context:rank', async (_event, rootPath: string, query: string): Promise<string[]> => {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const candidates: { path: string; score: number }[] = [];

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          const nameScore = keywords.reduce(
            (acc, kw) => acc + (entry.name.toLowerCase().includes(kw) ? 5 : 0),
            0
          );
          if (nameScore > 0) {
            candidates.push({ path: fullPath, score: nameScore });
          }
        }
      }
    }

    await walk(rootPath);
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 10).map((c) => c.path);
  });
}
