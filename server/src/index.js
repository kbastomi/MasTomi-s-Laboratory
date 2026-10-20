#!/usr/bin/env node
/**
 * The optional back-end.
 *
 * It is deliberately dependency-free: `node:http`, `node:sqlite` and
 * `node:crypto` only, so deploying it to a VPS is "copy the folder and run
 * it" with no install step and no lockfile to drift.
 *
 * The front-end works perfectly well without it — see lab/src/core/api.ts.
 */
import { createServer } from 'node:http'
import { classrooms, DB_FILE, events, progress, sessions, users } from './db.js'
import {
  hashPassword,
  newJoinCode,
  newToken,
  SESSION_TTL,
  userKey,
  verifyPassword,
} from './auth.js'

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '127.0.0.1'

/* ----------------------------------------------------------------- helpers */
function send(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body ?? {})
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': process.env.CORS_ORIGIN ?? '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    ...extraHeaders,
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > 2_000_000) {
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        resolve({})
      }
    })
  })
}

function tokenFrom(req) {
  const header = req.headers.authorization ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

/** The signed-in user, or null. */
function currentUser(req) {
  const token = tokenFrom(req)
  if (!token) return null
  const session = sessions.find(token)
  if (!session) return null
  return users.byId(session.user_id)
}

/* ------------------------------------------------------------------ routes */
const routes = []

function route(method, pattern, handler, { auth = false, role = null } = {}) {
  const keys = []
  const regex = new RegExp(
    '^' +
      pattern.replace(/:([A-Za-z_]+)/g, (_, key) => {
        keys.push(key)
        return '([^/]+)'
      }) +
      '$',
  )
  routes.push({ method, regex, keys, handler, auth, role })
}

/* --- health / capabilities --------------------------------------------- */
route('GET', '/api/health', () => ({
  ok: true,
  version: 1,
  accounts: true,
  progress: true,
  analytics: true,
  db: DB_FILE,
}))

/* --- accounts ----------------------------------------------------------- */
route('POST', '/api/auth/register', async (req) => {
  const body = await readBody(req)
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (!email || password.length < 8) {
    return { status: 400, body: { error: 'email required, password at least 8 characters' } }
  }
  if (users.byEmail(email)) return { status: 409, body: { error: 'that email is already registered' } }

  const user = users.create({
    email,
    name: String(body.name ?? ''),
    role: body.role === 'teacher' ? 'teacher' : 'student',
    passHash: hashPassword(password),
  })
  const token = newToken()
  sessions.create(token, user.id, Date.now() + SESSION_TTL)
  return { status: 201, body: { token, user: publicUser(user) } }
})

route('POST', '/api/auth/login', async (req) => {
  const body = await readBody(req)
  const email = String(body.email ?? '').trim().toLowerCase()
  const user = users.byEmail(email)
  if (!user || !verifyPassword(String(body.password ?? ''), user.pass_hash)) {
    return { status: 401, body: { error: 'wrong email or password' } }
  }
  const token = newToken()
  sessions.create(token, user.id, Date.now() + SESSION_TTL)
  return { token, user: publicUser(user) }
})

route('POST', '/api/auth/logout', (req) => {
  const token = tokenFrom(req)
  if (token) sessions.drop(token)
  return { ok: true }
})

route('GET', '/api/me', (req, res, ctx) => {
  if (!ctx.user) return { status: 401, body: { error: 'not signed in' } }
  return { user: publicUser(ctx.user) }
})

/* --- progress ----------------------------------------------------------- */
route('GET', '/api/progress', (req, res, ctx) => {
  if (!ctx.user) return { status: 401, body: { error: 'not signed in' } }
  return { progress: progress.forUser(ctx.user.id) }
})

route('GET', '/api/progress/:labId', (req, res, ctx, params) => {
  if (!ctx.user) return { status: 401, body: { error: 'not signed in' } }
  const row = progress.get(ctx.user.id, params.labId)
  if (!row) return { status: 404, body: { error: 'no progress for that lab' } }
  let state = null
  try { state = JSON.parse(row.state ?? 'null') } catch { state = null }
  return { labId: row.lab_id, state, done: !!row.done, updatedAt: row.updated_at }
})

route('PUT', '/api/progress/:labId', async (req, res, ctx, params) => {
  if (!ctx.user) return { status: 401, body: { error: 'not signed in' } }
  const body = await readBody(req)
  progress.set(ctx.user.id, params.labId, body.state ?? null, !!body.done)
  return { ok: true }
})

/* --- classrooms --------------------------------------------------------- */
route('POST', '/api/classrooms', async (req, res, ctx) => {
  if (!ctx.user) return { status: 401, body: { error: 'not signed in' } }
  const body = await readBody(req)
  const name = String(body.name ?? 'Kelas').trim()
  let code = newJoinCode()
  while (classrooms.byCode(code)) code = newJoinCode()
  const room = classrooms.create({ teacherId: ctx.user.id, name, joinCode: code })
  return { status: 201, body: { classroom: { ...room, teacherId: ctx.user.id } } }
})

route('GET', '/api/classrooms', (req, res, ctx) => {
  if (!ctx.user) return { status: 401, body: { error: 'not signed in' } }
  if (ctx.user.role === 'teacher') {
    return { classrooms: classrooms.forTeacher(ctx.user.id) }
  }
  return { classrooms: classrooms.forStudent(ctx.user.id) }
})

route('GET', '/api/classrooms/:id', (req, res, ctx, params) => {
  if (!ctx.user) return { status: 401, body: { error: 'not signed in' } }
  const room = classrooms.byId(Number(params.id))
  if (!room) return { status: 404, body: { error: 'no such classroom' } }
  return {
    classroom: room,
    members: classrooms.members(room.id),
    progress: progress.forClassroom(room.id),
  }
})

route('POST', '/api/classrooms/:code/join', (req, res, ctx, params) => {
  if (!ctx.user) return { status: 401, body: { error: 'not signed in' } }
  const room = classrooms.byCode(String(params.code).toUpperCase())
  if (!room) return { status: 404, body: { error: 'that join code does not exist' } }
  classrooms.join(room.id, ctx.user.id)
  return { ok: true, classroom: room }
})

/* --- analytics ---------------------------------------------------------- */
route('POST', '/api/events', async (req, res, ctx) => {
  const body = await readBody(req)
  const list = Array.isArray(body.events) ? body.events : []
  for (const ev of list.slice(0, 200)) {
    events.add({
      userId: ctx.user?.id ?? null,
      type: String(ev.type ?? 'unknown'),
      labId: ev.labId ?? null,
      chapterId: ev.chapterId ?? null,
      payload: ev.data ?? null,
      at: Number(ev.at ?? Date.now()),
    })
  }
  return { ok: true, accepted: list.length }
})

route('GET', '/api/reports/summary', (req, res, ctx) => {
  if (!ctx.user) return { status: 401, body: { error: 'not signed in' } }
  if (ctx.user.role !== 'teacher') {
    return { status: 403, body: { error: 'teachers only' } }
  }
  return { events: events.summary() }
})

function publicUser(user) {
  return { id: user.id, key: userKey(user.id), email: user.email, name: user.name, role: user.role }
}

/* ------------------------------------------------------------------ server */
const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': process.env.CORS_ORIGIN ?? '*',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-max-age': '86400',
    })
    res.end()
    return
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const path = url.pathname.replace(/\/+$/, '') || '/'

  for (const r of routes) {
    if (r.method !== req.method) continue
    const match = r.regex.exec(path)
    if (!match) continue

    const params = {}
    r.keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]) })
    const user = currentUser(req)

    if (r.auth && !user) {
      send(res, 401, { error: 'not signed in' })
      return
    }
    if (r.role && user?.role !== r.role) {
      send(res, 403, { error: 'not allowed' })
      return
    }

    try {
      const result = await r.handler(req, res, { user }, params)
      if (result === undefined) return
      if (result && typeof result === 'object' && 'status' in result && 'body' in result) {
        send(res, result.status, result.body)
      } else {
        send(res, 200, result)
      }
    } catch (err) {
      console.error('[api]', req.method, path, err)
      send(res, 500, { error: 'internal error' })
    }
    return
  }

  send(res, 404, { error: 'no such endpoint' })
})

server.listen(PORT, HOST, () => {
  console.log(`[mastomi-lab] API listening on http://${HOST}:${PORT}`)
  console.log(`[mastomi-lab] database: ${DB_FILE}`)
})
