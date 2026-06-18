import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { toast } from '../store/toastStore';

interface Repo {
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  isPrivate: boolean;
  description: string | null;
  updatedAt: string;
}

export function OpenRepoModal({ onClose }: { onClose: () => void }) {
  const [hasToken, setHasToken] = useState(false);
  const [user, setUser] = useState<{ login: string; avatarUrl: string } | null>(null);
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [filter, setFilter] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [cloning, setCloning] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState('');

  const loadProjectFromPath = useProjectStore((s) => s.loadProjectFromPath);

  useEffect(() => {
    (async () => {
      const has = await window.aiIDE.keychain.hasGitHubToken();
      setHasToken(has);
      if (has) {
        const u = await window.aiIDE.git.getUser().catch(() => null);
        setUser(u ? { login: u.login, avatarUrl: u.avatarUrl } : null);
        await loadRepos();
      }
    })();
    // eslint-disable-next-line
  }, []);

  const loadRepos = async () => {
    setLoadingRepos(true);
    try { setRepos(await window.aiIDE.git.listRepos()); }
    catch { setRepos([]); }
    finally { setLoadingRepos(false); }
  };

  const saveToken = async () => {
    if (!tokenInput.trim()) return;
    await window.aiIDE.keychain.setGitHubToken(tokenInput.trim());
    setTokenInput('');
    setHasToken(true);
    const u = await window.aiIDE.git.getUser().catch(() => null);
    setUser(u ? { login: u.login, avatarUrl: u.avatarUrl } : null);
    await loadRepos();
    toast.success('Połączono z GitHubem');
  };

  const openRepo = async (cloneUrl: string, name: string) => {
    setCloning(name);
    try {
      const r = await window.aiIDE.git.cloneRepo(cloneUrl);
      if (r?.localPath) {
        await loadProjectFromPath(r.localPath);
        toast.success(`Otwarto ${name}`);
        onClose();
      }
    } catch (e: any) {
      toast.error(`Klonowanie nieudane: ${e?.message || e}`);
    } finally {
      setCloning(null);
    }
  };

  const cloneCustom = async () => {
    let url = customUrl.trim();
    if (!url) return;
    // Akceptuj URL HTML lub clone url
    if (!url.endsWith('.git') && url.includes('github.com')) url = url.replace(/\/?$/, '.git');
    const name = url.split('/').pop()?.replace(/\.git$/, '') || 'repo';
    await openRepo(url, name);
  };

  const filtered = repos?.filter((r) => r.fullName.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass flex h-[600px] w-[640px] flex-col overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <div>
            <h2 className="text-sm font-medium text-neutral-100">Otwórz repo z GitHuba</h2>
            <p className="text-[10.5px] text-neutral-500">Repo zostanie sklonowane do ~/AI_IDE_Projects/</p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!hasToken && (
            <div className="mb-5 rounded-xl bg-indigo-500/[0.08] p-4 ring-1 ring-indigo-500/30">
              <div className="mb-2 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-indigo-300"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z"/></svg>
                <span className="text-[12px] font-medium text-indigo-200">Połącz konto GitHub</span>
              </div>
              <p className="mb-2 text-[10.5px] text-indigo-300/80">Wygeneruj Personal Access Token (zakres: repo), wklej poniżej.</p>
              <button
                onClick={() => window.aiIDE.shell.openExternal('https://github.com/settings/tokens/new?scopes=repo&description=AI%20IDE')}
                className="mb-2 w-full rounded-md bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-900 hover:bg-neutral-100"
              >
                Otwórz GitHub i wygeneruj token
              </button>
              <input
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="ghp_..."
                type="password"
                className="mb-2 w-full rounded-md bg-white/[0.04] px-3 py-1.5 text-[12px] text-neutral-100 ring-1 ring-white/[0.08] outline-none focus:ring-indigo-500/40"
              />
              <button
                onClick={saveToken}
                disabled={!tokenInput.trim()}
                className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                Zapisz token i wczytaj moje repo
              </button>
            </div>
          )}

          <div className="mb-5">
            <h3 className="mb-1.5 text-[11px] font-medium text-neutral-300">Lub wklej URL repo</h3>
            <div className="flex gap-2">
              <input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://github.com/user/repo  lub  git@github.com:user/repo.git"
                className="flex-1 rounded-md bg-white/[0.04] px-3 py-1.5 text-[12px] text-neutral-100 ring-1 ring-white/[0.08] outline-none focus:ring-indigo-500/40"
              />
              <button
                onClick={cloneCustom}
                disabled={!customUrl.trim() || !!cloning}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                Otwórz
              </button>
            </div>
          </div>

          {user && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-medium text-neutral-300">Twoje repo (@{user.login})</h3>
                <button onClick={loadRepos} className="rounded px-1.5 py-0.5 text-[10px] text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200">↻</button>
              </div>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtruj..."
                className="mb-2 w-full rounded-md bg-white/[0.04] px-3 py-1.5 text-[12px] text-neutral-200 ring-1 ring-white/[0.08] outline-none focus:ring-indigo-500/40"
              />
              {loadingRepos ? (
                <div className="py-4 text-center text-[11px] text-neutral-500">Ładuję...</div>
              ) : (
                <div className="space-y-1">
                  {filtered?.map((r) => (
                    <div key={r.fullName} className="flex items-center gap-2 rounded-md px-2.5 py-2 hover:bg-white/[0.04]">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[12px] text-neutral-200">{r.fullName}</span>
                          {r.isPrivate && <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-300">private</span>}
                        </div>
                        {r.description && <div className="truncate text-[10px] text-neutral-500">{r.description}</div>}
                      </div>
                      <button
                        onClick={() => openRepo(r.cloneUrl, r.fullName)}
                        disabled={!!cloning}
                        className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-[10.5px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
                      >
                        {cloning === r.fullName ? 'Klonuję...' : 'Otwórz'}
                      </button>
                    </div>
                  ))}
                  {filtered?.length === 0 && <div className="py-3 text-center text-[11px] text-neutral-500">Brak wyników.</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
