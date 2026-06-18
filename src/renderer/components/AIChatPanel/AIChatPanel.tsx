import { useEffect, useMemo, useRef, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useDraftStore } from '../../store/draftStore';
import { toast } from '../../store/toastStore';
import { AI_MODELS, estimateTokens } from '../../../shared/constants';
import type { AIModelId, ProposedChange, ProjectFile } from '../../../shared/types';
import { DiffViewer } from '../DiffViewer/DiffViewer';
import { parseProposedChanges } from '../DiffViewer/changeParser';
import { MarkdownMessage } from './MarkdownMessage';
import { BotChallengeModal } from '../BotChallengeModal';

function flattenFiles(nodes: ProjectFile[]): ProjectFile[] {
  const out: ProjectFile[] = [];
  function walk(ns: ProjectFile[]) {
    for (const n of ns) {
      if (!n.isDirectory) out.push(n);
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);
  return out;
}

interface ChallengeState {
  kind: 'rate' | 'challenge' | 'chatgpt-visible';
  retryAfter?: number;
  url?: string;
  message: string;
  pendingPrompt: string;
}

interface AIChatPanelProps {
  onOpenSettings?: () => void;
}

export function AIChatPanel({ onOpenSettings }: AIChatPanelProps = {}) {
  const activeModel = useChatStore((s) => s.activeModel);
  const setActiveModel = useChatStore((s) => s.setActiveModel);
  const messages = useChatStore((s) => s.messages);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const isSending = useChatStore((s) => s.isSending);
  const startSession = useChatStore((s) => s.startSession);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const removeLastExchange = useChatStore((s) => s.removeLastExchange);

  const selectedFilePaths = useProjectStore((s) => s.selectedFilePaths);
  const toggleFileSelection = useProjectStore((s) => s.toggleFileSelection);
  const fileTree = useProjectStore((s) => s.fileTree);

  const showFullPrompt = useSettingsStore((s) => s.showFullPrompt);
  const systemPrompt = useSettingsStore((s) => s.systemPrompt);
  const autoApply = useSettingsStore((s) => s.autoApply);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const snippets = useSettingsStore((s) => s.snippets);

  const prefillNonce = useDraftStore((s) => s.prefillNonce);
  const consumePrefill = useDraftStore((s) => s.consume);

  const [input, setInput] = useState('');
  const [pendingChanges, setPendingChanges] = useState<ProposedChange[]>([]);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [mention, setMention] = useState<{ query: string; pos: number; activeIdx: number } | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const tokenEstimate = estimateTokens(input);

  // Memoizujemy spłaszczone drzewo — robione co render było kosztowne dla dużych projektów
  const allFiles = useMemo(() => (fileTree ? flattenFiles(fileTree) : []), [fileTree]);

  // Watchdog: jeśli isSending utknie > 3min (np. przez nieobsłużony błąd providera),
  // automatycznie zwolnij flagę – inaczej tekstarea i przycisk Wyślij są zablokowane.
  useEffect(() => {
    if (!isSending) return;
    const timer = setTimeout(() => {
      if (useChatStore.getState().isSending) {
        useChatStore.setState({ isSending: false });
        toast.error('Timeout AI: 3 min. Spróbuj ponownie.');
      }
    }, 180_000);
    return () => clearTimeout(timer);
  }, [isSending]);

  // Smart auto-scroll: skacze do dołu tylko jeśli użytkownik JUŻ był blisko dołu.
  // W przeciwnym razie czytasz w spokoju starszą wiadomość, nowa nie zrywa scrolla.
  const wasAtBottomRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (scrollRef.current && wasAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingChanges, isSending]);

  // Prefill z PreviewPanel (zaznaczony element)
  useEffect(() => {
    if (prefillNonce === 0) return;
    const text = consumePrefill();
    if (text) {
      setInput((prev) => (prev ? prev + '\n\n' : '') + text);
      textareaRef.current?.focus();
    }
  }, [prefillNonce, consumePrefill]);

  // @-mention autocomplete
  const mentionResults = mention
    ? allFiles
        .filter((f) => f.path.toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, 8)
    : [];

  const handleInput = (val: string, caretPos: number) => {
    setInput(val);
    // Znajdź najbliższe '@' przed kursorem (bez spacji między)
    const before = val.slice(0, caretPos);
    const m = before.match(/@([\w\-./]*)$/);
    if (m) setMention({ query: m[1], pos: caretPos - m[0].length, activeIdx: 0 });
    else setMention(null);
  };

  const insertMention = (file: ProjectFile) => {
    if (!mention) return;
    const before = input.slice(0, mention.pos);
    const after = input.slice(mention.pos + mention.query.length + 1);
    setInput(before + `@${file.path} ` + after);
    toggleFileSelection(file.absolutePath); // automatycznie do kontekstu
    toast.info(`Dodano @${file.name} do kontekstu`);
    setMention(null);
    textareaRef.current?.focus();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    let added = 0;
    for (const f of files) {
      const fileNode = allFiles.find((af) => af.absolutePath === (f as any).path);
      if (fileNode) {
        toggleFileSelection(fileNode.absolutePath);
        added++;
      }
    }
    if (added > 0) toast.success(`Dodano ${added} ${added === 1 ? 'plik' : 'plików'} do kontekstu`);
  };

  const handleModelSwitch = async (modelId: AIModelId) => {
    setActiveModel(modelId);
    await startSession(modelId);
  };

  const handleStop = async () => {
    await window.aiIDE.ai.abort(activeModel);
    toast.info('Przerwano generowanie');
  };

  const doSend = async (textToSend: string, retryPrompt?: string) => {
    const filePaths = Array.from(selectedFilePaths);
    const contextFiles = await window.aiIDE.context.buildContext(filePaths);
    const contextBlock = contextFiles
      .map((f) => `--- ${f.path} ---\n${f.content}`)
      .join('\n\n');

    const fullPrompt = retryPrompt || [
      systemPrompt,
      contextBlock ? `Kontekst plików:\n${contextBlock}` : '',
      `Pytanie użytkownika:\n${textToSend}`,
    ].filter(Boolean).join('\n\n');

    const visibleContent = showFullPrompt ? fullPrompt : textToSend;

    try {
      await sendMessage(visibleContent, fullPrompt, filePaths);
      const lastMessage = useChatStore.getState().messages.slice(-1)[0];
      if (lastMessage?.role === 'assistant') {
        const originalContents = new Map(contextFiles.map((f) => [f.path, f.content]));
        const changes = parseProposedChanges(lastMessage.content, originalContents);
        if (changes.length > 0) {
          if (autoApply) {
            for (const change of changes) {
              if (change.type !== 'delete' && change.newContent !== null) {
                await window.aiIDE.fs.writeFileContent(change.filePath, change.newContent);
              } else if (change.type === 'delete') {
                await window.aiIDE.fs.deleteFile(change.filePath);
              }
            }
            toast.success(`Auto-zastosowano ${changes.length} ${changes.length === 1 ? 'zmianę' : 'zmiany'}`);
          } else {
            setPendingChanges(changes);
          }
        }
      }
    } catch (e: any) {
      // Spróbuj sparsować structured error
      const msg = String(e?.message || e);
      const jsonMatch = msg.match(/\{.*"code".*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.code === 'RATE_LIMIT' || parsed.code === 'CHALLENGE') {
            setChallenge({
              kind: parsed.code === 'RATE_LIMIT' ? 'rate' : 'challenge',
              retryAfter: parsed.retryAfter,
              url: parsed.challengeUrl,
              message: parsed.message,
              pendingPrompt: fullPrompt,
            });
            return;
          }
          if (parsed.code === 'CHALLENGE_NEEDS_VISIBLE' || parsed.code === 'CHALLENGE_VISIBLE') {
            // ChatGPT trafił na Cloudflare – pokaż banner z przyciskiem otwarcia okna
            setChallenge({
              kind: 'chatgpt-visible',
              message: parsed.message,
              pendingPrompt: fullPrompt,
            });
            return;
          }
          if (parsed.code === 'NO_KEY') {
            toast.error(parsed.message);
            if (parsed.signupUrl) window.aiIDE.shell.openExternal(parsed.signupUrl);
            return;
          }
        } catch { /* fall through */ }
      }
      toast.error(msg.slice(0, 200));
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    const userInput = input;
    setInput('');
    setMention(null);
    await doSend(userInput);
  };

  const handleAcceptChange = async (change: ProposedChange) => {
    if (change.type !== 'delete' && change.newContent !== null) {
      await window.aiIDE.fs.writeFileContent(change.filePath, change.newContent);
      toast.success(`Zapisano ${change.filePath.split('/').pop()}`);
    } else if (change.type === 'delete') {
      await window.aiIDE.fs.deleteFile(change.filePath);
      toast.info(`Usunięto ${change.filePath.split('/').pop()}`);
    }
    setPendingChanges((prev) => prev.filter((c) => c.id !== change.id));
  };

  const handleRejectChange = (change: ProposedChange) => {
    setPendingChanges((prev) => prev.filter((c) => c.id !== change.id));
  };

  const handleNewChat = async () => {
    clearMessages();
    setPendingChanges([]);
    await window.aiIDE.ai.resetSession(activeModel);
    toast.info('Nowy czat');
  };

  // Edytuj ostatnie pytanie: usuwa ostatni user+assistant z historii,
  // wczytuje treść z powrotem do inputu
  const handleEditLast = () => {
    const userMsgs = messages.filter((m) => m.role === 'user');
    const last = userMsgs[userMsgs.length - 1];
    if (!last) return;
    setInput(last.content);
    removeLastExchange();
    window.aiIDE.ai.resetSession(activeModel);
    textareaRef.current?.focus();
  };

  // Regeneruj odpowiedź: powtarza ostatnie pytanie do AI
  const handleRegenerate = async () => {
    const userMsgs = messages.filter((m) => m.role === 'user');
    const last = userMsgs[userMsgs.length - 1];
    if (!last) return;
    const content = last.content;
    removeLastExchange();
    await window.aiIDE.ai.resetSession(activeModel);
    await doSend(content);
  };

  return (
    <div
      className="grid h-full min-h-0 bg-[#0c0c10]"
      style={{ gridTemplateRows: 'auto auto minmax(0, 1fr) auto' }}
    >
      {challenge && (
        <BotChallengeModal
          kind={challenge.kind}
          retryAfter={challenge.retryAfter}
          url={challenge.url}
          message={challenge.message}
          onClose={() => setChallenge(null)}
          onRetry={() => {
            const p = challenge.pendingPrompt;
            setChallenge(null);
            doSend('', p);
          }}
        />
      )}

      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] p-2">
        <div className="flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="flex w-max gap-0.5 rounded-lg bg-white/[0.03] p-0.5">
            {Object.values(AI_MODELS).map((model) => (
              <button
                key={model.id}
                onClick={() => handleModelSwitch(model.id)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  activeModel === model.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200'
                }`}
              >
                {model.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleNewChat}
          title="Nowy czat (⌘N)"
          className="shrink-0 rounded-md px-2 py-1 text-[11px] text-neutral-500 transition hover:bg-white/[0.05] hover:text-neutral-200"
        >
          + Nowy
        </button>
      </div>

      <div className="shrink-0 border-b border-white/[0.06] px-3 py-2 text-[11px] text-neutral-500">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${selectedFilePaths.size > 0 ? 'bg-emerald-500' : 'bg-neutral-700'}`} />
            {selectedFilePaths.size} {selectedFilePaths.size === 1 ? 'plik' : 'plików'} w kontekście
            {tokenEstimate > 0 && <span className="ml-2 text-neutral-600">~{tokenEstimate} tok.</span>}
          </span>
          <div className="flex items-center gap-2">
            {autoApply && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] text-amber-300">auto-apply</span>}
            <button
              onClick={() => setShowSnippets((v) => !v)}
              title="Szybkie prompty"
              className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-white/[0.05] hover:text-neutral-300"
            >
              ⚡
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 space-y-3 overflow-y-auto p-3" style={{ fontSize }}>
        {messages.length === 0 && !isSending && (
          <div className="flex h-full flex-col items-center justify-center text-center text-neutral-600">
            <div className="mb-3 text-3xl">✦</div>
            <div className="text-xs">Rozmowa z {AI_MODELS[activeModel]?.label}</div>
            <div className="mt-1 max-w-[220px] text-[10.5px] text-neutral-700">
              Zaznacz pliki, użyj <span className="font-mono text-neutral-500">@nazwa</span> lub przeciągnij pliki tutaj
            </div>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1;
          const lastUserIdx = (() => { for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') return i; return -1; })();
          const showEditOnUser = msg.role === 'user' && idx === lastUserIdx && !isSending;
          return (
            <div
              key={msg.id}
              className={`group relative min-w-0 rounded-xl px-3.5 py-2.5 leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'ml-8 bg-indigo-600/15 ring-1 ring-indigo-500/20 text-neutral-100'
                  : msg.role === 'system'
                  ? 'bg-red-950/40 ring-1 ring-red-500/30 text-red-200'
                  : 'mr-8 bg-white/[0.04] ring-1 ring-white/[0.06] text-neutral-100'
              }`}
            >
              {msg.role === 'assistant'
                ? <MarkdownMessage content={msg.content} />
                : <pre className="whitespace-pre-wrap break-words font-sans">{msg.content}</pre>}

              {/* Edit dla ostatniego user message */}
              {showEditOnUser && (
                <button
                  onClick={handleEditLast}
                  className="absolute -bottom-2 right-2 rounded bg-white/[0.06] px-2 py-0.5 text-[10px] text-neutral-300 opacity-0 ring-1 ring-white/[0.08] transition group-hover:opacity-100 hover:bg-white/[0.12]"
                >
                  Edytuj
                </button>
              )}
              {/* Regenerate dla ostatniej odpowiedzi AI */}
              {msg.role === 'assistant' && isLast && !isSending && (
                <button
                  onClick={handleRegenerate}
                  title="Wygeneruj ponownie"
                  className="absolute -bottom-2 left-2 rounded bg-white/[0.06] px-2 py-0.5 text-[10px] text-neutral-300 opacity-0 ring-1 ring-white/[0.08] transition group-hover:opacity-100 hover:bg-white/[0.12]"
                >
                  ↻ Regeneruj
                </button>
              )}
            </div>
          );
        })}

        {pendingChanges.map((change) => (
          <DiffViewer
            key={change.id}
            change={change}
            onAccept={handleAcceptChange}
            onReject={handleRejectChange}
          />
        ))}

        {isSending && (
          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" style={{ animationDelay: '300ms' }} />
            </span>
            AI pisze odpowiedź...
          </div>
        )}
      </div>

      <div
        className="relative z-10 border-t border-white/[0.06] bg-[#0c0c10] p-3"
        style={{ minHeight: 96 }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {showSnippets && (
          <div className="absolute bottom-full left-3 right-3 mb-2 max-h-56 overflow-y-auto rounded-lg bg-[#15151a]/98 backdrop-blur ring-1 ring-white/10 shadow-2xl">
            <div className="border-b border-white/[0.06] px-3 py-1.5 text-[10px] uppercase tracking-wide text-neutral-500">Szybkie prompty</div>
            {snippets.map((s) => (
              <div
                key={s.id}
                onClick={() => { setInput((prev) => prev ? prev + '\n\n' + s.content : s.content); setShowSnippets(false); textareaRef.current?.focus(); }}
                className="cursor-pointer border-b border-white/[0.03] px-3 py-2 hover:bg-white/[0.04]"
              >
                <div className="text-[12px] font-medium text-neutral-200">{s.name}</div>
                <div className="truncate text-[10.5px] text-neutral-500">{s.content}</div>
              </div>
            ))}
            {snippets.length === 0 && (
              <div className="px-3 py-3 text-center text-[11px] text-neutral-500">Brak snippetów – dodaj w Ustawieniach</div>
            )}
          </div>
        )}
        {mention && mentionResults.length > 0 && (
          <div className="mention-popup" style={{ left: 12, right: 12 }}>
            {mentionResults.map((f, idx) => (
              <div
                key={f.absolutePath}
                className={`mention-item ${idx === mention.activeIdx ? 'active' : ''}`}
                onMouseEnter={() => setMention({ ...mention, activeIdx: idx })}
                onClick={() => insertMention(f)}
              >
                <div>{f.name}</div>
                <div className="mention-item-path">{f.path}</div>
              </div>
            ))}
          </div>
        )}
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'auto 1fr' }}
        >
          {/* LEWA KOLUMNA: szybkie akcje */}
          <div className="flex flex-col gap-1">
            <button
              onClick={async () => {
                if (messages.length > 0 && !confirm('Wyczyścić całą historię czatu?')) return;
                clearMessages();
                await window.aiIDE.ai.resetSession(activeModel);
                toast.info('Czat wyczyszczony');
              }}
              title="Wyczyść czat"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-[13px] text-neutral-400 ring-1 ring-white/[0.06] hover:bg-white/[0.08] hover:text-neutral-200"
            >
              🗑
            </button>
            <button
              onClick={() => onOpenSettings?.()}
              title="Zmień IP (Ustawienia → Prywatność)"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-[13px] text-neutral-400 ring-1 ring-white/[0.06] hover:bg-white/[0.08] hover:text-neutral-200"
            >
              🌐
            </button>
            <button
              onClick={() => setShowSnippets((v) => !v)}
              title="Gotowe prompty"
              className={`flex h-8 w-8 items-center justify-center rounded-md ring-1 text-[13px] hover:bg-white/[0.08] hover:text-neutral-200 ${
                showSnippets ? 'bg-indigo-600 text-white ring-indigo-400/30' : 'bg-white/[0.04] text-neutral-400 ring-white/[0.06]'
              }`}
            >
              ⚡
            </button>
          </div>

          {/* PRAWA KOLUMNA: textarea + stopka */}
          <div className="flex flex-col gap-1.5">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInput(e.target.value, e.target.selectionStart || 0)}
              onKeyDown={(e) => {
                if (mention && mentionResults.length > 0) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setMention({ ...mention, activeIdx: Math.min(mention.activeIdx + 1, mentionResults.length - 1) }); return; }
                  if (e.key === 'ArrowUp')   { e.preventDefault(); setMention({ ...mention, activeIdx: Math.max(mention.activeIdx - 1, 0) }); return; }
                  if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionResults[mention.activeIdx]); return; }
                  if (e.key === 'Escape') { e.preventDefault(); setMention(null); return; }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isSending) handleSend();
                }
              }}
              placeholder={`Wpisz pytanie. @ — wzmianka pliku${isSending ? ' (AI pracuje, możesz pisać dalej)' : ''}`}
              className="w-full resize-none rounded-lg bg-white/[0.04] px-3 py-2.5 text-[13px] text-neutral-100 ring-1 ring-white/[0.06] placeholder-neutral-600 outline-none transition focus:bg-white/[0.06] focus:ring-indigo-500/40"
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-600">
                {isSending ? (
                  <span className="inline-flex items-center gap-1 text-amber-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    AI pisze…
                  </span>
                ) : (
                  'Enter = wyślij · Shift+Enter = linia'
                )}
              </span>
              {isSending ? (
                <button
                  onClick={handleStop}
                  className="rounded-md bg-red-500/15 px-2.5 py-1 text-[10.5px] font-medium text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/25"
                >
                  ◼ Stop
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="rounded-md bg-indigo-600 px-2.5 py-1 text-[10.5px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
                >
                  Wyślij ↵
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
