// Dispatcher dla zapytań AI – wszystko przechodzi przez ai-providers.ts.
// Stary playwright-scraping ChatGPT/Gemini/DeepSeek został usunięty bo nigdy
// nie działał niezawodnie (login + bot detection). Zamiast tego mamy darmowe API:
// Pollinations (bez klucza) + Groq (z darmowym kluczem) + Duck.ai (eksperymentalne).

import { IpcMain } from 'electron';
import type { AIModelId, SessionStatus } from '../../src/shared/types';
import {
  dispatchSend, abortProvider, resetProvider,
  setProviderKey, hasProviderKey, clearProviderKey, setGlobalProxy,
} from './ai-providers';
import { closeChatGPTBrowser, isChatGPTBrowserOpen, openChatGPTVisible, isChatGPTBrowserVisible } from './chatgpt-browser';

export function setDuckAiProxy(proxyUrl: string | null) {
  setGlobalProxy(proxyUrl);
}

export function registerBrowserSessionHandlers(ipcMain: IpcMain) {
  ipcMain.handle('ai:startSession', async (_e, modelId: AIModelId): Promise<SessionStatus> => {
    // Pollinations + Duck.ai = brak setup. Groq = wymaga klucza.
    if (modelId === 'groq') {
      const has = await hasProviderKey('groq');
      return { modelId, isLoggedIn: has, isReady: has, lastError: has ? undefined : 'Brak klucza Groq' };
    }
    return { modelId, isLoggedIn: true, isReady: true };
  });

  ipcMain.handle('ai:getSessionStatus', async (_e, modelId: AIModelId): Promise<SessionStatus> => {
    if (modelId === 'groq') {
      const has = await hasProviderKey('groq');
      return { modelId, isLoggedIn: has, isReady: has };
    }
    return { modelId, isLoggedIn: true, isReady: true };
  });

  ipcMain.handle('ai:resetSession', async (_e, modelId: string) => {
    resetProvider(modelId);
    // Dla ChatGPT reset = zamknięcie okna Chromium (świeży incognito przy następnym pytaniu)
    if (modelId === 'chatgpt') await closeChatGPTBrowser();
  });

  ipcMain.handle('ai:closeBrowser', async () => {
    await closeChatGPTBrowser();
  });

  ipcMain.handle('ai:isBrowserOpen', async () => {
    return isChatGPTBrowserOpen();
  });

  ipcMain.handle('ai:openChatGPTVisible', async () => {
    await openChatGPTVisible();
    return isChatGPTBrowserVisible();
  });

  ipcMain.handle('ai:abort', async (_e, modelId: string) => {
    abortProvider(modelId);
  });

  ipcMain.handle('ai:sendMessage', async (_e, modelId: string, prompt: string): Promise<string> => {
    try {
      return await dispatchSend(modelId, prompt);
    } catch (e: any) {
      // Structured error → renderer dostaje typowane info do wyświetlenia w UI
      if (e?.code) {
        const wrapped = new Error(JSON.stringify({
          message: e.message, code: e.code,
          retryAfter: e.retryAfter, signupUrl: e.signupUrl,
          provider: e.provider, suggestion: e.suggestion,
        }));
        (wrapped as any).structured = true;
        throw wrapped;
      }
      throw e;
    }
  });

  // Klucz API providera (Groq itp.) w Keychain
  ipcMain.handle('ai:setKey', async (_e, provider: string, key: string) => {
    await setProviderKey(provider, key);
  });
  ipcMain.handle('ai:hasKey', async (_e, provider: string) => {
    return hasProviderKey(provider);
  });
  ipcMain.handle('ai:clearKey', async (_e, provider: string) => {
    await clearProviderKey(provider);
  });

  // Stara metoda – placeholder żeby UI nie wybuchało
  ipcMain.handle('ai:showLoginWindow', async () => { /* no-op – playwright wycofany */ });
}

export async function closeAllSessions() {
  await closeChatGPTBrowser();
}
