export type LiveEvent = {
  id: string; type: 'gift' | 'chat' | 'follow' | 'like' | 'share'; username: string;
  giftName?: string; diamonds?: number; comment?: string; createdAt: number;
  message?: string; duration?: number;
};
// In-memory store is intended only for local development/demo. Replace with Supabase Realtime/Redis before production.
type Store = { events: LiveEvent[]; lastId: number };
const g = globalThis as typeof globalThis & { __gptLiveStore?: Store };
const store = g.__gptLiveStore ?? (g.__gptLiveStore = { events: [], lastId: 0 });
export function addEvent(input: Omit<LiveEvent, 'id' | 'createdAt'>) {
  const event: LiveEvent = { ...input, id: String(++store.lastId), createdAt: Date.now() };
  store.events.push(event); if (store.events.length > 50) store.events.splice(0, store.events.length - 50);
  return event;
}
export function listEvents(after = 0) { return store.events.filter(e => Number(e.id) > after); }
export function getLatestEvent() { return store.events.at(-1) ?? null; }
