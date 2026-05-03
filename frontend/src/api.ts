async function invoke<T = unknown>(command: string, input: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`api/${command}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `${command} failed (${res.status})`);
  return text ? JSON.parse(text) as T : undefined as T;
}

// --- Types ---

export interface Deck {
  id: string;
  name: string;
  description: string;
  tags: string[];
  created_at: number;
  updated_at: number;
}

export interface KPIndex {
  id: string;
  deck_id: string;
  title: string;
  mastery: number;
  depends_on: string[];
  flashcard_count: number;
  question_count: number;
  due_count: number;
}

export interface KPDetail {
  id: string;
  deck_id: string;
  title: string;
  body: string;
  mastery: number;
  source: string | null;
  depends_on: string[];
  flashcards: Array<{ id: string; front: string; back: string; due: string }>;
  questions: Array<{ id: string; type: string; prompt: string; answer: string; due: string }>;
}

export interface Flashcard {
  id: string;
  kp_id: string;
  front: string;
  back: string;
  interval: number;
  ease: number;
  repetitions: number;
  due_at: number;
}

export interface Question {
  id: string;
  kp_id: string;
  type: string;
  prompt: string;
  answer: string;
  interval: number;
  ease: number;
  repetitions: number;
  due_at: number;
}

export interface DueItem {
  id: string;
  type: "flashcard" | "question";
  kp_id: string;
  kp_title: string;
  front?: string;
  back?: string;
  prompt?: string;
  answer?: string;
  question_type?: string;
  interval: number;
  repetitions: number;
}

export interface DueResult {
  items: DueItem[];
  summary: { flashcard_count: number; question_count: number };
}

export interface RecordResult {
  id: string;
  type: string;
  rating: number;
  next_due: string;
  new_interval: number;
  mastery_change: { kp_id: string; old: number; new: number } | null;
}

export interface Stats {
  deck: string | null;
  total_kp: number;
  mastery_distribution: Record<string, number>;
  due_today: number;
  weakest_kps: Array<{ id: string; title: string; mastery: number; depends_on_met: boolean }>;
}

// --- API ---

export const createDeck = (name: string, description = "", tags = ""): Promise<Deck> =>
  invoke("create", { type: "deck", name, description, tags });

export const createKP = (deck: string, title: string, body = "", depends_on = "", source = ""): Promise<KPDetail> =>
  invoke("create", { type: "kp", deck, title, body, depends_on, source });

export const createFlashcard = (kp: string, front: string, back: string): Promise<Flashcard> =>
  invoke("create", { type: "flashcard", kp, front, back });

export const createQuestion = (kp: string, prompt: string, answer: string, question_type = "recall"): Promise<Question> =>
  invoke("create", { type: "question", kp, prompt, answer, question_type });

export const get = <T = unknown>(id: string): Promise<T> =>
  invoke("get", { id });

export const findDecks = (): Promise<Deck[]> =>
  invoke("find", { type: "deck" });

export const findKPs = (deck?: string, query?: string): Promise<KPIndex[]> =>
  invoke("find", { type: "kp", ...(deck ? { deck } : {}), ...(query ? { query } : {}) });

export const update = <T = unknown>(id: string, fields: Record<string, unknown>): Promise<T> =>
  invoke("update", { id, ...fields });

export const del = <T = unknown>(id: string): Promise<T> =>
  invoke("delete", { id });

export const getDue = (deck?: string, type?: string, limit?: number): Promise<DueResult> =>
  invoke("due", { ...(deck ? { deck } : {}), ...(type ? { type } : {}), ...(limit ? { limit } : {}) });

export const record = (id: string, rating: number, time_spent?: number): Promise<RecordResult> =>
  invoke("record", { id, rating, ...(time_spent ? { time_spent } : {}) });

export const getStats = (deck?: string): Promise<Stats> =>
  invoke("stats", { ...(deck ? { deck } : {}) });
