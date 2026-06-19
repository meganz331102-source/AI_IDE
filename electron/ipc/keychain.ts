import { IpcMain } from 'electron';
import keytar from 'keytar';

const SERVICE_NAME = 'AI-IDE';
const ACCOUNT_NAME = 'github-pat';

export async function getGitHubToken(): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
}

export function registerKeychainHandlers(ipcMain: IpcMain) {
  ipcMain.handle('keychain:setGitHubToken', async (_event, token: string) => {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
  });

  ipcMain.handle('keychain:hasGitHubToken', async () => {
    const token = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    return token !== null;
  });

  ipcMain.handle('keychain:clearGitHubToken', async () => {
    await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
  });
}
