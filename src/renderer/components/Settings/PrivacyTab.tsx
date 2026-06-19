import { useEffect, useState } from 'react';
import { loadProxyConfig, saveProxyConfig } from '../../store/settingsStore';

interface IpInfo { ip: string; country: string | null; city: string | null; org: string | null; }

export function PrivacyTab() {
  const [ip, setIp] = useState<IpInfo | null>(null);
  const [loadingIp, setLoadingIp] = useState(false);
  const initial = loadProxyConfig();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [proxyUrl, setProxyUrl] = useState(initial.url);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const refreshIp = async () => {
    setLoadingIp(true);
    setIp(null);
    try {
      const info = await window.aiIDE.privacy.getPublicIp(enabled && proxyUrl ? proxyUrl : undefined);
      setIp(info);
    } catch (e: any) {
      setIp({ ip: 'Błąd: ' + (e?.message || e), country: null, city: null, org: null });
    } finally {
      setLoadingIp(false);
    }
  };

  useEffect(() => { refreshIp(); /* on mount */ /* eslint-disable-next-line */ }, []);

  const applyProxy = async () => {
    saveProxyConfig(enabled, proxyUrl);
    await window.aiIDE.privacy.setProxy(enabled && proxyUrl ? proxyUrl : null);
    refreshIp();
  };

  const testProxy = async () => {
    if (!proxyUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await window.aiIDE.privacy.testProxy(proxyUrl);
      if (r.ok) {
        setTestResult({ ok: true, msg: `Działa! IP zmieniono: ${r.directIp} → ${r.proxiedIp}` });
      } else if (r.error) {
        setTestResult({ ok: false, msg: r.error });
      } else if (r.directIp === r.proxiedIp) {
        setTestResult({ ok: false, msg: `Proxy odpowiada, ale IP się nie zmienia (${r.directIp}). Może być źle skonfigurowane.` });
      } else {
        setTestResult({ ok: false, msg: 'Test nieudany.' });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-[12px] font-medium text-neutral-200">Twoje publiczne IP</h3>
        <div className="rounded-lg bg-white/[0.04] p-3 ring-1 ring-white/[0.06]">
          {loadingIp ? (
            <div className="text-[11px] text-neutral-500">Pobieram...</div>
          ) : ip ? (
            <>
              <div className="font-mono text-[14px] font-medium text-neutral-100">{ip.ip}</div>
              {(ip.country || ip.city || ip.org) && (
                <div className="mt-1 text-[10.5px] text-neutral-500">
                  {[ip.city, ip.country, ip.org].filter(Boolean).join(' · ')}
                </div>
              )}
            </>
          ) : (
            <div className="text-[11px] text-neutral-500">—</div>
          )}
          <button
            onClick={refreshIp}
            className="mt-2 rounded-md bg-white/[0.04] px-2.5 py-1 text-[10.5px] text-neutral-300 ring-1 ring-white/[0.06] hover:bg-white/[0.07]"
          >
            ↻ Odśwież
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-[12px] font-medium text-neutral-200">Zmień IP – proxy / VPN</h3>
        <p className="mb-3 text-[10.5px] leading-relaxed text-neutral-500">
          Aplikacja może wysyłać zapytania AI przez Twój proxy/VPN. Możesz w ten sposób uniknąć rate-limitów duck.ai (każda zmiana IP = świeży limit) i ukryć swoje prawdziwe IP.
        </p>

        <label className="mb-2 flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-white/[0.03]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#38a3a5]"
          />
          <span className="text-[12px] text-neutral-200">Włącz proxy dla zapytań AI</span>
        </label>

        <input
          value={proxyUrl}
          onChange={(e) => setProxyUrl(e.target.value)}
          placeholder="http://127.0.0.1:40000  (np. WARP)   |   http://127.0.0.1:8118  (Tor mostek)"
          className="w-full rounded-lg bg-white/[0.04] px-3 py-2 font-mono text-[11px] text-neutral-100 ring-1 ring-white/[0.06] placeholder-neutral-600 outline-none focus:bg-white/[0.06] focus:ring-[#38a3a5]/50"
        />

        <div className="mt-2 flex gap-2">
          <button
            onClick={testProxy}
            disabled={!proxyUrl || testing}
            className="flex-1 rounded-md bg-white/[0.04] px-3 py-1.5 text-[11px] text-neutral-200 ring-1 ring-white/[0.06] hover:bg-white/[0.07] disabled:opacity-40"
          >
            {testing ? 'Testuję...' : 'Testuj proxy'}
          </button>
          <button
            onClick={applyProxy}
            className="flex-1 rounded-md bg-[#38a3a5] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#57cc99]"
          >
            Zapisz i zastosuj
          </button>
        </div>

        {testResult && (
          <div className={`mt-3 rounded-md px-3 py-2 text-[11px] ring-1 ${
            testResult.ok ? 'bg-[#57cc99]/10 text-[#c7f9cc] ring-[#57cc99]/40' : 'bg-red-500/10 text-red-300 ring-red-500/30'
          }`}>
            {testResult.msg}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-[12px] font-medium text-neutral-200">Darmowe i szybkie opcje</h3>
        <div className="space-y-2">
          <Card
            title="Cloudflare WARP"
            desc="Najprostsze. Po instalacji uruchamia HTTP proxy lokalnie. Darmowe, szybkie, bez limitów."
            tip="Zainstaluj, włącz, wpisz wyżej: http://127.0.0.1:40000"
            href="https://1.1.1.1/"
          />
          <Card
            title="Tor Browser"
            desc="Pełna anonimowość przez sieć Tor. Wolniejsze niż WARP."
            tip="Zainstaluj. Tor sam słucha na SOCKS5 127.0.0.1:9050 – ale potrzebny mostek HTTP (np. polipo), wtedy ustaw http://127.0.0.1:8118"
            href="https://www.torproject.org/download/"
          />
          <Card
            title="ProtonVPN Free"
            desc="Klasyczny VPN. Aplikacja zmieni IP systemowo, więc nawet bez wpisywania proxy wyżej, Twoje IP się zmieni globalnie."
            tip="Po włączeniu w aplikacji ProtonVPN — kliknij tu Odśwież IP i zobacz nowy adres."
            href="https://protonvpn.com/free-vpn"
          />
        </div>
      </div>
    </div>
  );
}

function Card({ title, desc, tip, href }: { title: string; desc: string; tip: string; href: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-neutral-200">{title}</span>
        <button
          onClick={() => window.aiIDE.shell.openExternal(href)}
          className="rounded bg-[#38a3a5]/90 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-[#57cc99]"
        >
          Pobierz
        </button>
      </div>
      <div className="text-[10.5px] leading-relaxed text-neutral-400">{desc}</div>
      <div className="mt-1 rounded bg-black/30 px-2 py-1 font-mono text-[10px] text-[#ffba08]/80">{tip}</div>
    </div>
  );
}
