import apiClient from "@/lib/axios";
import type { HistoryRow } from "@/lib/activityDiff";

export interface ActivityHistory {
  transcriptId: number;
  videoTitle: string | null;
  localeName: string | null;
  approvalStatus: string | null;
  level1ProofreaderName: string | null;
  level2ProofreaderName: string | null;
  level1Length: number | null;
  level2Length: number | null;
  l1LastSavedAt: number | null;
  l1LastSavedByName: string | null;
  l2LastSavedAt: number | null;
  l2LastSavedByName: string | null;
  rowCount: number;
  rows: HistoryRow[];
}

/** Admin: every history row of a transcript (without the heavy payloads). */
export const getActivityHistory = async (transcriptId: number): Promise<ActivityHistory> => {
  const res = await apiClient.get<ActivityHistory>(`/api/transcripts/${transcriptId}/activity`);
  return res.data;
};

/** Admin: all rows of one session with payloads, to rebuild it. */
export const getActivitySession = async (transcriptId: number, sessionId: string): Promise<HistoryRow[]> => {
  const res = await apiClient.get<HistoryRow[]>(`/api/transcripts/${transcriptId}/activity/session`, {
    params: { sessionId },
  });
  return res.data;
};

/** Admin: put a rebuilt version back into the L1 or L2 draft (the current draft is kept in the history first). */
export const restoreFromActivity = async (
  transcriptId: number,
  body: { level: 1 | 2; srtContent: string; sourceEventId: number; sourceSessionId: string; sourceSeq: number | null; sourceLabel: string }
): Promise<void> => {
  await apiClient.put(`/api/transcripts/${transcriptId}/activity/restore`, body);
};
