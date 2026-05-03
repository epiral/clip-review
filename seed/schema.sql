CREATE TABLE IF NOT EXISTS decks (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '[]',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_points (
    id         TEXT PRIMARY KEY,
    deck_id    TEXT NOT NULL REFERENCES decks(id),
    title      TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    mastery    INTEGER NOT NULL DEFAULT 0,
    source     TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kp_deck ON knowledge_points(deck_id);

CREATE TABLE IF NOT EXISTS kp_dependencies (
    kp_id         TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    depends_on_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    PRIMARY KEY (kp_id, depends_on_id)
);

CREATE TABLE IF NOT EXISTS flashcards (
    id          TEXT PRIMARY KEY,
    kp_id       TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    front       TEXT NOT NULL,
    back        TEXT NOT NULL,
    interval    REAL NOT NULL DEFAULT 0,
    ease        REAL NOT NULL DEFAULT 2.5,
    repetitions INTEGER NOT NULL DEFAULT 0,
    due_at      INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fc_kp ON flashcards(kp_id);
CREATE INDEX IF NOT EXISTS idx_fc_due ON flashcards(due_at);

CREATE TABLE IF NOT EXISTS questions (
    id          TEXT PRIMARY KEY,
    kp_id       TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT 'recall',
    prompt      TEXT NOT NULL,
    answer      TEXT NOT NULL,
    interval    REAL NOT NULL DEFAULT 0,
    ease        REAL NOT NULL DEFAULT 2.5,
    repetitions INTEGER NOT NULL DEFAULT 0,
    due_at      INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_q_kp ON questions(kp_id);
CREATE INDEX IF NOT EXISTS idx_q_due ON questions(due_at);

CREATE TABLE IF NOT EXISTS review_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type  TEXT NOT NULL,
    item_id    TEXT NOT NULL,
    rating     INTEGER NOT NULL,
    time_spent INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rl_item ON review_logs(item_id);
