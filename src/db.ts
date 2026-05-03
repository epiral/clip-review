import { readFileSync } from "node:fs";
import { Database } from "bun:sqlite";
import { dbPath, ensureDataDir, schemaPath } from "./paths";
import { nextSRS, type SRSState } from "./srs";

let dbInstance: Database | null = null;

function randomID(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = prefix;
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

function transaction<T>(db: Database, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }
}

export function openDB(): Database {
  if (dbInstance) return dbInstance;
  ensureDataDir();
  const db = new Database(dbPath(), { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(readFileSync(schemaPath(), "utf8"));
  dbInstance = db;
  return db;
}

// --- Decks ---

export interface Deck {
  id: string;
  name: string;
  description: string;
  tags: string[];
  created_at: number;
  updated_at: number;
}

type DeckRow = { id: string; name: string; description: string; tags: string; created_at: number; updated_at: number };

function toDeck(row: DeckRow): Deck {
  return { ...row, tags: JSON.parse(row.tags) as string[] };
}

export function createDeck(db: Database, name: string, description = "", tags: string[] = []): Deck {
  const now = nowUnix();
  const deck: Deck = { id: randomID("dk_"), name, description, tags, created_at: now, updated_at: now };
  db.query("INSERT INTO decks (id, name, description, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(deck.id, deck.name, deck.description, JSON.stringify(deck.tags), deck.created_at, deck.updated_at);
  return deck;
}

export function getDeck(db: Database, id: string): Deck {
  const row = db.query<DeckRow, [string]>("SELECT * FROM decks WHERE id = ?").get(id);
  if (!row) throw new Error(`deck ${id} not found`);
  return toDeck(row);
}

export function findDecks(db: Database): Deck[] {
  return db.query<DeckRow, []>("SELECT * FROM decks ORDER BY created_at DESC").all().map(toDeck);
}

export function updateDeck(db: Database, id: string, updates: { name?: string; description?: string; tags?: string[] }): Deck {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (updates.name !== undefined) { sets.push("name = ?"); values.push(updates.name); }
  if (updates.description !== undefined) { sets.push("description = ?"); values.push(updates.description); }
  if (updates.tags !== undefined) { sets.push("tags = ?"); values.push(JSON.stringify(updates.tags)); }
  if (sets.length === 0) return getDeck(db, id);
  sets.push("updated_at = ?"); values.push(nowUnix()); values.push(id);
  const result = db.query(`UPDATE decks SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  if (!result.changes) throw new Error(`deck ${id} not found`);
  return getDeck(db, id);
}

export function deleteDeck(db: Database, id: string): Deck {
  const deck = getDeck(db, id);
  transaction(db, () => {
    const kpIds = db.query<{ id: string }, [string]>("SELECT id FROM knowledge_points WHERE deck_id = ?").all(id);
    for (const { id: kpId } of kpIds) {
      db.run("DELETE FROM review_logs WHERE item_id IN (SELECT id FROM flashcards WHERE kp_id = ?)", [kpId]);
      db.run("DELETE FROM review_logs WHERE item_id IN (SELECT id FROM questions WHERE kp_id = ?)", [kpId]);
      db.run("DELETE FROM flashcards WHERE kp_id = ?", [kpId]);
      db.run("DELETE FROM questions WHERE kp_id = ?", [kpId]);
      db.run("DELETE FROM kp_dependencies WHERE kp_id = ? OR depends_on_id = ?", [kpId, kpId]);
    }
    db.run("DELETE FROM knowledge_points WHERE deck_id = ?", [id]);
    db.run("DELETE FROM decks WHERE id = ?", [id]);
  });
  return deck;
}

// --- Knowledge Points ---

export interface KnowledgePoint {
  id: string;
  deck_id: string;
  title: string;
  body: string;
  mastery: number;
  source: string | null;
  depends_on: string[];
  created_at: number;
  updated_at: number;
}

type KPRow = { id: string; deck_id: string; title: string; body: string; mastery: number; source: string | null; created_at: number; updated_at: number };

function getKPDeps(db: Database, kpId: string): string[] {
  return db.query<{ depends_on_id: string }, [string]>(
    "SELECT depends_on_id FROM kp_dependencies WHERE kp_id = ?",
  ).all(kpId).map((r) => r.depends_on_id);
}

function toKP(db: Database, row: KPRow): KnowledgePoint {
  return { ...row, depends_on: getKPDeps(db, row.id) };
}

export function createKP(db: Database, deckId: string, title: string, body = "", dependsOn: string[] = [], source?: string): KnowledgePoint {
  getDeck(db, deckId);
  const now = nowUnix();
  const id = randomID("kp_");
  transaction(db, () => {
    db.query("INSERT INTO knowledge_points (id, deck_id, title, body, mastery, source, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)")
      .run(id, deckId, title, body, source ?? null, now, now);
    for (const depId of dependsOn) {
      db.query("INSERT INTO kp_dependencies (kp_id, depends_on_id) VALUES (?, ?)").run(id, depId);
    }
  });
  return getKP(db, id);
}

export function getKP(db: Database, id: string): KnowledgePoint {
  const row = db.query<KPRow, [string]>("SELECT * FROM knowledge_points WHERE id = ?").get(id);
  if (!row) throw new Error(`knowledge_point ${id} not found`);
  return toKP(db, row);
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

export function findKPs(db: Database, deckId?: string, query?: string): KPIndex[] {
  let sql = `
    SELECT kp.id, kp.deck_id, kp.title, kp.mastery,
      (SELECT COUNT(*) FROM flashcards WHERE kp_id = kp.id) AS flashcard_count,
      (SELECT COUNT(*) FROM questions WHERE kp_id = kp.id) AS question_count,
      (SELECT COUNT(*) FROM flashcards WHERE kp_id = kp.id AND due_at <= ?) +
      (SELECT COUNT(*) FROM questions WHERE kp_id = kp.id AND due_at <= ?) AS due_count
    FROM knowledge_points kp WHERE 1=1`;
  const params: (string | number)[] = [nowUnix(), nowUnix()];

  if (deckId) { sql += " AND kp.deck_id = ?"; params.push(deckId); }
  if (query) { sql += " AND (kp.title LIKE ? OR kp.body LIKE ?)"; params.push(`%${query}%`, `%${query}%`); }
  sql += " ORDER BY kp.created_at ASC";

  type Row = { id: string; deck_id: string; title: string; mastery: number; flashcard_count: number; question_count: number; due_count: number };
  const rows = db.query<Row, (string | number)[]>(sql).all(...params);
  return rows.map((r) => ({ ...r, depends_on: getKPDeps(db, r.id) }));
}

export function updateKP(db: Database, id: string, updates: { title?: string; body?: string; mastery?: number; source?: string; depends_on?: string[] }): KnowledgePoint {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (updates.title !== undefined) { sets.push("title = ?"); values.push(updates.title); }
  if (updates.body !== undefined) { sets.push("body = ?"); values.push(updates.body); }
  if (updates.mastery !== undefined) { sets.push("mastery = ?"); values.push(updates.mastery); }
  if (updates.source !== undefined) { sets.push("source = ?"); values.push(updates.source); }

  transaction(db, () => {
    if (sets.length > 0) {
      sets.push("updated_at = ?"); values.push(nowUnix()); values.push(id);
      const result = db.query(`UPDATE knowledge_points SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      if (!result.changes) throw new Error(`knowledge_point ${id} not found`);
    }
    if (updates.depends_on !== undefined) {
      db.run("DELETE FROM kp_dependencies WHERE kp_id = ?", [id]);
      for (const depId of updates.depends_on) {
        db.query("INSERT INTO kp_dependencies (kp_id, depends_on_id) VALUES (?, ?)").run(id, depId);
      }
    }
  });
  return getKP(db, id);
}

export function deleteKP(db: Database, id: string): KnowledgePoint {
  const kp = getKP(db, id);
  transaction(db, () => {
    db.run("DELETE FROM review_logs WHERE item_id IN (SELECT id FROM flashcards WHERE kp_id = ?)", [id]);
    db.run("DELETE FROM review_logs WHERE item_id IN (SELECT id FROM questions WHERE kp_id = ?)", [id]);
    db.run("DELETE FROM flashcards WHERE kp_id = ?", [id]);
    db.run("DELETE FROM questions WHERE kp_id = ?", [id]);
    db.run("DELETE FROM kp_dependencies WHERE kp_id = ? OR depends_on_id = ?", [id, id]);
    db.run("DELETE FROM knowledge_points WHERE id = ?", [id]);
  });
  return kp;
}

// --- Flashcards ---

export interface Flashcard {
  id: string;
  kp_id: string;
  front: string;
  back: string;
  interval: number;
  ease: number;
  repetitions: number;
  due_at: number;
  created_at: number;
  updated_at: number;
}

export function createFlashcard(db: Database, kpId: string, front: string, back: string): Flashcard {
  getKP(db, kpId);
  const now = nowUnix();
  const fc: Flashcard = {
    id: randomID("fc_"), kp_id: kpId, front, back,
    interval: 0, ease: 2.5, repetitions: 0, due_at: 0,
    created_at: now, updated_at: now,
  };
  db.query(
    "INSERT INTO flashcards (id, kp_id, front, back, interval, ease, repetitions, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(fc.id, fc.kp_id, fc.front, fc.back, fc.interval, fc.ease, fc.repetitions, fc.due_at, fc.created_at, fc.updated_at);
  return fc;
}

export function getFlashcard(db: Database, id: string): Flashcard {
  const row = db.query<Flashcard, [string]>("SELECT * FROM flashcards WHERE id = ?").get(id);
  if (!row) throw new Error(`flashcard ${id} not found`);
  return row;
}

export function updateFlashcard(db: Database, id: string, updates: { front?: string; back?: string }): Flashcard {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (updates.front !== undefined) { sets.push("front = ?"); values.push(updates.front); }
  if (updates.back !== undefined) { sets.push("back = ?"); values.push(updates.back); }
  if (sets.length === 0) return getFlashcard(db, id);
  sets.push("updated_at = ?"); values.push(nowUnix()); values.push(id);
  const result = db.query(`UPDATE flashcards SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  if (!result.changes) throw new Error(`flashcard ${id} not found`);
  return getFlashcard(db, id);
}

export function deleteFlashcard(db: Database, id: string): Flashcard {
  const fc = getFlashcard(db, id);
  db.run("DELETE FROM review_logs WHERE item_id = ?", [id]);
  db.run("DELETE FROM flashcards WHERE id = ?", [id]);
  return fc;
}

// --- Questions ---

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
  created_at: number;
  updated_at: number;
}

export function createQuestion(db: Database, kpId: string, prompt: string, answer: string, type = "recall"): Question {
  getKP(db, kpId);
  const now = nowUnix();
  const q: Question = {
    id: randomID("q_"), kp_id: kpId, type, prompt, answer,
    interval: 0, ease: 2.5, repetitions: 0, due_at: 0,
    created_at: now, updated_at: now,
  };
  db.query(
    "INSERT INTO questions (id, kp_id, type, prompt, answer, interval, ease, repetitions, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(q.id, q.kp_id, q.type, q.prompt, q.answer, q.interval, q.ease, q.repetitions, q.due_at, q.created_at, q.updated_at);
  return q;
}

export function getQuestion(db: Database, id: string): Question {
  const row = db.query<Question, [string]>("SELECT * FROM questions WHERE id = ?").get(id);
  if (!row) throw new Error(`question ${id} not found`);
  return row;
}

export function updateQuestion(db: Database, id: string, updates: { prompt?: string; answer?: string; type?: string }): Question {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (updates.prompt !== undefined) { sets.push("prompt = ?"); values.push(updates.prompt); }
  if (updates.answer !== undefined) { sets.push("answer = ?"); values.push(updates.answer); }
  if (updates.type !== undefined) { sets.push("type = ?"); values.push(updates.type); }
  if (sets.length === 0) return getQuestion(db, id);
  sets.push("updated_at = ?"); values.push(nowUnix()); values.push(id);
  const result = db.query(`UPDATE questions SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  if (!result.changes) throw new Error(`question ${id} not found`);
  return getQuestion(db, id);
}

export function deleteQuestion(db: Database, id: string): Question {
  const q = getQuestion(db, id);
  db.run("DELETE FROM review_logs WHERE item_id = ?", [id]);
  db.run("DELETE FROM questions WHERE id = ?", [id]);
  return q;
}

// --- Due Items ---

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

export function getDueItems(db: Database, deckId?: string, type?: string, limit = 50): { items: DueItem[]; summary: { flashcard_count: number; question_count: number } } {
  const now = nowUnix();
  const items: DueItem[] = [];

  if (!type || type === "flashcard") {
    let sql = `
      SELECT f.id, f.kp_id, kp.title AS kp_title, f.front, f.back, f.interval, f.repetitions
      FROM flashcards f JOIN knowledge_points kp ON kp.id = f.kp_id
      WHERE f.due_at <= ?`;
    const params: (string | number)[] = [now];
    if (deckId) { sql += " AND kp.deck_id = ?"; params.push(deckId); }
    sql += " ORDER BY f.due_at ASC";

    type FCRow = { id: string; kp_id: string; kp_title: string; front: string; back: string; interval: number; repetitions: number };
    for (const row of db.query<FCRow, (string | number)[]>(sql).all(...params)) {
      items.push({ ...row, type: "flashcard" });
    }
  }

  if (!type || type === "question") {
    let sql = `
      SELECT q.id, q.kp_id, kp.title AS kp_title, q.type AS question_type, q.prompt, q.answer, q.interval, q.repetitions
      FROM questions q JOIN knowledge_points kp ON kp.id = q.kp_id
      WHERE q.due_at <= ?`;
    const params: (string | number)[] = [now];
    if (deckId) { sql += " AND kp.deck_id = ?"; params.push(deckId); }
    sql += " ORDER BY q.due_at ASC";

    type QRow = { id: string; kp_id: string; kp_title: string; question_type: string; prompt: string; answer: string; interval: number; repetitions: number };
    for (const row of db.query<QRow, (string | number)[]>(sql).all(...params)) {
      items.push({ ...row, type: "question" });
    }
  }

  items.sort((a, b) => a.interval - b.interval);

  const fcCount = items.filter((i) => i.type === "flashcard").length;
  const qCount = items.filter((i) => i.type === "question").length;
  const limited = limit > 0 ? items.slice(0, limit) : items;

  return { items: limited, summary: { flashcard_count: fcCount, question_count: qCount } };
}

// --- Record Review ---

export interface RecordResult {
  id: string;
  type: string;
  rating: number;
  next_due: string;
  new_interval: number;
  mastery_change: { kp_id: string; old: number; new: number } | null;
}

export function recordReview(db: Database, itemId: string, rating: number, timeSpent = 0): RecordResult {
  const now = nowUnix();
  let itemType: string;
  let kpId: string;
  let currentSRS: SRSState;

  const fc = db.query<{ kp_id: string; interval: number; ease: number; repetitions: number; due_at: number }, [string]>(
    "SELECT kp_id, interval, ease, repetitions, due_at FROM flashcards WHERE id = ?",
  ).get(itemId);

  if (fc) {
    itemType = "flashcard";
    kpId = fc.kp_id;
    currentSRS = { interval: fc.interval, ease: fc.ease, repetitions: fc.repetitions, due_at: fc.due_at };
  } else {
    const q = db.query<{ kp_id: string; interval: number; ease: number; repetitions: number; due_at: number }, [string]>(
      "SELECT kp_id, interval, ease, repetitions, due_at FROM questions WHERE id = ?",
    ).get(itemId);
    if (!q) throw new Error(`item ${itemId} not found`);
    itemType = "question";
    kpId = q.kp_id;
    currentSRS = { interval: q.interval, ease: q.ease, repetitions: q.repetitions, due_at: q.due_at };
  }

  const newSRS = nextSRS(currentSRS, rating, now);

  return transaction(db, () => {
    db.query("INSERT INTO review_logs (item_type, item_id, rating, time_spent, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(itemType, itemId, rating, timeSpent, now);

    const table = itemType === "flashcard" ? "flashcards" : "questions";
    db.query(`UPDATE ${table} SET interval = ?, ease = ?, repetitions = ?, due_at = ?, updated_at = ? WHERE id = ?`)
      .run(newSRS.interval, newSRS.ease, newSRS.repetitions, newSRS.due_at, now, itemId);

    const masteryChange = updateMastery(db, kpId);

    const dueDate = new Date(newSRS.due_at * 1000).toISOString();
    return { id: itemId, type: itemType, rating, next_due: dueDate, new_interval: newSRS.interval, mastery_change: masteryChange };
  });
}

function updateMastery(db: Database, kpId: string): { kp_id: string; old: number; new: number } | null {
  const kp = db.query<{ mastery: number }, [string]>("SELECT mastery FROM knowledge_points WHERE id = ?").get(kpId);
  if (!kp) return null;

  const fcStats = db.query<{ total: number; mastered: number }, [string]>(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN repetitions >= 3 THEN 1 ELSE 0 END) AS mastered FROM flashcards WHERE kp_id = ?",
  ).get(kpId);

  const qStats = db.query<{ total: number; mastered: number }, [string]>(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN repetitions >= 2 THEN 1 ELSE 0 END) AS mastered FROM questions WHERE kp_id = ?",
  ).get(kpId);

  const total = (fcStats?.total ?? 0) + (qStats?.total ?? 0);
  const mastered = (fcStats?.mastered ?? 0) + (qStats?.mastered ?? 0);

  let newMastery: number;
  if (total === 0) newMastery = 0;
  else {
    const ratio = mastered / total;
    if (ratio >= 0.9) newMastery = 5;
    else if (ratio >= 0.7) newMastery = 4;
    else if (ratio >= 0.5) newMastery = 3;
    else if (ratio >= 0.3) newMastery = 2;
    else if (ratio > 0) newMastery = 1;
    else newMastery = 0;
  }

  if (newMastery === kp.mastery) return null;
  db.query("UPDATE knowledge_points SET mastery = ?, updated_at = ? WHERE id = ?").run(newMastery, Math.floor(Date.now() / 1000), kpId);
  return { kp_id: kpId, old: kp.mastery, new: newMastery };
}

// --- Stats ---

export interface Stats {
  deck: string | null;
  total_kp: number;
  mastery_distribution: Record<string, number>;
  due_today: number;
  weakest_kps: Array<{ id: string; title: string; mastery: number; depends_on_met: boolean }>;
}

export function getStats(db: Database, deckId?: string): Stats {
  const now = nowUnix();
  const params: (string | number)[] = [];
  let where = "";
  if (deckId) { where = "WHERE deck_id = ?"; params.push(deckId); }

  const totalRow = db.query<{ c: number }, (string | number)[]>(`SELECT COUNT(*) AS c FROM knowledge_points ${where}`).get(...params);
  const total_kp = totalRow?.c ?? 0;

  const dist: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  const mRows = db.query<{ mastery: number; c: number }, (string | number)[]>(
    `SELECT mastery, COUNT(*) AS c FROM knowledge_points ${where} GROUP BY mastery`,
  ).all(...params);
  for (const r of mRows) dist[String(r.mastery)] = r.c;

  let dueSql: string;
  let dueParams: (string | number)[];
  if (deckId) {
    dueSql = `
      SELECT
        (SELECT COUNT(*) FROM flashcards f JOIN knowledge_points kp ON kp.id = f.kp_id WHERE f.due_at <= ? AND kp.deck_id = ?) +
        (SELECT COUNT(*) FROM questions q JOIN knowledge_points kp ON kp.id = q.kp_id WHERE q.due_at <= ? AND kp.deck_id = ?) AS c`;
    dueParams = [now, deckId, now, deckId];
  } else {
    dueSql = "SELECT (SELECT COUNT(*) FROM flashcards WHERE due_at <= ?) + (SELECT COUNT(*) FROM questions WHERE due_at <= ?) AS c";
    dueParams = [now, now];
  }
  const dueRow = db.query<{ c: number }, (string | number)[]>(dueSql).get(...dueParams);
  const due_today = dueRow?.c ?? 0;

  const weakestParams: (string | number)[] = [];
  let weakestWhere = "";
  if (deckId) { weakestWhere = "WHERE kp.deck_id = ?"; weakestParams.push(deckId); }
  const weakest = db.query<{ id: string; title: string; mastery: number }, (string | number)[]>(
    `SELECT kp.id, kp.title, kp.mastery FROM knowledge_points kp ${weakestWhere} ORDER BY kp.mastery ASC, kp.created_at ASC LIMIT 5`,
  ).all(...weakestParams);

  const weakest_kps = weakest.map((w) => {
    const deps = getKPDeps(db, w.id);
    let depsMet = true;
    for (const depId of deps) {
      const dep = db.query<{ mastery: number }, [string]>("SELECT mastery FROM knowledge_points WHERE id = ?").get(depId);
      if (!dep || dep.mastery < 2) { depsMet = false; break; }
    }
    return { ...w, depends_on_met: depsMet };
  });

  let deckName: string | null = null;
  if (deckId) {
    const deck = db.query<{ name: string }, [string]>("SELECT name FROM decks WHERE id = ?").get(deckId);
    deckName = deck?.name ?? null;
  }

  return { deck: deckName, total_kp, mastery_distribution: dist, due_today, weakest_kps };
}

// --- Get with inline items ---

export interface KPDetail extends KnowledgePoint {
  flashcards: Array<{ id: string; front: string; back: string; due: string }>;
  questions: Array<{ id: string; type: string; prompt: string; answer: string; due: string }>;
}

export function getKPDetail(db: Database, id: string): KPDetail {
  const kp = getKP(db, id);
  const flashcards = db.query<{ id: string; front: string; back: string; due_at: number }, [string]>(
    "SELECT id, front, back, due_at FROM flashcards WHERE kp_id = ? ORDER BY created_at ASC",
  ).all(id).map((r) => ({ id: r.id, front: r.front, back: r.back, due: new Date(r.due_at * 1000).toISOString() }));

  const questions = db.query<{ id: string; type: string; prompt: string; answer: string; due_at: number }, [string]>(
    "SELECT id, type, prompt, answer, due_at FROM questions WHERE kp_id = ? ORDER BY created_at ASC",
  ).all(id).map((r) => ({ id: r.id, type: r.type, prompt: r.prompt, answer: r.answer, due: new Date(r.due_at * 1000).toISOString() }));

  return { ...kp, flashcards, questions };
}

// --- Entity type detection ---

export function detectType(id: string): string {
  if (id.startsWith("dk_")) return "deck";
  if (id.startsWith("kp_")) return "kp";
  if (id.startsWith("fc_")) return "flashcard";
  if (id.startsWith("q_")) return "question";
  throw new Error(`unknown id prefix: ${id}`);
}
