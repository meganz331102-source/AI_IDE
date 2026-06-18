import type { ProposedChange } from '../../../shared/types';

// Bardzo prosty parser bloków kodu w formacie:
// ```lang:path/to/file.ts
// ...treść...
// ```
// AI musi być poinstruowane (przez system prompt) by używać tego formatu,
// aby aplikacja mogła automatycznie wykryć proponowane zmiany.

const CODE_BLOCK_REGEX = /```[\w]*:([^\n]+)\n([\s\S]*?)```/g;

export function parseProposedChanges(
  responseText: string,
  originalContents: Map<string, string>
): ProposedChange[] {
  const changes: ProposedChange[] = [];
  let match: RegExpExecArray | null;

  while ((match = CODE_BLOCK_REGEX.exec(responseText)) !== null) {
    const filePath = match[1].trim();
    const newContent = match[2];
    const originalContent = originalContents.get(filePath) ?? null;

    changes.push({
      id: crypto.randomUUID(),
      filePath,
      type: originalContent === null ? 'create' : 'modify',
      originalContent,
      newContent,
      status: 'pending',
    });
  }

  return changes;
}

export function buildSystemPromptInstructions(): string {
  return [
    'Gdy proponujesz zmiany w kodzie, ZAWSZE używaj formatu:',
    '```język:ścieżka/do/pliku.ext',
    '(pełna nowa treść pliku)',
    '```',
    'Nigdy nie zapisuj plików samodzielnie – użytkownik zaakceptuje zmiany w interfejsie.',
  ].join('\n');
}
