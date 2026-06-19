// Auto dev-server: wykrywa framework, instaluje deps jeśli trzeba,
// uruchamia `npm run dev`, parsuje stdout dla URL localhost.
//
// KLUCZ na macOS:
// - Aplikacje odpalane z Findera/Docka dziedziczą minimalny PATH (/usr/bin:/bin)
// - Z tego PATH nie ma `npm` ani `node` (są w /opt/homebrew/bin lub /usr/local/bin)
// - Dlatego sourcujemy PATH z login-shella użytkownika (-ilc)

import { BrowserWindow, IpcMain } from 'electron';
import { ChildProcess, spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

interface FrameworkConfig {
  name: string;
  depKey: string;
  cmd: string;
  args: string[];
  defaultPort: number;
}

const FRAMEWORKS: FrameworkConfig[] = [
  { name: 'Next.js',  depKey: 'next',          cmd: 'npm', args: ['run', 'dev'], defaultPort: 3000 },
  { name: 'Vite',     depKey: 'vite',          cmd: 'npm', args: ['run', 'dev'], defaultPort: 5173 },
  { name: 'CRA',      depKey: 'react-scripts', cmd: 'npm', args: ['start'],      defaultPort: 3000 },
  { name: 'Astro',    depKey: 'astro',         cmd: 'npm', args: ['run', 'dev'], defaultPort: 4321 },
  { name: 'Parcel',   depKey: 'parcel',        cmd: 'npm', args: ['start'],      defaultPort: 1234 },
  { name: 'Nuxt',     depKey: 'nuxt',          cmd: 'npm', args: ['run', 'dev'], defaultPort: 3000 },
  { name: 'SvelteKit',depKey: '@sveltejs/kit', cmd: 'npm', args: ['run', 'dev'], defaultPort: 5173 },
  { name: 'Remix',    depKey: '@remix-run/dev',cmd: 'npm', args: ['run', 'dev'], defaultPort: 3000 },
];

interface DevServer {
  process: ChildProcess;
  rootPath: string;
  url: string | null;
  framework: string;
  output: string[];
}

let current: DevServer | null = null;
let cachedShellPath: string | null = null;

// ============ PATH FIX ============
function commonNodePaths(): string {
  const home = os.homedir();
  return [
    '/opt/homebrew/bin',          // Apple Silicon Homebrew
    '/opt/homebrew/sbin',
    '/usr/local/bin',             // Intel Homebrew + oficjalny installer Node
    '/usr/local/sbin',
    `${home}/.volta/bin`,         // Volta
    `${home}/.fnm/aliases/default/bin`, // fnm
    `${home}/Library/pnpm`,       // pnpm
    `${home}/.bun/bin`,           // Bun
    `${home}/.nvm/versions/node`, // NVM (uproszczone)
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ].join(':');
}

async function getUserShellPath(): Promise<string> {
  if (cachedShellPath) return cachedShellPath;

  const shell = process.env.SHELL || '/bin/zsh';
  // -i -l -c sourcuje .zshrc/.bash_profile/.profile i echo'uje PATH
  const cmd = `${shell} -ilc 'echo "__AIIDE_PATH_START__$PATH__AIIDE_PATH_END__"'`;

  const shellPath = await new Promise<string>((resolve) => {
    exec(cmd, { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout) return resolve('');
      const match = stdout.match(/__AIIDE_PATH_START__(.+?)__AIIDE_PATH_END__/s);
      resolve(match ? match[1].trim() : '');
    });
  });

  // Łączymy: PATH z shella + common locations + obecny process.env.PATH
  const segments = [
    shellPath,
    commonNodePaths(),
    process.env.PATH || '',
  ].filter(Boolean).join(':');

  // Deduplicate kolejność
  const seen = new Set<string>();
  cachedShellPath = segments.split(':').filter((p) => {
    if (!p || seen.has(p)) return false;
    seen.add(p);
    return true;
  }).join(':');

  return cachedShellPath;
}

async function findCommand(cmd: string): Promise<string | null> {
  const env = await getEnv();
  return new Promise((resolve) => {
    exec(`command -v ${cmd}`, { env }, (err, stdout) => {
      if (err || !stdout.trim()) return resolve(null);
      resolve(stdout.trim());
    });
  });
}

