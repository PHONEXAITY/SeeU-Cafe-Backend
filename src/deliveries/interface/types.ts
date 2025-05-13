export interface LocationHistoryEntry {
  latitude: number;
  longitude: number;
  timestamp: Date | null;
  note?: string;
  current?: boolean;
}
