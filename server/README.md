# The back-end

An **optional** Node service for MasTomi's Laboratory: student accounts,
classrooms, synced progress and analytics.

The laboratory works perfectly well without it — progress is kept in the
browser's `localStorage`. This service exists for the day you want progress
to follow a student between devices, or to let a teacher see who did what.

## Zero dependencies

It uses `node:http`, `node:sqlite` and `node:crypto` — all built into Node
22.12+. There is nothing to install:

```bash
cd server
node src/index.js
```

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | the port to listen on |
| `HOST` | `127.0.0.1` | bind address — keep it local and let nginx proxy |
| `LAB_DB` | `server/data/lab.db` | the SQLite file |
| `LAB_SECRET` | `dev-secret-change-me` | **change this** — it signs user keys |
| `CORS_ORIGIN` | `*` | tighten this when the API is public |

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | – | capability probe — the front-end calls this once at boot |
| `POST` | `/api/auth/register` | – | create an account, returns a token |
| `POST` | `/api/auth/login` | – | sign in, returns a token |
| `POST` | `/api/auth/logout` | token | drop the session |
| `GET` | `/api/me` | token | the signed-in user |
| `GET` | `/api/progress` | token | every saved lab for this user |
| `GET` | `/api/progress/:labId` | token | one lab's saved state |
| `PUT` | `/api/progress/:labId` | token | save one lab's state |
| `POST` | `/api/classrooms` | token | create a classroom, returns a join code |
| `GET` | `/api/classrooms` | token | your classrooms |
| `GET` | `/api/classrooms/:id` | token | a classroom with its members and progress |
| `POST` | `/api/classrooms/:code/join` | token | join with the code |
| `POST` | `/api/events` | token | a batch of analytics events |
| `GET` | `/api/reports/summary` | teacher | aggregated usage |

## Switching the front-end on

The front-end only talks to the API when `VITE_API_BASE` is set at build
time:

```bash
VITE_API_BASE=/api npm run build
```

Without it the laboratory never makes a request — no failed request, no red
line in the console.

## Deployment

See [`../docs/DEPLOY-VPS.md`](../docs/DEPLOY-VPS.md) for the nginx and
systemd setup.

## Security notes

- Passwords are hashed with scrypt and a per-user salt.
- Sessions are opaque random tokens stored in the database, with an expiry.
- `LAB_SECRET` signs the non-reversible user key the front-end uses.
- Set `CORS_ORIGIN` to your real domain before exposing this publicly, and
  put it behind TLS.
