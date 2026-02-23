import apiClient from "@/lib/axios";

export interface Course {
  id: number;
  title: string;
  description: string;
  coverImageUrl: string;
  displayOrder: number;
  published: boolean;
  sectionCount: number;
}

export interface CourseSection {
  id: number;
  courseId: number;
  title: string;
  displayOrder: number;
  questionCount: number;
}

export interface CourseWithSections {
  course: Course;
  sections: CourseSection[];
}

export interface QuestionOption {
  key: string;
  text: string;
}

export interface QuestionDto {
  id?: number;
  sectionId?: number;
  displayOrder: number;
  questionText: string;
  type: "MCQ" | "TRUE_FALSE" | "ASSERTION_REASONING";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  source?: string;
  optionsJson?: string;
  correctAnswer?: string;
  assertionText?: string;
  reasonText?: string;
}

export function parseOptions(optionsJson?: string): QuestionOption[] {
  if (!optionsJson) return [];
  try {
    return JSON.parse(optionsJson);
  } catch {
    return [];
  }
}

const BASE = "/api/courses";

export const getCourses = async (): Promise<Course[]> => {
  const res = await apiClient.get<Course[]>(BASE);
  return res.data;
};

export const getCourse = async (id: number): Promise<CourseWithSections> => {
  const res = await apiClient.get<CourseWithSections>(`${BASE}/${id}`);
  return res.data;
};

export const createCourse = async (data: Omit<Course, "id" | "sectionCount">): Promise<Course> => {
  const res = await apiClient.post<Course>(BASE, data);
  return res.data;
};

export const updateCourse = async (id: number, data: Omit<Course, "id" | "sectionCount">): Promise<Course> => {
  const res = await apiClient.put<Course>(`${BASE}/${id}`, data);
  return res.data;
};

export const deleteCourse = async (id: number): Promise<void> => {
  await apiClient.delete(`${BASE}/${id}`);
};

export const addSection = async (courseId: number, title: string, displayOrder = 0): Promise<CourseSection> => {
  const res = await apiClient.post<CourseSection>(`${BASE}/${courseId}/sections`, { title, displayOrder });
  return res.data;
};

export const updateSection = async (sectionId: number, title: string, displayOrder = 0): Promise<CourseSection> => {
  const res = await apiClient.put<CourseSection>(`${BASE}/sections/${sectionId}`, { title, displayOrder });
  return res.data;
};

export const deleteSection = async (sectionId: number): Promise<void> => {
  await apiClient.delete(`${BASE}/sections/${sectionId}`);
};

export const parseQuestions = async (sectionId: number, rawText: string): Promise<QuestionDto[]> => {
  const res = await apiClient.post<QuestionDto[]>(`${BASE}/sections/${sectionId}/questions/parse`, { rawText });
  return res.data;
};

export const saveQuestions = async (sectionId: number, questions: QuestionDto[]): Promise<void> => {
  await apiClient.post(`${BASE}/sections/${sectionId}/questions/save`, { questions });
};

export const getSectionQuestions = async (sectionId: number): Promise<QuestionDto[]> => {
  const res = await apiClient.get<QuestionDto[]>(`${BASE}/sections/${sectionId}/questions`);
  return res.data;
};

export const deleteQuestion = async (id: number): Promise<void> => {
  await apiClient.delete(`${BASE}/questions/${id}`);
};
