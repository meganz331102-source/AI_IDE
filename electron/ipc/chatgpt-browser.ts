// ChatGPT przez Playwright. STRATEGIA:
//   1. Pierwsza próba: headless: true (Chromium nowy headless mode – trudniej wykryć)
//   2. Auto-klikanie odrzucenia cookies + "Stay logged out"
//   3. Detekcja Cloudflare challenge (page.title() / treść strony / brak inputu po 25s)
//   4. Gdy challenge → close + relaunch headless: false + zwróć CHALLENGE_NEEDS_VISIBLE
//   5. Renderer pokazuje banner "Rozwiąż w widocznym oknie i kliknij Spróbuj ponownie"
//   6. Po sukcesie w widocznym oknie – zostaje widoczne dla tej sesji (cookies trzymają challenge)

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { Message } from './ai-providers';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let initializing: Promise<Page> | null = null;
let currentHeadless = true; // Stan – czy aktualne okno jest headless

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

const DISMISS_TEXTS = [
  'Reject all', 'Reject Non-Essential', 'Reject non-essential', 'Decline',
  'Odrzuć wszystkie', 'Odrzuć', 'Tylko niezbędne',
  'Not now', 'No thanks', 'Maybe later', 'Dismiss', 'Close',
  'Zamknij', 'Nie teraz', 'Później', 'Got it', 'OK', 'Continue', 'Dalej',
];
const STAY_LOGGED_OUT = [
  'Stay logged out', 'Zostań wylogowany', 'Pozostań wylogowany',
  'Continue without account', 'Kontynuuj bez konta',
];

async function dismissBanners(p: Page) {
  for (let pass = 0; pass < 3; pass++) {
    let didSomething = false;
    for (const txt of STAY_LOGGED_OUT) {
      const el = p.locator(`a:has-text("${txt}"), button:has-text("${txt}")`).first();
      if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
        await el.click({ timeout: 2000 }).catch(() => {});
        await p.waitForTimeout(600);
        didSomething = true;
        break;
      }
    }
    for (const txt of DISMISS_TEXTS) {
      const btn = p.locator(`button:has-text("${txt}")`).first();
      if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 2000 }).catch(() => {});
        await p.waitForTimeout(400);
        didSomething = true;
      }
    }
    if (!didSomething) break;
  }
}

async function isInputReady(p: Page): Promise<boolean> {
  return p.evaluate(() => {
    const sels = ['#prompt-textarea', 'div[contenteditable="true"][data-id]', 'textarea'];
    for (const s of sels) {
      const el = document.querySelector(s) as HTMLElement | null;
      if (el && el.offsetParent !== null) return true;
    }
    return false;
  }).catch(() => false);
}

