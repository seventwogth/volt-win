import type { PluginEventMap } from './pluginApi';

type EventName = keyof PluginEventMap;
type Callback<TEvent extends EventName = EventName> = (payload: PluginEventMap[TEvent]) => void;

const listeners = new Map<EventName, Set<Callback>>();
const pluginUnsubscribes = new Map<string, Set<() => void>>();

export function emit<TEvent extends EventName>(event: TEvent, payload: PluginEventMap[TEvent]): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const cb of set) {
    try {
      cb(payload);
    } catch (e) {
      console.error(`[pluginEventBus] Error in handler for "${event}":`, e);
    }
  }
}

export function on<TEvent extends EventName>(event: TEvent, callback: Callback<TEvent>): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(callback as Callback);
  return () => {
    set!.delete(callback as Callback);
    if (set!.size === 0) {
      listeners.delete(event);
    }
  };
}

export function onTracked<TEvent extends EventName>(
  pluginId: string,
  event: TEvent,
  callback: Callback<TEvent>,
): () => void {
  const unsubscribe = on(event, callback);
  let set = pluginUnsubscribes.get(pluginId);
  if (!set) {
    set = new Set();
    pluginUnsubscribes.set(pluginId, set);
  }
  set.add(unsubscribe);

  return () => {
    unsubscribe();
    const trackedSet = pluginUnsubscribes.get(pluginId);
    trackedSet?.delete(unsubscribe);
    if (trackedSet && trackedSet.size === 0) {
      pluginUnsubscribes.delete(pluginId);
    }
  };
}

export function clearPluginListeners(pluginId: string): void {
  const unsubscribes = pluginUnsubscribes.get(pluginId);
  if (!unsubscribes) {
    return;
  }

  for (const unsubscribe of unsubscribes) {
    try {
      unsubscribe();
    } catch (err) {
      console.error(`[pluginEventBus] Failed to clear listeners for "${pluginId}":`, err);
    }
  }

  pluginUnsubscribes.delete(pluginId);
}

export function clearAllListeners(): void {
  listeners.clear();
  pluginUnsubscribes.clear();
}
