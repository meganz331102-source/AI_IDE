import { useEffect, useState } from 'react';
import { useSettingsStore, DEFAULT_SYSTEM_PROMPT } from '../../store/settingsStore';
import { useProjectStore } from '../../store/projectStore';
import { PrivacyTab } from './PrivacyTab';
import { ModelsTab } from './ModelsTab';
import { UpdatesTab } from './UpdatesTab';

interface Repo {
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  isPrivate: boolean;
  description: string | null;
  updatedAt: string;
}

interface User { login: string; avatarUrl: string; name: string | null }

export function Settings({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [tab, setTab] = useState<'general' | 'models' | 'prompt' | 'snippets' | 'privacy' | 'github' | 'updates'>('general');
  const [saved, setSaved] = useState(false);
  const [repoFilter, setRepoFilter] = useState('');
  const [cloning, setCloning] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);

  const showFullPrompt = useSettingsStore((s) => s.showFullPrompt);
  const setShowFullPrompt = useSettingsStore((s) => s.setShowFullPrompt);
  const systemPrompt = useSettingsStore((s) => s.systemPrompt);
  const setSystemPrompt = useSettingsStore((s) => s.setSystemPrompt);
  const resetSystemPrompt = useSettingsStore((s) => s.resetSystemPrompt);
  const autoApply = useSettingsStore((s) => s.autoApply);
  const setAutoApply = useSettingsStore((s) => s.setAutoApply);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const snippets = useSettingsStore((s) => s.snippets);
  const addSnippet = useSettingsStore((s) => s.addSnippet);
  const updateSnippet = useSettingsStore((s) => s.updateSnippet);
  const deleteSnippet = useSettingsStore((s) => s.deleteSnippet);

  const loadProjectFromPath = useProjectStore((s) => s.loadProjectFromPath);

  const [promptDraft, setPromptDraft] = useState(systemPrompt);
  useEffect(() => setPromptDraft(systemPrompt), [systemPrompt]);
  const promptDirty = promptDraft !== systemPrompt;

  useEffect(() => {
    window.aiIDE.keychain.hasGitHubToken().then(async (h) => {
      setHasToken(h);
      if (h) {
        const u = await window.aiIDE.git.getUser().catch(() => null);
        setUser(u);
      }
    });
  }, []);

  const handleSaveToken = async () => {
    if (!token.trim()) return;
    await window.aiIDE.keychain.setGitHubToken(token.trim());
    setHasToken(true);
    setSaved(true);
    setToken('');
    const u = await window.aiIDE.git.getUser().catch(() => null);
    setUser(u);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearToken = async () => {
    await window.aiIDE.keychain.clearGitHubToken();
    setHasToken(false);
    setUser(null);
    setRepos(null);
  };

  const loadRepos = async () => {
    setLoadingRepos(true);
    try {
      const r = await window.aiIDE.git.listRepos();
      setRepos(r);
    } catch {
      setRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  };

  const openTokenPage = () => {
    window.aiIDE.shell.openExternal(
      'https://github.com/settings/tokens/new?scopes=repo&description=AI%20IDE'
    );
  };

  const handleOpenRepo = async (repo: Repo) => {
    setCloning(repo.fullName);
    setCloneError(null);
    try {
      const result = await window.aiIDE.git.cloneRepo(repo.cloneUrl);
      if (result?.localPath) {
        await loadProjectFromPath(result.localPath);
        onClose();
      }
    } catch (e) {
      setCloneError(`Nie udało się sklonować ${repo.fullName}: ${e instanceof Error ? e.message : e}`);
    } finally {
      setCloning(null);
    }
  };

  const handleSavePrompt = () => {
    setSystemPrompt(promptDraft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const filtered = repos?.filter((r) =>
    r.fullName.toLowerCase().includes(repoFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass flex h-[600px] w-[760px] flex-col overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <h2 className="text-sm font-medium text-neutral-100">Ustawienia</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-neutral-500 transition hover:bg-white/[0.06] hover:text-neutral-200"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-44 shrink-0 border-r border-white/[0.06] p-2">
            <SidebarItem active={tab === 'general'} onClick={() => setTab('general')}>Ogólne</SidebarItem>
            <SidebarItem active={tab === 'models'} onClick={() => setTab('models')}>Modele AI</SidebarItem>
            <SidebarItem active={tab === 'prompt'} onClick={() => setTab('prompt')}>System prompt</SidebarItem>
            <SidebarItem active={tab === 'snippets'} onClick={() => setTab('snippets')}>Snippety</SidebarItem>
            <SidebarItem active={tab === 'privacy'} onClick={() => setTab('privacy')}>Prywatność</SidebarItem>
            <SidebarItem active={tab === 'github'} onClick={() => setTab('github')}>GitHub</SidebarItem>
            <SidebarItem active={tab === 'updates'} onClick={() => setTab('updates')}>Aktualizacje</SidebarItem>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
            {tab === 'updates' && <UpdatesTab />}

            {tab === 'general' && (
              <div className="space-y-5">
                <Section title="Wygląd czatu" desc="Co widzisz po wysłaniu wiadomości do AI.">
                  <Toggle
                    checked={showFullPrompt}
                    onChange={setShowFullPrompt}
                    label="Pokazuj pełny prompt wysyłany do AI"
                    desc="Domyślnie widzisz tylko swoje pytanie. Włącz, by widzieć też dołączone instrukcje systemowe i kontekst plików."
                  />
                </Section>
                <Section title="Zmiany kodu" desc="Co robić, gdy AI zaproponuje modyfikację plików.">
                  <Toggle
                    checked={autoApply}
                    onChange={setAutoApply}
                    label="Auto-apply: zastosuj zmiany bez podglądu"
                    desc="Gdy włączone, sugestie z bloków ```język:ścieżka``` zapisują się automatycznie. Inaczej widzisz kafelki Accept/Reject."
                  />
                </Section>
                <Section title="Rozmiar czcionki" desc={`Aktualnie: ${fontSize}px`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={11} max={18} value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="flex-1 accent-indigo-500"
                    />
                    <span className="w-10 text-right font-mono text-[11px] text-neutral-400">{fontSize}px</span>
                  </div>
                </Section>
              </div>
            )}

            {tab === 'snippets' && (
              <Section
                title="Szybkie prompty (snippety)"
                desc="Zapisane szablony do wstawienia jednym klikiem w czacie (ikonka ⚡ obok kontekstu)."
              >
                <div className="space-y-2">
                  {snippets.map((s) => (
                    <div key={s.id} className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
                      <input
                        value={s.name}
                        onChange={(e) => updateSnippet(s.id, { name: e.target.value })}
                        className="mb-1.5 w-full rounded bg-white/[0.04] px-2 py-1 text-[12px] font-medium text-neutral-100 outline-none focus:bg-white/[0.07]"
                      />
                      <textarea
                        value={s.content}
                        onChange={(e) => updateSnippet(s.id, { content: e.target.value })}
                        rows={2}
                        className="w-full resize-y rounded bg-white/[0.04] px-2 py-1 text-[11px] text-neutral-200 outline-none focus:bg-white/[0.07]"
                      />
                      <button
                        onClick={() => deleteSnippet(s.id)}
                        className="mt-1 text-[10px] text-red-400 hover:text-red-300"
                      >
                        Usuń
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addSnippet({ name: 'Nowy snippet', content: '' })}
                    className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] text-neutral-200 ring-1 ring-white/[0.06] hover:bg-white/[0.07]"
                  >
                    + Dodaj snippet
                  </button>
                </div>
              </Section>
            )}

            {tab === 'prompt' && (
              <Section
                title="System prompt"
                desc="Tekst dołączany ZAWSZE na początku każdej wiadomości wysyłanej do AI. Ustal tu instrukcje wieloprojektowe (styl odpowiedzi, format diffów, język, itp.)."
              >
                <textarea
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  rows={14}
                  className="w-full resize-y rounded-lg bg-white/[0.04] px-3 py-2.5 font-mono text-[12px] leading-relaxed text-neutral-100 ring-1 ring-white/[0.06] outline-none transition focus:bg-white/[0.06] focus:ring-indigo-500/40"
                />
                <div className="mt-2 flex items-center justify-between">
                  <button
                    onClick={() => {
                      resetSystemPrompt();
                      setPromptDraft(DEFAULT_SYSTEM_PROMPT);
                    }}
                    className="rounded-md px-2.5 py-1.5 text-[11px] text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200"
                  >
                    Przywróć domyślny
                  </button>
                  <button
                    onClick={handleSavePrompt}
                    disabled={!promptDirty}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
                  >
                    {saved && !promptDirty ? 'Zapisano ✓' : 'Zapisz prompt'}
                  </button>
                </div>
                <p className="mt-3 rounded-md bg-amber-500/10 px-3 py-2 text-[10.5px] leading-relaxed text-amber-200/80 ring-1 ring-amber-500/20">
                  Uwaga: jeśli usuniesz instrukcję o formacie <code className="font-mono">```język:ścieżka```</code>, podgląd diffów (kafelki Accept/Reject) przestanie działać — AI nie zwróci zmian w rozpoznawanym formacie.
                </p>
              </Section>
            )}

            {tab === 'models' && <ModelsTab />}

            {tab === 'privacy' && <PrivacyTab />}

            {tab === 'github' && (
              <div className="space-y-5">
                <Section
                  title="Połączenie z GitHub"
                  desc="Token jest przechowywany w macOS Keychain — nigdy nie opuszcza Twojego komputera poza komunikacją z GitHub API."
                >
                  {user ? (
                    <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2.5 ring-1 ring-emerald-500/30">
                      <div className="flex items-center gap-3">
                        <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full ring-1 ring-emerald-500/40" />
                        <div>
                          <div className="text-[12px] font-medium text-emerald-200">{user.name || user.login}</div>
                          <div className="text-[10px] text-emerald-400/70">@{user.login}</div>
                        </div>
                      </div>
                      <button onClick={handleClearToken} className="rounded-md px-2 py-1 text-[11px] text-emerald-300/80 hover:bg-emerald-500/10 hover:text-emerald-100">
                        Wyloguj
                      </button>
                    </div>
                  ) : hasToken ? (
                    <div className="flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200 ring-1 ring-amber-500/30">
                      <span>Token zapisany, ale nie udało się pobrać profilu</span>
                      <button onClick={handleClearToken} className="underline">Usuń</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button onClick={openTokenPage} className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-100 px-3 py-2.5 text-[12px] font-medium text-neutral-900 transition hover:bg-white">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z"/></svg>
                        Zaloguj przez GitHub
                      </button>
                      <p className="text-[10px] text-neutral-500">Otworzy się GitHub w przeglądarce z formularzem PAT (zakres: repo). Wklej token poniżej.</p>
                      <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="ghp_..."
                        className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] text-neutral-100 ring-1 ring-white/[0.06] placeholder-neutral-600 outline-none transition focus:bg-white/[0.06] focus:ring-indigo-500/40"
                      />
                      <button onClick={handleSaveToken} disabled={!token.trim()} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-[12px] font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40">
                        {saved ? 'Zapisano ✓' : 'Zapisz token'}
                      </button>
                    </div>
                  )}
                </Section>

                {user && (
                  <Section title="Twoje repozytoria" desc="Otwórz repo bezpośrednio w aplikacji — zostanie sklonowane do ~/AI_IDE_Projects/.">
                    {!repos ? (
                      <button onClick={loadRepos} disabled={loadingRepos} className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] text-neutral-200 ring-1 ring-white/[0.06] transition hover:bg-white/[0.07]">
                        {loadingRepos ? 'Ładuję...' : 'Pokaż moje repozytoria'}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input
                          value={repoFilter}
                          onChange={(e) => setRepoFilter(e.target.value)}
                          placeholder="Szukaj repo..."
                          className="w-full rounded-lg bg-white/[0.04] px-3 py-1.5 text-[12px] text-neutral-100 ring-1 ring-white/[0.06] placeholder-neutral-600 outline-none focus:bg-white/[0.06] focus:ring-indigo-500/40"
                        />
                        {cloneError && (
                          <div className="rounded-md bg-red-500/10 px-3 py-2 text-[11px] text-red-300 ring-1 ring-red-500/30">
                            {cloneError}
                          </div>
                        )}
                        <div className="max-h-64 space-y-1 overflow-y-auto scrollbar-thin">
                          {filtered?.map((r) => (
                            <div key={r.fullName} className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[11px] hover:bg-white/[0.04]">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-neutral-200">{r.fullName}</span>
                                  {r.isPrivate && <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-300">private</span>}
                                </div>
                                {r.description && <div className="truncate text-[10px] text-neutral-500">{r.description}</div>}
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  onClick={() => handleOpenRepo(r)}
                                  disabled={cloning === r.fullName}
                                  className="rounded bg-indigo-600 px-2 py-1 text-[10.5px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
                                >
                                  {cloning === r.fullName ? 'Klonuję...' : 'Otwórz w aplikacji'}
                                </button>
                                <button
                                  onClick={() => window.aiIDE.shell.openExternal(r.htmlUrl)}
                                  className="rounded px-2 py-1 text-[10.5px] text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-100"
                                >
                                  GitHub
                                </button>
                              </div>
                            </div>
                          ))}
                          {filtered?.length === 0 && <div className="px-2 py-3 text-[11px] text-neutral-500">Brak wyników.</div>}
                        </div>
                      </div>
                    )}
                  </Section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-md px-3 py-2 text-left text-[12px] transition ${
        active ? 'bg-white/[0.07] text-neutral-100' : 'text-neutral-400 hover:bg-white/[0.04]'
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <h3 className="text-[12px] font-medium text-neutral-200">{title}</h3>
        {desc && <p className="mt-0.5 text-[10.5px] leading-relaxed text-neutral-500">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked, onChange, label, desc,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.03]">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-4 w-7 shrink-0 rounded-full transition ${checked ? 'bg-indigo-600' : 'bg-white/[0.08]'}`}
      >
        <span className={`block h-3 w-3 rounded-full bg-white shadow-sm transition ${checked ? 'ml-3' : 'ml-0.5'}`} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-neutral-200">{label}</div>
        {desc && <div className="mt-0.5 text-[10.5px] leading-relaxed text-neutral-500">{desc}</div>}
      </div>
    </label>
  );
}