async function getEnv(): Promise<NodeJS.ProcessEnv> {
  const realPath = await getUserShellPath();
  return {
    ...process.env,
    PATH: realPath,
    BROWSER: 'none',
    CI: 'true',
    FORCE_COLOR: '0',
    NODE_NO_WARNINGS: '1',
  };
}

// ============ DETECTION ============
export async function detectFramework(rootPath: string): Promise<FrameworkConfig | null> {
  try {
    const pkgRaw = await fs.readFile(path.join(rootPath, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const fw of FRAMEWORKS) if (deps[fw.depKey]) return fw;
    return null;
  } catch { return null; }
}

async function hasNodeModules(rootPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path.join(rootPath, 'node_modules'));
    return stat.isDirectory();
  } catch { return false; }
}

// ============ BROADCAST ============
function broadcast(channel: string, payload: any) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, payload);
  }
}

export function getStatus() {
  if (!current) return { running: false };
  return {
    running: true,
    url: current.url,
    framework: current.framework,
    rootPath: current.rootPath,
  };
}

export async function stop(): Promise<void> {
  if (!current) return;
  const proc = current.process;
  current = null;
  try { proc.kill('SIGTERM'); } catch {}
  setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 2000);
  broadcast('devServer:stopped', null);
}

// ============ INSTALL DEPS ============
async function runNpmInstall(rootPath: string): Promise<{ ok: boolean; error?: string }> {
  const npmPath = await findCommand('npm');
  if (!npmPath) {
    return { ok: false, error: 'Nie znaleziono `npm`. Zainstaluj Node.js: https://nodejs.org' };
  }
  const env = await getEnv();

  broadcast('devServer:log', '\n[AI IDE] Instaluję zależności (npm install)...\n');
  const proc = spawn(npmPath, ['install', '--no-audit', '--no-fund'], {
    cwd: rootPath, env, shell: false,
  });
  proc.stdout?.on('data', (d) => broadcast('devServer:log', d.toString()));
  proc.stderr?.on('data', (d) => broadcast('devServer:log', d.toString()));
  return new Promise((resolve) => {
    proc.on('exit', (code) => {
      if (code === 0) {
        broadcast('devServer:log', '\n[AI IDE] Zainstalowano. Uruchamiam dev server...\n');
        resolve({ ok: true });
      } else {
        resolve({ ok: false, error: `npm install zakończył się kodem ${code}` });
      }
    });
    proc.on('error', (e) => resolve({ ok: false, error: e.message }));
  });
}