// Sygnatury Cloudflare / "Verify you are human" / inny challenge
async function detectChallenge(p: Page): Promise<boolean> {
  try {
    const title = await p.title().catch(() => '');
    if (/just a moment|attention required|checking your browser/i.test(title)) return true;
    const url = p.url();
    if (/\/challenge-platform|\/cdn-cgi\/challenge/.test(url)) return true;
    const bodyText = await p.evaluate(() => document.body?.innerText?.slice(0, 2000) || '').catch(() => '');
    if (/verify you are human|verify you're human|verify that you are human|are you a robot/i.test(bodyText)) return true;
    if (/checking if the site connection is secure/i.test(bodyText)) return true;
    return false;
  } catch { return false; }
}

async function closeAll() {
  try { await page?.close(); } catch {}
  try { await context?.close(); } catch {}
  try { await browser?.close(); } catch {}
  page = null;
  context = null;
  browser = null;
}

async function launchWithMode(headless: boolean): Promise<Page> {
  browser = await chromium.launch({
    headless,
    args: [
      '--incognito',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });
  context = await browser.newContext({
    viewport: { width: 1100, height: 760 },
    userAgent: UA,
    locale: 'en-US',
  });
  const p = await context.newPage();
  await p.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // Pętla dismissal-bannerów + sprawdzania inputu (do 25s)
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    await dismissBanners(p);
    if (await isInputReady(p)) break;
    await p.waitForTimeout(700);
  }

  page = p;
  currentHeadless = headless;
  return p;
}

async function ensurePage(forceVisible = false): Promise<Page> {
  // Reuse jeśli okno żyje i tryb pasuje
  if (page && !page.isClosed() && browser && browser.isConnected()) {
    if (!forceVisible || !currentHeadless) return page;
    // Wymuszono widoczne – a aktualne headless: zamknij i otwórz na nowo
    await closeAll();
  }
  if (initializing) return initializing;

  initializing = (async () => {
    const headless = !forceVisible;
    const p = await launchWithMode(headless);

    if (!(await isInputReady(p))) {
      const challenged = await detectChallenge(p);
      if (challenged && headless) {
        // Wykryto Cloudflare w headless – zamknij i rzuć błąd, by UI poprosił o widoczne okno
        await closeAll();
        const err: any = new Error(
          'ChatGPT wymaga rozwiązania challenge anty-botowego. Kliknij "Pokaż okno" by otworzyć Chromium widocznie.'
        );
        err.code = 'CHALLENGE_NEEDS_VISIBLE';
        err.provider = 'chatgpt';
        throw err;
      }
      if (challenged) {
        // W widocznym oknie – user musi rozwiązać challenge ręcznie
        const err: any = new Error(
          'Rozwiąż challenge Cloudflare w widocznym oknie Chromium i wyślij wiadomość ponownie.'
        );
        err.code = 'CHALLENGE_VISIBLE';
        err.provider = 'chatgpt';
        throw err;
      }
      // Brak inputu, brak wykrytego challenge – ChatGPT po prostu się nie załadował
      await closeAll();
      throw new Error('ChatGPT: strona się nie załadowała. Sprawdź połączenie.');
    }

    return p;
  })();

  try { return await initializing; }
  finally { initializing = null; }
}

const ASSISTANT_SELECTORS = [
  '[data-message-author-role="assistant"]',
  'div[data-testid^="conversation-turn-"][data-message-author-role="assistant"]',
];

async function countAssistantMessages(p: Page): Promise<number> {
  for (const sel of ASSISTANT_SELECTORS) {
    const n = await p.locator(sel).count().catch(() => 0);
    if (n > 0) return n;
  }
  return 0;
}

async function readLastAssistantText(p: Page): Promise<string> {
  for (const sel of ASSISTANT_SELECTORS) {
    const texts = await p.locator(sel).allTextContents().catch(() => [] as string[]);
    if (texts.length > 0) return texts[texts.length - 1] ?? '';
  }
  return '';
}

export async function sendChatGPT(messages: Message[], signal?: AbortSignal): Promise<string> {
  // Default headless. Jeśli wcześniej padło CHALLENGE_NEEDS_VISIBLE, renderer zawoła
  // ai:openChatGPTVisible co ustawi currentHeadless=false, więc tutaj reuse OK.
  const p = await ensurePage(false);

  await dismissBanners(p);
  if (!(await isInputReady(p))) {
    throw new Error('ChatGPT: pole wpisu nieaktywne. Otwórz widoczne okno i rozwiąż challenge.');
  }

  const userMsg = [...messages].reverse().find((m) => m.role === 'user')?.content;
  if (!userMsg) throw new Error('ChatGPT: brak wiadomości użytkownika');

  const beforeCount = await countAssistantMessages(p);
  const input = p.locator('#prompt-textarea, div[contenteditable="true"][data-id], textarea').first();
  await input.waitFor({ state: 'visible', timeout: 30_000 });
  await input.fill(userMsg, { timeout: 15_000 });

  const sendBtn = p.locator('button[data-testid="send-button"], button[aria-label*="Send"]').first();
  if (await sendBtn.count() > 0 && await sendBtn.isVisible().catch(() => false)) {
    await sendBtn.click({ timeout: 5_000 }).catch(() => p.keyboard.press('Enter'));
  } else {
    await p.keyboard.press('Enter');
  }

  const total = Date.now() + 180_000;
  let lastText = '';
  let stable = 0;
  while (Date.now() < total) {
    if (signal?.aborted) throw new Error('Anulowano');
    await p.waitForTimeout(700);
    const count = await countAssistantMessages(p);
    if (count <= beforeCount) continue;
    const current = await readLastAssistantText(p);
    if (current === lastText && current.length > 0) {
      stable++;
      if (stable >= 3) return current.trim();
    } else {
      stable = 0;
      lastText = current;
    }
  }
  if (lastText) return lastText.trim();
  throw new Error('ChatGPT: timeout 3 min.');
}

// Wywoływane z UI gdy user kliknie "Pokaż okno" w bannerze CHALLENGE_NEEDS_VISIBLE
export async function openChatGPTVisible() {
  await closeAll();
  await ensurePage(true);
}

export async function closeChatGPTBrowser() {
  await closeAll();
}

export function isChatGPTBrowserOpen(): boolean {
  return !!(browser && browser.isConnected() && page && !page.isClosed());
}

export function isChatGPTBrowserVisible(): boolean {
  return isChatGPTBrowserOpen() && !currentHeadless;
}
