import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'inbox.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS feedbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    subject TEXT NOT NULL,
    original_category TEXT NOT NULL CHECK (original_category IN ('alta','media','lixo')),
    confirmed_category TEXT NOT NULL CHECK (confirmed_category IN ('alta','media','lixo')),
    correct INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_feedbacks_created ON feedbacks (created_at DESC);
`);

export interface FeedbackRow {
  id: number;
  email_id: string;
  sender: string;
  subject: string;
  original_category: 'alta' | 'media' | 'lixo';
  confirmed_category: 'alta' | 'media' | 'lixo';
  correct: number;
  created_at: string;
}

export function saveFeedback(f: {
  emailId: string;
  sender: string;
  subject: string;
  originalCategory: string;
  confirmedCategory: string;
  correct: boolean;
}) {
  db.prepare(
    `INSERT INTO feedbacks (email_id, sender, subject, original_category, confirmed_category, correct)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(f.emailId, f.sender, f.subject, f.originalCategory, f.confirmedCategory, f.correct ? 1 : 0);
}

export function getStats(): { total: number; correct: number } {
  const row = db
    .prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(correct), 0) AS correct FROM feedbacks`)
    .get() as { total: number; correct: number };
  return row;
}

/** Últimas 20 correções (o modelo errou) — few-shot "não repita esses erros". */
export function getRecentCorrections(limit = 20): FeedbackRow[] {
  return db
    .prepare(`SELECT * FROM feedbacks WHERE correct = 0 ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as FeedbackRow[];
}

/** Últimas 10 confirmações (o modelo acertou) — few-shot "mantenha esse padrão". */
export function getRecentConfirmations(limit = 10): FeedbackRow[] {
  return db
    .prepare(`SELECT * FROM feedbacks WHERE correct = 1 ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as FeedbackRow[];
}

export default db;
