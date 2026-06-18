// Wielokrotny dispatcher dla różnych providerów AI.
// Wszyscy są darmowi:
//   • Pollinations – ZERO setupu, OpenAI-kompatybilne API, default
//   • Duck.ai – darmowe, ale obecnie API zmienione (challenge JS)
//   • Groq – wymaga darmowego klucza z console.groq.com, BARDZO SZYBKIE (Llama 3.3 70B)

import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { getGitHubToken } from './keychain';
import * as keytar from 'keytar';
import { sendChatGPT } from './chatgpt-browser';

const KEYCHAIN_SERVICE = 'ai-ide-api-keys';

let proxyAgent: ProxyAgent | null = null;

export function setGlobalProxy(proxyUrl: string | null) {
  if (proxyUrl && proxyUrl.trim()) {
    try { proxyAgent = new ProxyAgent(proxyUrl.trim()); }
    catch { proxyAgent = null; }
  } else proxyAgent = null;
}

function pfetch(url: string, init?: any): Promise<any> {
  const opts = { ...(init || {}) };
  if (proxyAgent) opts.dispatcher = proxyAgent;
  return undiciFetch(url, opts);
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127.0.0.0 Safari/537.36';

export type Role = 'user' | 'assistant' | 'system';
export interface Message { role: Role; content: string; }

// =============== POLLINATIONS ===============
// https://pollinations.ai/ – zero-key endpoint OpenAI-kompatybilny
async function sendPollinations(model: string, messages: Message[], signal?: AbortSignal): Promise<string> {
  // Modele: openai (gpt-4.1-mini), mistral, qwen, llama, deepseek
  const modelMap: Record<string, string> = {
    'pollinations': 'openai',
    'pollinations-mistral': 'mistral',
    'pollinations-llama': 'llama',
    'pollinations-deepseek': 'deepseek',
  };
  const pollModel = modelMap[model] || 'openai';

  const res = await pfetch('https://text.pollinations.ai/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ model: pollModel, messages, stream: false }),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Pollinations HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Pollinations: pusta odpowiedź');
  return content;
}

// =============== GROQ ===============
async function getGroqKey(): Promise<string | null> {
  return keytar.getPassword(KEYCHAIN_SERVICE, 'groq');
}
async function sendGroq(messages: Message[], signal?: AbortSignal): Promise<string> {
  const key = await getGroqKey();
  if (!key) {
    const err: any = new Error('Brak klucza Groq. Wygeneruj darmowy klucz na console.groq.com i wklej w Ustawieniach.');
    err.code = 'NO_KEY';
    err.provider = 'groq';
    err.signupUrl = 'https://console.groq.com/keys';
    throw err;
  }
  const res = await pfetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
    }),
    signal,
  });
  if (res.status === 401) {
    const err: any = new Error('Groq: nieprawidłowy klucz API. Sprawdź czy nie wygasł.');
    err.code = 'BAD_KEY';
    throw err;
  }
  if (res.status === 429) {
    const err: any = new Error('Groq: limit zapytań. Spróbuj za chwilę.');
    err.code = 'RATE_LIMIT';
    err.retryAfter = parseInt(res.headers.get('retry-after') || '60', 10);
    throw err;
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Groq HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq: pusta odpowiedź');
  return content;
}

// =============== DUCK.AI (próba) ===============
// Duck.ai zmienił API – teraz wymaga x-vqd-hash-1, którego nie da się obliczyć
// bez interpretowania ich JS. Jeśli mimo to zwrócą stary x-vqd-4 – używamy.
async function sendDuckAi(_model: string, messages: Message[], signal?: AbortSignal): Promise<string> {
  const STATUS_URL = 'https://duckduckgo.com/duckchat/v1/status';
  const CHAT_URL = 'https://duckduckgo.com/duckchat/v1/chat';

  const statusRes = await pfetch(STATUS_URL, {
    headers: {
      'x-vqd-accept': '1', 'User-Agent': UA,
      'Accept': '*/*', 'Referer': 'https://duckduckgo.com/',
    },
    signal,
  });

  const vqd = statusRes.headers.get('x-vqd-4');
  const vqdHash = statusRes.headers.get('x-vqd-hash-1');

  if (!vqd) {
    const err: any = new Error(
      'Duck.ai zmienił API i wymaga JS-owego challenge\'a anty-bot. Użyj Pollinations lub Groq (są darmowe i nie mają tego problemu).'
    );
    err.code = 'API_CHANGED';
    err.suggestion = 'pollinations';
    throw err;
  }

  const res = await pfetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vqd-4': vqd,
      ...(vqdHash ? { 'x-vqd-hash-1': vqdHash } : {}),
      'User-Agent': UA, 'Accept': 'text/event-stream',
      'Referer': 'https://duckduckgo.com/',
    },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages }),
    signal,
  });

  if (!res.ok) throw new Error(`Duck.ai HTTP ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Duck.ai: brak strumienia');
  const dec = new TextDecoder();
  let buf = '', full = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const d = t.slice(5).trim();
      if (d === '[DONE]') continue;
      try { const j = JSON.parse(d); if (typeof j.message === 'string') full += j.message; }
      catch {}
    }
  }
  if (!full) throw new Error('Duck.ai: pusta odpowiedź');
  return full;
}

// =============== ROUTER ===============
const histories = new Map<string, Message[]>();
const abortControllers = new Map<string, AbortController>();

export function abortProvider(modelId: string) {
  abortControllers.get(modelId)?.abort();
  abortControllers.delete(modelId);
}

export function resetProvider(modelId: string) {
  histories.delete(modelId);
}

export async function dispatchSend(modelId: string, prompt: string): Promise<string> {
  const ctrl = new AbortController();
  abortControllers.set(modelId, ctrl);

  const history = histories.get(modelId) || [];
  history.push({ role: 'user', content: prompt });

  try {
    let response: string;
    if (modelId.startsWith('pollinations')) {
      response = await sendPollinations(modelId, history, ctrl.signal);
    } else if (modelId === 'groq') {
      response = await sendGroq(history, ctrl.signal);
    } else if (modelId === 'chatgpt') {
      response = await sendChatGPT(history, ctrl.signal);
    } else if (modelId === 'duckai') {
      response = await sendDuckAi(modelId, history, ctrl.signal);
    } else {
      throw new Error(`Nieznany provider: ${modelId}`);
    }
    history.push({ role: 'assistant', content: response });
    histories.set(modelId, history);
    return response;
  } catch (e) {
    history.pop(); // wycofaj user message przy błędzie
    throw e;
  } finally {
    abortControllers.delete(modelId);
  }
}

// =============== KEY MANAGEMENT ===============
export async function setProviderKey(provider: string, key: string) {
  await keytar.setPassword(KEYCHAIN_SERVICE, provider, key);
}
export async function hasProviderKey(provider: string): Promise<boolean> {
  const k = await keytar.getPassword(KEYCHAIN_SERVICE, provider);
  return !!k;
}
export async function clearProviderKey(provider: string) {
  await keytar.deletePassword(KEYCHAIN_SERVICE, provider);
}
