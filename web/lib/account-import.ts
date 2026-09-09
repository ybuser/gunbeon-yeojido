import {
  cleanTravelState,
  cleanEntry,
  type TravelState,
} from './account-state.ts';
import { entryKey } from './domain.ts';
/** Existing server records win conflicts; device variants become stable, retryable copies. */
export function mergeDeviceTravel(
  server: TravelState | null,
  device: TravelState,
): TravelState {
  const existing = server || {
    version: 3 as const,
    entries: [],
    favorites: [],
    activeOuting: null,
  };
  const entries = [...existing.entries],
    recordIds = new Map<string, string>();
  for (const entry of device.entries) {
    const key = entryKey(entry),
      found = entries.find((x) => entryKey(x) === key);
    if (!found) entries.push(entry);
    else if (
      JSON.stringify(cleanEntry(found)) !== JSON.stringify(cleanEntry(entry))
    ) {
      const base = 'import:' + key.slice(0, 130);
      let id = base,
        counter = 1;
      while (
        entries.some(
          (x) =>
            entryKey(x) === id &&
            JSON.stringify(cleanEntry({ ...x, recordId: entry.recordId })) !==
              JSON.stringify(cleanEntry(entry)),
        )
      )
        id = base + ':' + counter++;
      if (!entries.some((x) => entryKey(x) === id))
        entries.push({ ...entry, recordId: id });
      recordIds.set(key, id);
    }
  }
  const importedOuting = device.activeOuting
    ? {
        ...device.activeOuting,
        entry: recordIds.has(entryKey(device.activeOuting.entry))
          ? {
              ...device.activeOuting.entry,
              recordId: recordIds.get(entryKey(device.activeOuting.entry))!,
            }
          : device.activeOuting.entry,
      }
    : null;
  return cleanTravelState({
    ...existing,
    entries,
    favorites: [
      ...new Map(
        [...device.favorites, ...existing.favorites].map((p) => [p.id, p]),
      ).values(),
    ],
    activeOuting: existing.activeOuting || importedOuting,
    planning: existing.planning || device.planning,
  });
}
