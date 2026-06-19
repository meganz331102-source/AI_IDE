// Prosty wbudowany terminal. Każdy command idzie jako fresh spawn w shellu
// użytkownika (zsh/bash) z prawdziwym PATH (przez login shell -ilc).
// Brak interaktywności typu `vim` ale `npm`, `git`, `ls` itp. działają.

import { IpcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';

interface Session {
  proc: ChildProcess;
  cwd: string;
}

const sessions = new Map<string, Session>();
const runningCommands = new Map<string, ChildProcess>();

function broadcast(channel: string, payload: any) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, payload);
  }
}

export function registerTerminalHandlers(ipcMain: IpcMain) {
  // Uruchom polecenie i streamuj output. Każde polecenie ma swój sessionId.
  ipcMain.handle('terminal:run', async (_e, sessionId: string, cmd: string, cwd: string) => {
    // Zabij poprzednie polecenie tej sesji (jeśli jeszcze chodzi)
    const prev = runningCommands.get(sessionId);
    if (prev) { try { prev.kill('SIGTERM'); } catch {} }

    const shell = process.env.SHELL || '/bin/zsh';
    // -ilc: interactive login shell + -c command (dostaje PATH z .zshrc)
    const proc = spawn(shell, ['-ilc', cmd], { cwd, env: process.env });
    runningCommands.set(sessionId, proc);

    proc.stdout?.on('data', (d) => broadcast('terminal:output', { sessionId, data: d.toString(), kind: 'stdout' }));
    proc.stderr?.on('data', (d) => broadcast('terminal:output', { sessionId, data: d.toString(), kind: 'stderr' }));

    return new Promise((resolve) => {
      proc.on('exit', (code, signal) => {
        runningCommands.delete(sessionId);
        broadcast('terminal:exit', { sessionId, code, signal });
        resolve({ code, signal });
      });
      proc.on('error', (e) => {
        runningCommands.delete(sessionId);
        broadcast('terminal:output', { sessionId, data: `\nBłąd: ${e.message}\n`, kind: 'stderr' });
        resolve({ code: -1, signal: null });
      });
    });
  });

  ipcMain.handle('terminal:kill', async (_e, sessionId: string) => {
    const proc = runningCommands.get(sessionId);
    if (proc) {
      try { proc.kill('SIGTERM'); } catch {}
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 1500);
      runningCommands.delete(sessionId);
    }
  });

  ipcMain.handle('terminal:isRunning', async (_e, sessionId: string) => {
    return runningCommands.has(sessionId);
  });
}

export function killAllTerminals() {
  for (const proc of runningCommands.values()) {
    try { proc.kill('SIGKILL'); } catch {}
  }
  runningCommands.clear();
  sessions.clear();
}
