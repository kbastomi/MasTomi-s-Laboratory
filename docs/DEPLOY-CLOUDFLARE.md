# Deploying to Cloudflare Pages

This repository is the **root of the domain**. The landing page is served at
`/` and the laboratory at `/lab/`.

| URL | File |
|---|---|
| `https://mastomi.my.id/` | `index.html` (the landing page) |
| `https://mastomi.my.id/lab/` | `lab/index.html` (the laboratory) |

## This deployment

| | |
|---|---|
| Pages project | `mastomi-laboratory` |
| Pages hostname | `mastomi-laboratory.pages.dev` |
| Custom domains | `mastomi.my.id`, `lab.mastomi.my.id` |
| Source | GitHub — `kbastomi/MasTomi-s-Laboratory`, production branch `main` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment | `NODE_VERSION=22` |

Every push to `main` builds and deploys automatically. Pull requests get
their own preview URL.

---

## 1. Create the Pages project

1. Sign in to [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Choose the repository `kbastomi/MasTomi-s-Laboratory`.

### Build settings

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | *(leave empty — the project is at the repo root)* |
| Node version | `NODE_VERSION` = `22` *(environment variable)* |

Vite 8 needs Node `^20.19.0 || >=22.12.0`. Pinning `NODE_VERSION` removes any
doubt about which version the build image picks.

### Environment variables

| Variable | Value | Why |
|---|---|---|
| `NODE_VERSION` | `22` | satisfies Vite's engine requirement |

Leave `VITE_API_BASE` **unset** for the static deployment — that keeps the
laboratory purely local and stops it asking for an API that does not exist.
See [DEPLOY-VPS.md](./DEPLOY-VPS.md) for the version that talks to Node.

### Deploy

Push to `main` and the site is live on `https://<project>.pages.dev`.
Every pull request gets its own preview URL, automatically.

---

## 2. Attach the custom domain

**Workers & Pages → your project → Custom domains → Set up a domain.**

- If the zone is already in the same Cloudflare account, Pages creates the
  `CNAME` record for you.
- Otherwise add it by hand:

  | Type | Name | Target |
  |---|---|---|
  | `CNAME` | `@` (or `lab` for a subdomain) | `<project>.pages.dev` |

TLS is issued automatically and renewed without you doing anything.

### Do you need the Cloudflare API?

**Not for any of the steps above** — the dashboard covers all of it, and it
takes about five minutes.

The API is only worth using if you want to *automate* it, for example:

- creating projects from a script (`POST /accounts/:id/pages/projects`);
- setting environment variables without opening the dashboard;
- wiring the domain up from CI;
- reading deploy logs programmatically.

If you do want that, create a **scoped API token** in
[My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens):

| Permission | Scope |
|---|---|
| Cloudflare Pages — Edit | your account |
| Zone — DNS — Edit | the zone (only if the token must create DNS records) |

Keep it out of the repository. Put it in the environment:

```powershell
$env:CLOUDFLARE_API_TOKEN = "..."
```

and never commit it. For CI, use the provider's secret store
(`CLOUDFLARE_API_TOKEN` on GitHub Actions) rather than a `.env` file.

---

## 3. What the build produces

```
dist/
├─ index.html            the landing page
├─ lab/index.html        the laboratory
├─ assets/               hashed JS and CSS (cache forever)
├─ favicon.svg
├─ _headers              caching and security headers
└─ _redirects            SPA fallback
```

`public/_headers` already sets:

- `Cache-Control: immutable` for `/assets/*` (they are content-hashed);
- `no-cache` for `index.html` (so a deploy reaches the browser);
- `X-Content-Type-Options`, `Referrer-Policy` and `X-Frame-Options`.

---

## 4. Checking a deployment

```powershell
curl -I https://your-domain/
curl -I https://your-domain/lab/
curl -I https://your-domain/assets/     # should be 404
```

Look for:

- `200` on both pages;
- `cache-control: immutable` on the hashed assets;
- `cache-control: no-cache` on `index.html`.

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 404 on `/lab/` | the output directory is wrong | set it to `dist` |
| The build fails on the Node version | Vite 8 needs Node ≥ 22.12 | add `NODE_VERSION=22` |
| The old version is still showing | `index.html` was cached | `_headers` already sets `no-cache` for it; hard-reload once |
| A blank page and a red console error | the browser is too old for the ES module build | check the browser version — Chrome 89+, Safari 16.4+, Firefox 108+ |
| `Failed to load module` | a proxy stripped the JS | check `_redirects`; `/* /index.html 200` must not swallow `/assets/*` |

---

## 6. Deploying by hand instead of from Git

```powershell
npm run build
npx wrangler pages deploy dist --project-name=<project>
```

Useful for checking a build before it is pushed.
