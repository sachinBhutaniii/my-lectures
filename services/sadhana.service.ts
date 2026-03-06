import apiClient from "@/lib/axios";

export interface SadhanaOption {
  value: string;
  label: string;
  points: number;
}

export interface SadhanaQuestion {
  id: number;
  slug: string;
  title: string;
  description?: string;
  category?: string;
  displayOrder: number;
  active: boolean;
  hidden: boolean;
  options: SadhanaOption[];
}

export interface SadhanaEntryResponse {
  id: number;
  entryDate: string;
  totalScore: number;
  maxScore: number;
  answers: Record<string, string>;
  submittedAt: string;
}

export const getSadhanaQuestions = async (): Promise<SadhanaQuestion[]> => {
  const res = await apiClient.get<SadhanaQuestion[]>("/api/sadhana/questions");
  return res.data;
};

export const getTodayEntry = async (): Promise<SadhanaEntryResponse | null> => {
  try {
    const res = await apiClient.get<SadhanaEntryResponse>("/api/sadhana/entries/today");
    return res.data;
  } catch (e: any) {
    if (e?.response?.status === 204 || e?.response?.status === 404) return null;
    throw e;
  }
};

export const getMyEntries = async (): Promise<SadhanaEntryResponse[]> => {
  const res = await apiClient.get<SadhanaEntryResponse[]>("/api/sadhana/entries");
  return res.data;
};

export const submitSadhanaEntry = async (
  date: string,
  answers: Record<string, string>
): Promise<SadhanaEntryResponse> => {
  const res = await apiClient.post<SadhanaEntryResponse>("/api/sadhana/entries", { date, answers });
  return res.data;
};

// ── Mentor linking ─────────────────────────────────────────────────────────

export interface MentorUser {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
}

export const getMyMentors = async (): Promise<MentorUser[]> => {
  const res = await apiClient.get<MentorUser[]>("/api/sadhana/mentors");
  return res.data;
};

export const linkMentor = async (mentorUserId: number): Promise<void> => {
  await apiClient.post("/api/sadhana/mentors", { mentorUserId });
};

export const unlinkMentor = async (mentorUserId: number): Promise<void> => {
  await apiClient.delete(`/api/sadhana/mentors/${mentorUserId}`);
};

export const getMyMentees = async (): Promise<MentorUser[]> => {
  const res = await apiClient.get<MentorUser[]>("/api/sadhana/mentees");
  return res.data;
};

export const getMenteeEntries = async (userId: number): Promise<SadhanaEntryResponse[]> => {
  const res = await apiClient.get<SadhanaEntryResponse[]>(`/api/sadhana/mentees/${userId}/entries`);
  return res.data;
};

// ── Entry Reactions ────────────────────────────────────────────────────────

export interface EntryReaction {
  id: number;
  mentorId: number;
  mentorName: string;
  reaction?: string;
  message?: string;
  createdAt: string;
}

export const getAbsentMentees = async (date: string): Promise<MentorUser[]> => {
  const res = await apiClient.get<MentorUser[]>(`/api/sadhana/mentees/absent?date=${date}`);
  return res.data;
};

export const postEntryReaction = async (
  userId: number,
  entryId: number,
  data: { reaction?: string; message?: string }
): Promise<EntryReaction> => {
  const res = await apiClient.post<EntryReaction>(
    `/api/sadhana/mentees/${userId}/entries/${entryId}/react`,
    data
  );
  return res.data;
};

export const deleteEntryReaction = async (userId: number, entryId: number): Promise<void> => {
  await apiClient.delete(`/api/sadhana/mentees/${userId}/entries/${entryId}/react`);
};

export const getEntryReactions = async (entryId: number): Promise<EntryReaction[]> => {
  const res = await apiClient.get<EntryReaction[]>(`/api/sadhana/entries/${entryId}/reactions`);
  return res.data;
};

// ── Q&A ────────────────────────────────────────────────────────────────────

export interface SadhanaQA {
  id: number;
  menteeId: number;
  menteeName: string;
  mentorId: number;
  mentorName: string;
  question: string;
  answer?: string;
  askedAt: string;
  answeredAt?: string;
  questionAudioUrl?: string;
  answerAudioUrl?: string;
}

export const uploadQAAudio = async (blob: Blob): Promise<string> => {
  // Use fetch directly — apiClient has a default "Content-Type: application/json" header
  // that overwrites the multipart/form-data boundary axios would set for FormData.
  const token = typeof window !== "undefined" ? localStorage.getItem("bdd_auth_token") : null;
  const form = new FormData();
  form.append("file", blob, "voice.webm");
  const res = await fetch(
    "https://bddsm-production.up.railway.app/api/sadhana/qa/audio",
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    },
  );
  if (!res.ok) throw new Error(`Audio upload failed: ${res.status}`);
  const data = await res.json();
  return data.url;
};

export const askMentorQuestion = async (
  mentorId: number,
  question: string,
  questionAudioUrl?: string,
): Promise<SadhanaQA> => {
  const res = await apiClient.post<SadhanaQA>("/api/sadhana/qa", { mentorId, question, questionAudioUrl });
  return res.data;
};

export const getMentorQA = async (mentorId: number): Promise<SadhanaQA[]> => {
  const res = await apiClient.get<SadhanaQA[]>(`/api/sadhana/qa/${mentorId}`);
  return res.data;
};

export const getMenteeQA = async (menteeId: number): Promise<SadhanaQA[]> => {
  const res = await apiClient.get<SadhanaQA[]>(`/api/sadhana/mentees/${menteeId}/qa`);
  return res.data;
};

export const answerQuestion = async (
  qaId: number,
  answer: string,
  answerAudioUrl?: string,
): Promise<SadhanaQA> => {
  const res = await apiClient.put<SadhanaQA>(`/api/sadhana/qa/${qaId}/answer`, { answer, answerAudioUrl });
  return res.data;
};

// ── Notifications ───────────────────────────────────────────────────────────

export interface SadhanaNotifications {
  pendingQuestions: number; // for mentor: unseen incoming questions
  newAnswers: number;       // for mentee: answers not yet seen
}

export const getNotifications = async (): Promise<SadhanaNotifications> => {
  const res = await apiClient.get<SadhanaNotifications>("/api/sadhana/notifications");
  return res.data;
};

// ── Admin ──────────────────────────────────────────────────────────────────

export const adminGetQuestions = async (): Promise<SadhanaQuestion[]> => {
  const res = await apiClient.get<SadhanaQuestion[]>("/api/sadhana/admin/questions");
  return res.data;
};

export const adminCreateQuestion = async (q: Omit<SadhanaQuestion, "id">): Promise<SadhanaQuestion> => {
  const res = await apiClient.post<SadhanaQuestion>("/api/sadhana/admin/questions", q);
  return res.data;
};

export const adminUpdateQuestion = async (id: number, q: Partial<SadhanaQuestion>): Promise<SadhanaQuestion> => {
  const res = await apiClient.put<SadhanaQuestion>(`/api/sadhana/admin/questions/${id}`, q);
  return res.data;
};

export const adminDeleteQuestion = async (id: number): Promise<void> => {
  await apiClient.delete(`/api/sadhana/admin/questions/${id}`);
};

export const adminReorderQuestions = async (items: { id: number; displayOrder: number }[]): Promise<void> => {
  await apiClient.put("/api/sadhana/admin/questions/reorder", items);
};
