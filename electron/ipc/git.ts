import { IpcMain } from 'electron';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { getGitHubToken } from './keychain';

function git(repoPath: string): SimpleGit {
  return simpleGit(repoPath);
}

export function registerGitHandlers(ipcMain: IpcMain) {
  ipcMain.handle('git:status', async (_event, repoPath: string) => {
    const status = await git(repoPath).status();
    return {
      current: status.current,
      modified: status.modified,
      created: status.created,
      deleted: status.deleted,
      notAdded: status.not_added,
      ahead: status.ahead,
      behind: status.behind,
    };
  });

  ipcMain.handle('git:commit', async (_event, repoPath: string, message: string) => {
    const g = git(repoPath);
    await g.add('.');
    const result = await g.commit(message);
    return { commitHash: result.commit };
  });

  ipcMain.handle('git:createBranch', async (_event, repoPath: string, branchName: string) => {
    await git(repoPath).checkoutLocalBranch(branchName);
  });

  ipcMain.handle(
    'git:createPullRequest',
    async (
      _event,
      owner: string,
      repo: string,
      head: string,
      base: string,
      title: string,
      body: string
    ) => {
      const token = await getGitHubToken();
      if (!token) {
        throw new Error('Brak GitHub Personal Access Token. Skonfiguruj go w Ustawieniach.');
      }

      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, head, base, body }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`GitHub API error (${response.status}): ${errorBody}`);
      }

      const data = await response.json();
      return { url: data.html_url, number: data.number };
    }
  );

  // Lista repozytoriów użytkownika (po zalogowaniu tokenem)
  ipcMain.handle('git:listRepos', async () => {
    const token = await getGitHubToken();
    if (!token) throw new Error('Brak tokenu GitHub.');
    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const repos = (await res.json()) as Array<{
      full_name: string; html_url: string; private: boolean; description: string | null;
      clone_url: string; updated_at: string;
    }>;
    return repos.map((r) => ({
      fullName: r.full_name,
      htmlUrl: r.html_url,
      cloneUrl: r.clone_url,
      isPrivate: r.private,
      description: r.description,
      updatedAt: r.updated_at,
    }));
  });

  // Pobierz info o aktualnie zalogowanym użytkowniku
  ipcMain.handle('git:getUser', async () => {
    const token = await getGitHubToken();
    if (!token) return null;
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const u = (await res.json()) as { login: string; avatar_url: string; name: string | null };
    return { login: u.login, avatarUrl: u.avatar_url, name: u.name };
  });

  // Klonuj repo z GitHub do ~/AI_IDE_Projects/<repo-name>, zwróć ścieżkę.
  // Bez dialogu – wszystkie repo lądują w jednym, znanym folderze.
  ipcMain.handle('git:cloneRepo', async (_e, cloneUrl: string) => {
    const os = await import('os');
    const fs = await import('fs/promises');

    const projectsDir = path.join(os.homedir(), 'AI_IDE_Projects');
    await fs.mkdir(projectsDir, { recursive: true });

    const repoName = (cloneUrl.split('/').pop() || 'repo').replace(/\.git$/, '');
    const target = path.join(projectsDir, repoName);

    // Jeśli folder już istnieje – po prostu zwróć go (nie klonuj ponownie)
    try {
      const stat = await fs.stat(target);
      if (stat.isDirectory()) return { localPath: target, alreadyExisted: true };
    } catch { /* nie istnieje */ }

    const token = await getGitHubToken();
    const authedUrl = token && cloneUrl.startsWith('https://github.com/')
      ? cloneUrl.replace('https://github.com/', `https://x-access-token:${token}@github.com/`)
      : cloneUrl;

    await simpleGit().clone(authedUrl, target);
    return { localPath: target, alreadyExisted: false };
  });
}
