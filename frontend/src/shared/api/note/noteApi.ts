import { invokeWailsSafe } from '@shared/api/wailsWithError';

const loadNoteHandler = () => import('../../../../wailsjs/go/wailshandler/NoteHandler');

export async function createNote(voltPath: string, filePath: string): Promise<void> {
  return invokeWailsSafe(loadNoteHandler, (mod) => mod.CreateNote(voltPath, filePath), 'createNote');
}
