import { IpcMain } from 'electron';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { setDuckAiProxy } from './browser';

// Prywatność: pozwala wysyłać zapytania AI przez proxy (HTTP/HTTPS lub SOCKS5
// przez warstwę HTTP-proxy lokalnego klienta). Wspiera bezpłatne opcje:
//   • Cloudflare WARP (po lokalnej instalacji – HTTP proxy na 127.0.0.1:40000)
//   • Tor (po instalacji – HTTP proxy mostek na 127.0.0.1:8118 jeśli z polipo
//     lub bezpośrednio SOCKS5 9050 – wtedy wymaga http-proxy-mostka)
//   • własne URL HTTP/HTTPS proxy
//
// Wyświetla aktualny publiczny IP (przed/po) by zweryfikować zmianę.

export function registerPrivacyHandlers(ipcMain: IpcMain) {
  // Aktualne publiczne IP + kraj (z opcjonalnym proxy)
  ipcMain.handle('privacy:getPublicIp', async (_e, proxyUrl?: string) => {
    const opts: any = {};
    if (proxyUrl) opts.dispatcher = new ProxyAgent(proxyUrl);
    try {
      const res = await undiciFetch('https://ipapi.co/json/', opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as any;
      return {
        ip: data.ip,
        country: data.country_name,
        city: data.city,
        org: data.org,
      };
    } catch (e) {
      // Fallback – samo IP
      try {
        const res = await undiciFetch('https://api.ipify.org?format=json', opts);
        const data = await res.json() as any;
        return { ip: data.ip, country: null, city: null, org: null };
      } catch (e2) {
        throw new Error(
          proxyUrl
            ? `Nie udało się połączyć przez proxy. Sprawdź czy ${proxyUrl} działa.`
            : 'Nie udało się pobrać IP. Sprawdź połączenie.'
        );
      }
    }
  });

  // Test proxy: sprawdza czy działa i wraca z innym IP niż bez proxy
  ipcMain.handle('privacy:testProxy', async (_e, proxyUrl: string) => {
    try {
      const direct = await undiciFetch('https://api.ipify.org?format=json');
      const directIp = (await direct.json() as any).ip;

      const agent = new ProxyAgent(proxyUrl);
      const proxied = await undiciFetch('https://api.ipify.org?format=json', { dispatcher: agent });
      const proxiedIp = (await proxied.json() as any).ip;

      return {
        ok: directIp !== proxiedIp,
        directIp, proxiedIp,
        changed: directIp !== proxiedIp,
      };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  });

  // Ustaw proxy globalnie dla zapytań AI (duck.ai)
  ipcMain.handle('privacy:setProxy', async (_e, proxyUrl: string | null) => {
    setDuckAiProxy(proxyUrl);
  });
}