// ============ START ============
export async function start(rootPath: string): Promise<{ ok: boolean; framework: string; url?: string; error?: string }> {
  await stop();

  const fw = await detectFramework(rootPath);
  if (!fw) return { ok: false, framework: 'unknown', error: 'Brak package.json lub nieznany framework. Wspierane: Next.js, Vite, CRA, Astro, Nuxt, SvelteKit, Remix, Parcel.' };

  // Sprawdź czy npm jest dostępny
  const npmPath = await findCommand('npm');
  if (!npmPath) {
    return {
      ok: false,
      framework: fw.name,
      error: 'Nie znaleziono `npm` w PATH. Zainstaluj Node.js z https://nodejs.org i zrestartuj aplikację.',
    };
  }

  // Jeśli brakuje node_modules – zainstaluj
  if (!(await hasNodeModules(rootPath))) {
    const install = await runNpmInstall(rootPath);
    if (!install.ok) {
      return { ok: false, framework: fw.name, error: install.error };
    }
  }

  const env = await getEnv();

  // Spawn BEZ shell:true – używamy absolutnej ścieżki do npm, bezpieczniej
  const proc = spawn(npmPath, fw.args, {
    cwd: rootPath,
    env,
    shell: false,
  });

  current = { process: proc, rootPath, url: null, framework: fw.name, output: [] };

  return new Promise((resolve) => {
    let resolved = false;

    let conflictHandled = false;

    const handleOutput = (data: Buffer) => {
      if (!current || current.process !== proc) return;
      const text = data.toString();
      current.output.push(text);
      if (current.output.length > 200) current.output = current.output.slice(-100);
      broadcast('devServer:log', text);

      // Strippujemy ANSI escape codes żeby regex działał poprawnie
      const clean = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

      // Wykryj konflikt: "Another next dev server is already running"
      // Next.js exituje – zabijamy konfliktujący proces (PID z logu) i restartujemy
      if (!conflictHandled && /Another.*already running/i.test(clean)) {
        conflictHandled = true;
        // PID szukamy w całym dotychczasowym output (może być w poprzednim chunk)
        const fullClean = current.output.join('').replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
        const pidMatch = fullClean.match(/PID:\s*(\d+)/);
        if (pidMatch) {
          const conflictPid = parseInt(pidMatch[1], 10);
          broadcast('devServer:log', `\n[AI IDE] Zabijam konfliktujący serwer (PID ${conflictPid}) i restartuję...\n`);
          try { process.kill(conflictPid, 'SIGTERM'); } catch {}
        }
        setTimeout(async () => {
          proc.kill('SIGTERM');
          if (current?.process === proc) current = null;
          await start(rootPath); // nowy start → broadcast devServer:ready z nowym URL
        }, 1500);
        return;
      }

      // Wykryj URL serwera (strip ANSI żeby nie złapać kolorowanego URL z error msg)
      if (!current.url) {
        const localMatch = clean.match(/Local:\s+(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/i)
                       || clean.match(/(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/);
        if (localMatch) {
          const url = localMatch[1].replace(/\/$/, '');
          current.url = url;
          broadcast('devServer:ready', { url, framework: fw.name });
          if (!resolved) { resolved = true; resolve({ ok: true, framework: fw.name, url }); }
        }
      }
    };

    proc.stdout?.on('data', handleOutput);
    proc.stderr?.on('data', handleOutput);

    proc.on('exit', (code, signal) => {
      if (current?.process === proc) current = null;
      broadcast('devServer:exit', { code, signal });
      if (!resolved) {
        resolved = true;
        let hint = '';
        if (code === 127) hint = ' Brak `npm` w PATH (otwórz przez Finder/Dock daje minimalny PATH – aplikacja stara się tym automatycznie zarządzić, ale możliwe że Node nie jest standardowo zainstalowany).';
        else if (code === 1) hint = ' Zwykle skrypt `dev` w package.json wywalił błąd. Sprawdź log powyżej.';
        resolve({ ok: false, framework: fw.name, error: `Proces zakończony kodem ${code}${signal ? ' (sygnał ' + signal + ')' : ''}.${hint}` });
      }
    });

    proc.on('error', (e) => {
      if (!resolved) {
        resolved = true;
        resolve({ ok: false, framework: fw.name, error: `Spawn error: ${e.message}` });
      }
    });

    // Timeout 180s (Next.js + tailwind + supabase potrafi się rozkręcać długo)
    setTimeout(() => {
      if (!resolved && current?.process === proc && !current.url) {
        resolved = true;
        resolve({ ok: false, framework: fw.name, error: 'Timeout 180s. URL localhost:NNNN nie pojawił się. Sprawdź log.' });
      }
    }, 180_000);
  });
}

export function registerDevServerHandlers(ipcMain: IpcMain) {
  ipcMain.handle('devServer:detect', async (_e, rootPath: string) => {
    const fw = await detectFramework(rootPath);
    if (!fw) return null;
    const installed = await hasNodeModules(rootPath);
    return { framework: fw.name, defaultPort: fw.defaultPort, installed };
  });
  ipcMain.handle('devServer:start', async (_e, rootPath: string) => start(rootPath));
  ipcMain.handle('devServer:stop', async () => stop());
  ipcMain.handle('devServer:status', async () => getStatus());
  ipcMain.handle('devServer:logs', async () => current?.output.slice(-50).join('') || '');

  // Diagnostyka – zwraca rzeczywisty PATH oraz lokalizację npm/node
  ipcMain.handle('devServer:diagnose', async () => {
    const realPath = await getUserShellPath();
    const npmLoc = await findCommand('npm');
    const nodeLoc = await findCommand('node');
    return { path: realPath, npm: npmLoc, node: nodeLoc };
  });
}
