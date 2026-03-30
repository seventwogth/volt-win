export const MARKDOWN_EXTENSION = '.md';

const HIDDEN_DISPLAY_EXTENSIONS = [MARKDOWN_EXTENSION];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];

function hasExtension(name: string, extension: string): boolean {
  return name.toLowerCase().endsWith(extension);
}

export function isMarkdownName(name: string): boolean {
  return hasExtension(name, MARKDOWN_EXTENSION);
}

export function isMarkdownPath(path: string): boolean {
  return isMarkdownName(path);
}

export function isImagePath(path: string): boolean {
  const lower = path.toLowerCase();
  return IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function getHiddenDisplayExtension(name: string): string | null {
  return HIDDEN_DISPLAY_EXTENSIONS.find((extension) => hasExtension(name, extension)) ?? null;
}

export function stripHiddenDisplayExtension(name: string): string {
  const extension = getHiddenDisplayExtension(name);
  return extension ? name.slice(0, -extension.length) : name;
}

export function ensureExtension(name: string, extension: string): string {
  return hasExtension(name, extension) ? name : `${name}${extension}`;
}

export function getFileExtension(path: string): string | null {
  const normalized = path.split('/').pop() ?? path;
  const dotIndex = normalized.lastIndexOf('.');

  if (dotIndex <= 0 || dotIndex === normalized.length - 1) {
    return null;
  }

  return normalized.slice(dotIndex).toLowerCase();
}
