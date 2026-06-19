import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';

interface Props {
  onOpenRepo: () => void;
  onOpenSettings: () => void;
}

export function Welcome({ onOpenRepo, onOpenSettings }: Props) {
  const openProject = useProjectStore((s) => s.openProject);
  const loadProjectFromPath = useProjectStore((s) => s.loadProjectFromPath);
  const recent = useProjectStore((s) => s.recentProjects);
  const removeRecent = useProjectStore((s) => s.removeRecent);
  const [hasGithub, setHasGithub] = useState(false);

  useEffect(() => {
    window.aiIDE.keychain.hasGitHubToken().then(setHasGithub);
  }, []);

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto bg-[#0a1216] p-8">
      <div className="w-full max-w-2xl pt-6">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_0_40px_rgba(99,102,241,0.4)]">
            <span className="text-3xl">✦</span>
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-neutral-100">AI IDE</h1>
          <p className="mt-1 text-[12px] text-neutral-500">Lokalny edytor z darmowym AI — bez subskrypcji, bez tracking-u</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <Action
            title="Otwórz folder"
            desc="Lokalny projekt z dysku"
            shortcut="⌘O"
            onClick={openProject}
            primary
          />
          <Action
            title={hasGithub ? 'Otwórz repo z GitHuba' : 'Połącz GitHub i otwórz repo'}
            desc={hasGithub ? 'Sklonuj do ~/AI_IDE_Projects/' : 'Wymaga jednorazowego tokenu'}
            shortcut=""
            onClick={onOpenRepo}
            badge={hasGithub ? '✓ Połączono' : null}
          />
        </div>

        {recent.length > 0 && (
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10.5px] uppercase tracking-wide text-neutral-500">Niedawne projekty</span>
              <span className="text-[10.5px] text-neutral-600">{recent.length}</span>
            </div>
            <div className="space-y-1 rounded-xl bg-white/[0.02] p-1 ring-1 ring-white/[0.04]">
              {recent.map((p) => (
                <div key={p} className="group flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/[0.04]">
                  <button onClick={() => loadProjectFromPath(p)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[12px] text-neutral-200">{p.split('/').pop()}</div>
                    <div className="truncate text-[10px] text-neutral-500">{p}</div>
                  </button>
                  <button
                    onClick={() => removeRecent(p)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-neutral-600 opacity-0 hover:bg-white/[0.06] hover:text-neutral-300 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl bg-white/[0.02] p-4 ring-1 ring-white/[0.04]">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10.5px] uppercase tracking-wide text-neutral-500">Skróty klawiszowe</span>
            <button onClick={onOpenSettings} className="text-[10.5px] text-[#57cc99] hover:text-[#80ed99]">
              Wszystkie ustawienia →
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Kbd label="Paleta komend" keys="⌘K" />
            <Kbd label="Otwórz projekt" keys="⌘O" />
            <Kbd label="Ustawienia" keys="⌘," />
            <Kbd label="Nowy czat" keys="⌘N" />
            <Kbd label="Wzmianka pliku" keys="@" />
            <Kbd label="Zapisz plik" keys="⌘S" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Action({ title, desc, shortcut, onClick, primary, badge }:
  { title: string; desc: string; shortcut: string; onClick: () => void; primary?: boolean; badge?: string | null }) {
  return (
    <button
      onClick={onClick}
      className={`group rounded-xl p-4 text-left transition ${
        primary
          ? 'bg-[#38a3a5] hover:bg-[#57cc99] ring-1 ring-[#57cc99]/40 shadow-lg shadow-indigo-600/20'
          : 'bg-white/[0.04] hover:bg-white/[0.07] ring-1 ring-white/[0.06]'
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className={`text-[13px] font-medium ${primary ? 'text-white' : 'text-neutral-200'}`}>{title}</span>
        {badge && <span className="rounded bg-[#57cc99]/20 px-1.5 py-0.5 text-[9px] text-[#80ed99]">{badge}</span>}
      </div>
      <div className={`text-[10.5px] ${primary ? 'text-[#c7f9cc]' : 'text-neutral-500'}`}>{desc}</div>
      {shortcut && (
        <div className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[9px] font-mono ${primary ? 'bg-white/15 text-indigo-100' : 'bg-white/[0.05] text-neutral-500'}`}>
          {shortcut}
        </div>
      )}
    </button>
  );
}

function Kbd({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-white/[0.03] px-2.5 py-1.5">
      <span className="text-[10.5px] text-neutral-400">{label}</span>
      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-neutral-300">{keys}</span>
    </div>
  );
}
