/**
 * The database.
 *
 * Plain `node:sqlite` (built into Node 22.5+), so the server needs no npm
 * install at all on the VPS. WAL mode keeps readers and the writer from
 * blocking each other, which matters once a class is active at the same time.
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const DB_PATH = process.env.LAB_DB ?? new URL('../data/lab.db', import.meta.url).pathname

mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL DEFAULT '',
    role         TEXT NOT NULL DEFAULT 'student',
    pass_hash    TEXT NOT NULL,
    created_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token        TEXT PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS classrooms (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    join_code    TEXT NOT NULL UNIQUE,
    created_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS classroom_members (
    classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at    INTEGER NOT NULL,
    PRIMARY KEY (classroom_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS progress (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lab_id       TEXT NOT NULL,
    state        TEXT,
    done         INTEGER NOT NULL DEFAULT 0,
    updated_at   INTEGER NOT NULL,
    PRIMARY KEY (user_id, lab_id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type         TEXT NOT NULL,
    lab_id       TEXT,
    chapter_id   TEXT,
    payload      TEXT,
    at           INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
  CREATE INDEX IF NOT EXISTS idx_events_at ON events(at);
  CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
`)

/* ------------------------------------------------------------------ users */
export const users = {
  byEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) ?? null
  },
  byId(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null
  },
  create({ email, name, role, passHash }) {
    const info = db
      .prepare(
        'INSERT INTO users (email, name, role, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(email, name ?? '', role ?? 'student', passHash, Date.now())
    return users.byId(Number(info.lastInsertRowid))
  },
  list() {
    return db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at').all()
  },
}

/* --------------------------------------------------------------- sessions */
export const sessions = {
  create(token, userId, expiresAt) {
    db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(token, userId, Date.now(), expiresAt)
  },
  find(token) {
    if (!token) return null
    const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token)
    if (!row) return null
    if (row.expires_at < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
      return null
    }
    return row
  },
  drop(token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  },
}

/* ------------------------------------------------------------- classrooms */
export const classrooms = {
  create({ teacherId, name, joinCode }) {
    const info = db
      .prepare('INSERT INTO classrooms (teacher_id, name, join_code, created_at) VALUES (?, ?, ?, ?)')
      .run(teacherId, name, joinCode, Date.now())
    return db.prepare('SELECT * FROM classrooms WHERE id = ?').get(Number(info.lastInsertRowid))
  },
  byCode(code) {
    return db.prepare('SELECT * FROM classrooms WHERE join_code = ?').get(code) ?? null
  },
  byId(id) {
    return db.prepare('SELECT * FROM classrooms WHERE id = ?').get(id) ?? null
  },
  forTeacher(teacherId) {
    return db
      .prepare('SELECT * FROM classrooms WHERE teacher_id = ? ORDER BY created_at')
      .all(teacherId)
  },
  join(classroomId, userId) {
    db.prepare(
      'INSERT OR IGNORE INTO classroom_members (classroom_id, user_id, joined_at) VALUES (?, ?, ?)',
    ).run(classroomId, userId, Date.now())
  },
  members(classroomId) {
    return db
      .prepare(
        `SELECT u.id, u.email, u.name, u.role, m.joined_at
         FROM classroom_members m JOIN users u ON u.id = m.user_id
         WHERE m.classroom_id = ? ORDER BY u.name`,
      )
      .all(classroomId)
  },
  forStudent(userId) {
    return db
      .prepare(
        `SELECT c.* FROM classrooms c
         JOIN classroom_members m ON m.classroom_id = c.id
         WHERE m.user_id = ?`,
      )
      .all(userId)
  },
}

/* ---------------------------------------------------------------- progress */
export const progress = {
  get(userId, labId) {
    return (
      db.prepare('SELECT * FROM progress WHERE user_id = ? AND lab_id = ?').get(userId, labId) ?? null
    )
  },
  set(userId, labId, state, done = false) {
    db.prepare(
      `INSERT INTO progress (user_id, lab_id, state, done, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, lab_id) DO UPDATE SET
         state = excluded.state, done = excluded.done, updated_at = excluded.updated_at`,
    ).run(userId, labId, JSON.stringify(state ?? null), done ? 1 : 0, Date.now())
  },
  forUser(userId) {
    return db.prepare('SELECT * FROM progress WHERE user_id = ?').all(userId)
  },
  forClassroom(classroomId) {
    return db
      .prepare(
        `SELECT p.*, u.email, u.name FROM progress p
         JOIN classroom_members m ON m.user_id = p.user_id
         JOIN users u ON u.id = p.user_id
         WHERE m.classroom_id = ? ORDER BY u.name, p.lab_id`,
      )
      .all(classroomId)
  },
}

/* ------------------------------------------------------------------ events */
export const events = {
  add({ userId, type, labId, chapterId, payload, at }) {
    db.prepare(
      'INSERT INTO events (user_id, type, lab_id, chapter_id, payload, at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(userId ?? null, type, labId ?? null, chapterId ?? null, payload ? JSON.stringify(payload) : null, at)
  },
  recent(limit = 100) {
    return db.prepare('SELECT * FROM events ORDER BY at DESC LIMIT ?').all(limit)
  },
  summary() {
    return db
      .prepare(
        `SELECT type, lab_id AS labId, COUNT(*) AS count
         FROM events GROUP BY type, lab_id ORDER BY count DESC`,
      )
      .all()
  },
}

export const DB_FILE = DB_PATH
