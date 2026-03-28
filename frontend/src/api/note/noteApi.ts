import type { FileEntry } from './types';
import { invokeWails } from '@api/wails';

const loadNoteHandler = () => import('../../../wailsjs/go/wailshandler/NoteHandler');

export async function readNote(voltPath: string, filePath: string): Promise<string> {
  return invokeWails(loadNoteHandler, (mod) => mod.ReadNote(voltPath, filePath));
}

export async function saveNote(voltPath: string, filePath: string, content: string): Promise<void> {
  return invokeWails(loadNoteHandler, (mod) => mod.SaveNote(voltPath, filePath, content));
}

export async function listTree(voltPath: string, dirPath: string = ''): Promise<FileEntry[]> {
  return invokeWails(loadNoteHandler, (mod) => mod.ListTree(voltPath, dirPath));
}

export async function createNote(voltPath: string, filePath: string): Promise<void> {
  return invokeWails(loadNoteHandler, (mod) => mod.CreateNote(voltPath, filePath));
}

export async function createDirectory(voltPath: string, dirPath: string): Promise<void> {
  return invokeWails(loadNoteHandler, (mod) => mod.CreateDirectory(voltPath, dirPath));
}

export async function deleteNote(voltPath: string, filePath: string): Promise<void> {
  return invokeWails(loadNoteHandler, (mod) => mod.DeleteNote(voltPath, filePath));
}

export async function renameNote(voltPath: string, oldPath: string, newPath: string): Promise<void> {
  return invokeWails(loadNoteHandler, (mod) => mod.RenameNote(voltPath, oldPath, newPath));
}
