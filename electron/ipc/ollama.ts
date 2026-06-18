// Integracja z Ollama (lokalny serwer LLM, free, działa offline po pobraniu modelu).
// User w prompcie nazwał to "OpenViking" – obsługujemy Ollamę (https://ollama.com),
// bo "OpenViking" jako produkt nie istnieje (najpewniej przejęzyczenie).
//
// Endpoint: http://127.0.0.1:11434
//   GET  /api/tags        – lista zainstalowanych modeli
//   POST /api/chat        – chat z modelem
//   POST /api/pull (NDJSON stream) – pobierz model (z progressem)
//   DELETE /api/delete    – usuń model

import { IpcMain } from 'electron';
import { fetch as undiciFetch } from 'undici';

const BASE = 'http://127.0.0.1:11434';

interface OllamaTag {
  name: string;
  size: number;
  modified_at: string;
}

export async function ollamaPing(): Promise<boolean> {
  try {
    const res = await undiciFetch(`${BASE}/api/tags`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function ollamaList(): Promise<OllamaTag[]> {
  try {
    const res = await undiciFetch(`${BASE}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data?.models || []).map((m: any) => ({
      name: m.name,
      size: m.size,
      modified_at: m.modified_at,
    }));
  } catch {
    return [];
  }
}

export async function ollamaChat(model: string, messages: { role: string; content: string }[], signal?: AbortSignal): Promise<string> {
  const res = await undiciFetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    if (res.status === 404) {
      const err: any = new Error(`Ollama: model "${model}" nie jest zainstalowany. Pobierz go w Ustawieniach → Modele AI → Ollama.`);
      err.code = 'NO_MODEL';
      err.model = model;
      throw err;
    }
    throw new Error(`Ollama HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  const content = data?.message?.content;
  if (!content) throw new Error('Ollama: pusta odpowiedź');
  return content;
}

const pullAborts = new Map<string, AbortController>();

export function registerOllamaHandlers(ipcMain: IpcMain) {
  ipcMain.handle('ollama:ping', async () => ollamaPing());
  ipcMain.handle('ollama:list', async () => ollamaList());

  ipcMain.handle('ollama:pull', async (e, model: string) => {
    const ctrl = new AbortController();
    pullAborts.set(model, ctrl);
    try {
      const res = await undiciFetch(`${BASE}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model, stream: true }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
      }
      const reader = res.body?.getReader();
      if (!reader) return { ok: false, error: 'brak strumienia' };
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          try {
            const j = JSON.parse(t);
            e.sender.send('ollama:pullProgress', {
              model,
              status: j.status || '',
              completed: j.completed || 0,
              total: j.total || 0,
              percent: j.total ? Math.round((j.completed / j.total) * 100) : null,
            });
          } catch { /* ignore */ }
        }
      }
      return { ok: true };
    } catch (err: any) {
      if (err?.name === 'AbortError') return { ok: false, error: 'anulowano' };
      return { ok: false, error: String(err?.message || err) };
    } finally {
      pullAborts.delete(model);
    }
  });

  ipcMain.handle('ollama:cancelPull', async (_e, model: string) => {
    pullAborts.get(model)?.abort();
    pullAborts.delete(model);
  });

  ipcMain.handle('ollama:delete', async (_e, model: string) => {
    try {
      const res = await undiciFetch(`${BASE}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
      });
      return { ok: res.ok };
    } catch (err: any) {
      return { ok: false, error: String(err?.message || err) };
    }
  });
}
