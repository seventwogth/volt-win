const WAILS_READY_TIMEOUT_MS = 15000;
const WAILS_READY_POLL_MS = 25;

declare global {
  interface Window {
    go?: {
      wailshandler?: Record<string, unknown>;
    };
  }
}

let pendingWailsReady: Promise<void> | null = null;

function hasWailsBridge(): boolean {
  return typeof window !== 'undefined' && Boolean(window.go?.wailshandler);
}

export async function waitForWailsBridge(timeoutMs = WAILS_READY_TIMEOUT_MS): Promise<void> {
  if (hasWailsBridge()) {
    return;
  }

  if (pendingWailsReady == null) {
    pendingWailsReady = new Promise<void>((resolve, reject) => {
      const startedAt = Date.now();

      const check = () => {
        if (hasWailsBridge()) {
          pendingWailsReady = null;
          resolve();
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          pendingWailsReady = null;
          reject(new Error('Wails runtime is not ready yet'));
          return;
        }

        window.setTimeout(check, WAILS_READY_POLL_MS);
      };

      check();
    });
  }

  return pendingWailsReady;
}

export async function invokeWails<TModule, TResult>(
  loadModule: () => Promise<TModule>,
  invoke: (module: TModule) => TResult | Promise<TResult>,
): Promise<TResult> {
  await waitForWailsBridge();
  const module = await loadModule();
  return invoke(module);
}
