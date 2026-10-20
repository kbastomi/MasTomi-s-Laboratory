#!/usr/bin/env node
/**
 * Export the OpenCode sessions that belong to THIS project into
 * docs/conversations/, so the working history travels with the code.
 *
 *   npm run export:conversations
 *
 * For each session it writes a readable transcript:
 *
 *   <date>-<slug>.md    user + assistant text with tool calls collapsed into a
 *                       summary list — open it in any editor, on any machine,
 *                       with no tooling installed
 *
 * Pass --json to also write the lossless session record in OpenCode's own
 * export format (re-importable with `opencode session import <file>`). Those
 * files are large, so they are opt-in and git-ignored.
 *
 * ---------------------------------------------------------------------------
 *  Keeping other projects out
 * ---------------------------------------------------------------------------
 *  This repository is public, so it must not carry anything about the other
 *  projects that live on the same machine. Two rules are enforced:
 *
 *   1. **Only this project is exported.** A session is included only if it
 *      was held inside this project's directory — plus any extra directory
 *      the local filter lists.
 *
 *   2. **Other projects are removed.** Any block of text that mentions one
 *      is dropped, and any path that points at one is rewritten.
 *
 *  The list of what counts as "another project" is deliberately *not* in this
 *  repository — naming them here would defeat the purpose. It lives in a
 *  local, git-ignored file:
 *
 *      tools/conversation-filter.local.json
 *
 *  Copy tools/conversation-filter.local.example.json to get started. With no
 *  local file, the exporter still works: it exports only the sessions from
 *  this project's own directory and rewrites nothing.
 */
import { DatabaseSync } from 'node:sqlite'
import {
  mkdirSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  existsSync,
  readFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'docs', 'conversations')
const LOCAL_FILTER = join(ROOT, 'tools', 'conversation-filter.local.json')

/* ====================================================================== *
 *  The local filter — private, git-ignored
 * ====================================================================== */

function loadLocalFilter() {
  const empty = { includeDirs: [], drop: [], redact: [] }
  if (!existsSync(LOCAL_FILTER)) return empty
  try {
    const parsed = JSON.parse(readFileSync(LOCAL_FILTER, 'utf8'))
    return {
      includeDirs: Array.isArray(parsed.includeDirs) ? parsed.includeDirs : [],
      drop: Array.isArray(parsed.drop) ? parsed.drop : [],
      redact: Array.isArray(parsed.redact) ? parsed.redact : [],
    }
  } catch (err) {
    console.error(`✗ ${LOCAL_FILTER} is not valid JSON: ${err.message}`)
    process.exit(1)
  }
}

/* ====================================================================== *
 *  Where this project lives
 * ====================================================================== */

/**
 * Sessions are considered part of this project when they were held in the
 * directory that contains the repository — the laboratory's own working
 * area — plus anything the local filter adds.
 */
function projectRoots() {
  const parent = dirname(ROOT).replace(/\\/g, '/').replace(/\/+$/, '')
  return [parent, ...loadLocalFilter().includeDirs]
}

/* ====================================================================== *
 *  The back-end of the OpenCode database
 * ====================================================================== */

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
  return (
    (s || 'session')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'session'
  )
}

function safeJson(value, fallback) {
  try { return JSON.parse(value) } catch { return fallback }
}

