export interface LocationHistoryEntry {
  latitude: number;
  longitude: number;
  timestamp: Date | string | null;
  note?: string;
  current?: boolean;
}
