import { invokeWailsSafe } from '@shared/api/wailsWithError';
import { normalizeWorkspacePath } from '@shared/lib/workspacePath';

const loadImageHandler = () => import('../../../../wailsjs/go/wailshandler/ImageHandler');

export async function copyImage(voltPath: string, sourcePath: string, imageDir: string): Promise<string> {
  const relativePath = await invokeWailsSafe(
    loadImageHandler,
    (mod) => mod.CopyImage(voltPath, sourcePath, normalizeWorkspacePath(imageDir)),
    'copyImage',
  );
  return normalizeWorkspacePath(relativePath);
}

export async function saveImageBase64(voltPath: string, fileName: string, imageDir: string, base64Data: string): Promise<string> {
  const relativePath = await invokeWailsSafe(
    loadImageHandler,
    (mod) => mod.SaveImageBase64(voltPath, fileName, normalizeWorkspacePath(imageDir), base64Data),
    'saveImageBase64',
  );
  return normalizeWorkspacePath(relativePath);
}

export async function pickImage(): Promise<string> {
  return invokeWailsSafe(loadImageHandler, (mod) => mod.PickImage(), 'pickImage');
}

export async function readImageBase64(voltPath: string, relPath: string): Promise<string> {
  return invokeWailsSafe(loadImageHandler, (mod) => mod.ReadImageBase64(voltPath, normalizeWorkspacePath(relPath)), 'readImageBase64');
}

export function dataUrlToBlobUrl(dataUrl: string): string {
  const [header, b64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export function base64ToBlobUrl(b64: string, mimeType: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}