/* ------------------------------------------------------------------ filter */
function normaliseDir(dir) {
  return String(dir || '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase()
}

function belongsToProject(dir, roots) {
  const d = normaliseDir(dir)
  return roots.some(
    (root) => d === normaliseDir(root) || d.startsWith(`${normaliseDir(root)}/`),
  )
}

/** Case-insensitive substring test against the local drop list. */
function mentionsOtherProject(text, dropList) {
  const haystack = String(text || '').toLowerCase()
  return dropList.some((needle) => haystack.includes(String(needle).toLowerCase()))
}

/** Rewrite the paths that point at another project. */
function redact(text, rules) {
  let out = String(text || '')
  for (const rule of rules) {
    if (!rule || !rule.from) continue
    out = out.split(rule.from).join(rule.to ?? '')
  }
  return out
}

/**
 * Keep only the paragraphs that are about this project. Paragraphs are
 * separated by blank lines, which is how the transcript is laid out anyway.
 */
function keepThisProject(text, dropList) {
  const paragraphs = String(text || '').split(/\n\s*\n/)
  return paragraphs.filter((p) => !mentionsOtherProject(p, dropList)).join('\n\n')
}

/* --------------------------------------------------------------- markdown */
function toMarkdown(session, messages, filter) {
  const info = session.info
  const out = []
  out.push(`# ${info.title || 'Untitled session'}`)
  out.push('')
  out.push(`| | |`)
  out.push(`|---|---|`)
  out.push(`| **Session ID** | \`${info.id}\` |`)
  out.push(`| **Directory** | \`${redact(info.location?.directory || '—', filter.redact)}\` |`)
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
      const raw = (m.text || '').trim()
      const files = (m.files || []).map((f) => f.filename).filter(Boolean)
      if (!raw && !files.length) continue
      const text = keepThisProject(raw, filter.drop).trim()
      const keptFiles = files.filter((f) => !mentionsOtherProject(f, filter.drop))
      if (!text && !keptFiles.length) continue
      out.push(`### 👤 Student · ${when}`)
      out.push('')
      if (text) { out.push(text); out.push('') }
      for (const f of keptFiles) out.push(`- 📎 attached: \`${f}\``)
      if (keptFiles.length) out.push('')
    } else if (m.type === 'assistant') {
      const parts = []
      const calls = []
      for (const c of m.content || []) {
        if (!c || typeof c !== 'object') continue
        if (c.type === 'text' && c.text && c.text.trim()) {
          const kept = keepThisProject(c.text, filter.drop).trim()
          if (kept) parts.push(kept)
        }
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
          /* a tool call that touched another project is not part of this story */
          if (mentionsOtherProject(`${arg ?? ''} ${detail}`, filter.drop)) continue
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

function shorten(s, max = 140) {
  if (typeof s !== 'string') return ''
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat
}

/* ------------------------------------------------------------------- main */
const WITH_JSON = process.argv.includes('--json')
const filter = loadLocalFilter()
const roots = projectRoots()

const dbPath = findDb()
if (!dbPath) {
  console.error(`✗ No OpenCode database found. Looked in:\n${DB_PATHS.map((p) => '  ' + p).join('\n')}`)
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })

const db = new DatabaseSync(dbPath, { readOnly: true })
const sessions = db
  .prepare(
    `SELECT id, project_id, title, slug, directory, model, agent,
            time_created, time_updated, tokens_input, tokens_output
     FROM session_v2 ORDER BY time_created ASC`,
  )
  .all()

const msgStmt = db.prepare(
  `SELECT seq, type, time_created, data FROM session_message WHERE session_id = ? ORDER BY seq ASC`,
)

/* clear previously generated files so renamed/removed sessions do not linger */
for (const f of readdirSync(OUT)) {
  if ((f.endsWith('.md') || f.endsWith('.json')) && f !== 'README.md') {
    unlinkSync(join(OUT, f))
  }
}

let count = 0
let skipped = 0
const problems = []

for (const s of sessions) {
  if (!belongsToProject(s.directory, roots)) {
    console.log(`· skipped (another project): ${s.title ?? s.id}`)
    skipped++
    continue
  }

  const rows = msgStmt.all(s.id)
  const messages = rows.map((r) => {
    const data = safeJson(r.data, {})
    return {
      id: `msg_${String(r.seq).padStart(12, '0')}`,
      type: r.type,
      time: data.time || { created: r.time_created },
      ...data,
    }
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
  const markdown = redact(toMarkdown(payload, messages, filter), filter.redact)
  writeFileSync(join(OUT, `${base}.md`), markdown, 'utf8')
  if (WITH_JSON) {
    writeFileSync(
      join(OUT, `${base}.json`),
      redact(JSON.stringify(payload, null, 2), filter.redact),
      'utf8',
    )
  }
  console.log(`✓ ${base}  (${messages.length} messages)`)
  count++

  /* the final guarantee: none of the private markers survived */
  const haystack = markdown.toLowerCase()
  for (const needle of filter.drop) {
    if (haystack.includes(String(needle).toLowerCase())) {
      problems.push(`${base}: still contains "${needle}"`)
    }
  }
}

db.close()

console.log(`\n${count} session(s) exported, ${skipped} skipped (not this project).`)

if (problems.length) {
  console.error('\n✗ The export still contains references to another project:')
  for (const p of problems) console.error(`   ${p}`)
  process.exit(1)
}
console.log('✓ no references to other projects in the output')
