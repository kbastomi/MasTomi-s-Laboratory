#!/usr/bin/env node
/**
 * Export every OpenCode session from the local database into this repository,
 * so the working history travels with the code.
 *
 *   npm run export:conversations
 *
 * For each session it writes a readable transcript into docs/conversations/:
 *
 *   <date>-<slug>.md    user + assistant text with tool calls collapsed into a
 *                       summary list — open it in any editor, on any machine,
 *                       with no tooling installed
 *
 * Pass --json to also write the lossless session record in OpenCode's own
 * export shape (re-importable with `opencode session import <file>`). Those
 * files are large, so they are opt-in and git-ignored by default.
 *
 * The database lives at ~/.local/share/opencode/opencode.db (Node's built-in
 * node:sqlite reads it; no third-party dependency).
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, writeFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'docs', 'conversations')

const DB_PATHS = [
  join(homedir(), '.local', 'share', 'opencode', 'opencode.db'),
  join(homedir(), 'AppData', 'Local', 'opencode', 'opencode.db'),
  join(homedir(), 'Library', 'Application Support', 'opencode', 'opencode.db'),
]

function findDb() {
  for (const p of DB_PATHS) if (existsSync(p)) return p
  return null
}

/* ------------------------------------------------------------------ utils */
const pad = (n) => String(n).padStart(2, '0')

function stamp(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function clock(ms) {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function slugify(s) {
  return (s || 'session')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'session'
}

function safeJson(value, fallback) {
  try { return JSON.parse(value) } catch { return fallback }
}

function shorten(s, max = 140) {
  if (typeof s !== 'string') return ''
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat
}

/* --------------------------------------------------------------- markdown */
function toolSummary(content) {
  const calls = []
  for (const c of content || []) {
    if (!c || typeof c !== 'object') continue
    if (c.type === 'tool') {
      const input = c.state?.input || {}
      let detail = ''
      const arg = input.path || input.file_path || input.url || input.command || input.pattern
      if (typeof arg === 'string') detail = arg
      calls.push({ name: c.name || 'tool', detail })
    }
  }
  return calls
}

function toMarkdown(session, messages) {
  const info = session.info
  const out = []
  out.push(`# ${info.title || 'Untitled session'}`)
  out.push('')
  out.push(`| | |`)
  out.push(`|---|---|`)
  out.push(`| **Session ID** | \`${info.id}\` |`)
  out.push(`| **Directory** | \`${info.location?.directory || '—'}\` |`)
  out.push(`| **Started** | ${info.time?.created ? `${stamp(info.time.created)} ${clock(info.time.created)}` : '—'} |`)
  if (info.time?.updated) out.push(`| **Last activity** | ${stamp(info.time.updated)} ${clock(info.time.updated)} |`)
  out.push(`| **Messages** | ${messages.length} |`)
  if (info.model?.id) out.push(`| **Model** | ${info.model.providerID || ''}/${info.model.id} |`)
  out.push(`| **Exported** | ${stamp(Date.now())} |`)
  out.push('')
  out.push('---')
  out.push('')

  for (const m of messages) {
    const when = m.time?.created ? clock(m.time.created) : '--:--'
    if (m.type === 'user') {
      const text = (m.text || '').trim()
      const files = (m.files || []).map((f) => f.filename).filter(Boolean)
      if (!text && !files.length) continue
      out.push(`### 👤 Student · ${when}`)
      out.push('')
      if (text) { out.push(text); out.push('') }
      for (const f of files) out.push(`- 📎 attached: \`${f}\``)
      if (files.length) out.push('')
    } else if (m.type === 'assistant') {
      const parts = []
      const calls = []
      for (const c of m.content || []) {
        if (!c || typeof c !== 'object') continue
        if (c.type === 'text' && c.text && c.text.trim()) parts.push(c.text.trim())
        if (c.type === 'tool') calls.push(c)
      }
      if (!parts.length && !calls.length) continue
      const agent = m.agent ? ` · ${m.agent}` : ''
      out.push(`### 🤖 Assistant${agent} · ${when}`)
      out.push('')
      if (parts.length) { out.push(parts.join('\n\n')); out.push('') }
      if (calls.length) {
        out.push(`<details><summary>🔧 ${calls.length} tool call${calls.length > 1 ? 's' : ''}</summary>`)
        out.push('')
        for (const c of calls) {
          const input = c.state?.input || {}
          const arg = input.path || input.file_path || input.url || input.command || input.pattern
          const status = c.state?.status && c.state.status !== 'completed' ? ` — ${c.state.status}` : ''
          const detail = typeof arg === 'string' ? shorten(arg) : ''
          out.push(`- \`${c.name || 'tool'}\`${detail ? ` · \`${detail}\`` : ''}${status}`)
        }
        out.push('')
        out.push('</details>')
        out.push('')
      }
    }
  }
  return out.join('\n')
}

/* ------------------------------------------------------------------- main */
const WITH_JSON = process.argv.includes('--json')

const dbPath = findDb()
if (!dbPath) {
  console.error(`✗ No OpenCode database found. Looked in:\n${DB_PATHS.map((p) => '  ' + p).join('\n')}`)
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })

const db = new DatabaseSync(dbPath, { readOnly: true })
const sessions = db.prepare(`
  SELECT id, project_id, title, slug, directory, model, agent,
         time_created, time_updated, tokens_input, tokens_output
  FROM session_v2 ORDER BY time_created ASC
`).all()

const msgStmt = db.prepare(`SELECT seq, type, time_created, data FROM session_message WHERE session_id = ? ORDER BY seq ASC`)

/* clear previously generated files so renamed/removed sessions do not linger */
for (const f of readdirSync(OUT)) {
  if (f.endsWith('.md') || f.endsWith('.json')) {
    if (f !== 'README.md') unlinkSync(join(OUT, f))
  }
}
let count = 0
for (const s of sessions) {
  const rows = msgStmt.all(s.id)
  const messages = rows.map((r) => {
    const data = safeJson(r.data, {})
    return { id: `msg_${String(r.seq).padStart(12, '0')}`, type: r.type, time: data.time || { created: r.time_created }, ...data }
  })

  const info = {
    id: s.id,
    projectID: s.project_id,
    title: s.title,
    location: { directory: s.directory },
    agent: s.agent,
    model: safeJson(s.model, {}),
    time: { created: s.time_created, updated: s.time_updated },
    tokens: { input: s.tokens_input ?? 0, output: s.tokens_output ?? 0 },
  }
  const payload = { info, messages }

  const base = `${stamp(s.time_created)}-${slugify(s.title || s.slug)}-${s.id.slice(-6)}`
  writeFileSync(join(OUT, `${base}.md`), toMarkdown(payload, messages), 'utf8')
  if (WITH_JSON) {
    writeFileSync(join(OUT, `${base}.json`), JSON.stringify(payload, null, 2), 'utf8')
  }
  console.log(`✓ ${base}  (${messages.length} messages)`)
  count++
}

db.close()
console.log(`\n${count} session(s) exported to docs/conversations/`)
