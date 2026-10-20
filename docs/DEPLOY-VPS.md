# Deploying to a VPS (LEMP + Node.js)

This is the *later* plan. The static site works today on Cloudflare Pages and
does not need anything here. When you are ready for accounts, classrooms and
synced progress, move the same build to a VPS.

The key point: **the front-end does not change.** Only the build gets one
extra environment variable, and nginx gains a `/api` proxy rule.

---

## 1. What changes

| | Cloudflare Pages (now) | VPS (later) |
|---|---|---|
| Static files | Pages CDN | nginx serving `dist/` |
| API | none | Node service on `127.0.0.1:3000` |
| Build | `VITE_API_BASE` unset | `VITE_API_BASE=/api` |
| Database | — | SQLite in `/var/lib/mastomi-lab/lab.db` |
| TLS | Cloudflare | Let's Encrypt (certbot) |

Build once, serve anywhere:

```powershell
$env:VITE_API_BASE="/api"
npm run build
```

The `dist/` folder is byte-for-byte the same kind of output; nginx just
serves it.

---

## 2. The server

`server/` is a **zero-dependency** Node service. It uses `node:http`,
`node:sqlite` and `node:crypto` — nothing to `npm install` on the VPS.

```bash
sudo mkdir -p /opt/mastomi-lab
sudo rsync -a --exclude node_modules ./ /opt/mastomi-lab/
cd /opt/mastomi-lab/server
node --version        # must be 22.12+ for node:sqlite
node src/index.js
```

It listens on `127.0.0.1:3000` by default (override with `PORT`).

### systemd unit

`/etc/systemd/system/mastomi-lab.service`:

```ini
[Unit]
Description=MasTomi's Laboratory API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/mastomi-lab/server
Environment=PORT=3000
Environment=LAB_DB=/var/lib/mastomi-lab/lab.db
Environment=LAB_SECRET=change-me-to-a-long-random-string
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo mkdir -p /var/lib/mastomi-lab
sudo chown www-data:www-data /var/lib/mastomi-lab
sudo systemctl enable --now mastomi-lab
sudo systemctl status mastomi-lab
```

---

## 3. nginx

`/etc/nginx/sites-available/mastomi-lab`:

```nginx
server {
    listen 80;
    server_name lab.example.com;

    root /opt/mastomi-lab/dist;
    index index.html;

    # the API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # hashed assets — cache forever
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # the laboratory and the landing page — never cached
    location / {
        add_header Cache-Control "no-cache, must-revalidate";
        try_files $uri $uri/ /index.html;
    }

    # optional: only nginx should reach the API
    location = /api/health { allow 127.0.0.1; deny all; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mastomi-lab /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d lab.example.com
```

**LEMP note.** PHP-FPM and MySQL are not needed by the laboratory itself. Keep
them if you want a PHP landing page or a phpMyAdmin admin panel; the Node
service uses its own SQLite file, so there is no second database to configure.

---

## 4. What the API stores

| Table | Contents |
|---|---|
| `users` | id, email, password hash (scrypt), role (`student` \| `teacher`), created |
| `sessions` | token, user id, expires |
| `classrooms` | id, teacher id, name, join code |
| `classroom_members` | classroom id, user id, joined |
| `progress` | user id, lab id, state JSON, done, updated — one row per student per lab |
| `events` | id, user id, type, lab id, chapter id, payload JSON, at |

The `progress.state` column holds exactly the blob a lab's `serialize()`
returns, so the front-end never needs to know the schema.

---

## 5. Trying it locally

```powershell
# terminal 1 — the API
node server/src/index.js

# terminal 2 — the front-end, pointed at the API
$env:VITE_API_BASE="/api"
npm run dev
```

`npm run dev` proxies `/api` to `http://localhost:3000` (see
`vite.config.ts`).

Without `VITE_API_BASE` the front-end never asks for the API at all — there
is no red line in the browser console and no failed request in the network
tab. That is deliberate.

---

## 6. Moving the domain

If the domain is already on Cloudflare, keep the DNS there and point it at the
VPS:

| Type | Name | Target |
|---|---|---|
| `A` | `lab` | `<your-vps-ip>` |

Then turn off the Cloudflare proxy (grey cloud) for that record, or leave it on
— Cloudflare will happily proxy to the VPS, and you keep its TLS and CDN for
the static assets.

---

## 7. A note on scale

The static site is served by a CDN; the VPS serves one page and a small JSON
API. SQLite in WAL mode comfortably handles a school full of students — the
write volume is a progress update every couple of seconds per active student.
Move to PostgreSQL only when you actually need it; the SQL in `server/src/db.js`
is deliberately plain.
