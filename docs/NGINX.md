# Serving the EMR app with Nginx (frontend + backend)

How to put **Nginx** in front of the Next.js frontend and the Flask backend so both
are reachable from one origin.

Written for **Windows** (the portable nginx you downloaded) with Linux/production
notes where they differ.

---

## 1. What nginx is doing here

The frontend is a Next.js app that contains a **Backend-for-Frontend (BFF)**. The
browser only ever talks to the Next server; the Next server is what talks to Flask.

```text
                        ┌─────────────────────────────────────────┐
  browser  ────────►    │  nginx  :80 / :443                      │
                        │                                         │
                        │   /            ─────────►  Next.js :3000│
                        │   /api/*       ─────────►  Next.js :3000│  (the BFF)
                        │   /api/v1/*    ─────────►  Flask  :5000 │  (optional)
                        │   /docs        ─────────►  Flask  :5000 │  (optional)
                        └─────────────────────────────────────────┘
                                        Next.js :3000 ──► Flask :5000
                                                     (server-to-server,
                                                      FLASK_API_BASE_URL)
```

**The one rule that matters:**

| Path | Belongs to | Why |
| --- | --- | --- |
| `/`, `/login`, `/_next/*` | **Next.js** | the UI |
| `/api/*` (e.g. `/api/patients`, `/api/auth/login`) | **Next.js** | the BFF route handlers |
| `/api/v1/*` (e.g. `/api/v1/health`) | **Flask** | the raw JSON API (optional exposure) |
| `/docs`, `/docs/openapi.json` | **Flask** | OpenAPI UI + spec (optional exposure) |

The browser **never** calls `/api/v1/*` — it calls `/api/<resource>` and Next maps
that to Flask's `/api/v1/<resource>`. So if you forward `/api/` to Flask you break
login, refresh and every screen. Forward **only `/api/v1/`** if you want the raw
API public.

---

## 2. Prerequisites

- **Node.js 20+** and this repo (`emr-frontend`).
- **Python 3.11+** with the API virtualenv (`emr-api/.venv`).
- **PostgreSQL** running (the API needs it).
- **nginx for Windows** (the folder in your Downloads, e.g.
  `nginx-1.27.x.zip`). Portable, no installer.

---

## 3. Start the two apps first

Nginx is only a proxy — bring up the real services before pointing at them.

### 3a. Next.js (port 3000)

```powershell
cd C:\Users\DAN\Desktop\emr-frontend

# one-time
Copy-Item .env.example .env.local     # then edit .env.local
npm ci
npm run build

# run (next start sets NODE_ENV=production for you)
npm start -- -p 3000
```

`.env.local` must contain:

```dotenv
FLASK_API_BASE_URL=http://127.0.0.1:5000
SESSION_SECRET=<generate: openssl rand -base64 32>
```

> These are **server-side only**. Never prefix them with `NEXT_PUBLIC_`, or they
> get inlined into the browser bundle.

For a quick dev run instead of a production build, use `npm run dev` (also :3000,
but it needs the websocket upgrade headers — see §5).

### 3b. Flask (port 5000)

**Windows:**

```powershell
cd C:\Users\DAN\Desktop\emr-api\emr-api
.venv\Scripts\Activate.ps1
flask db upgrade          # apply migrations once
python app.py             # Werkzeug, http://127.0.0.1:5000
```

> **gunicorn does not run on Windows** (it is POSIX-only). Use `python app.py`, or
> a Windows-capable WSGI server such as `waitress-serve --port=5000 app:app`.

**Linux / production:**

```bash
cd emr-api
gunicorn --workers 3 --bind 127.0.0.1:5000 'app:create_app()'
```

Confirm both are up before touching nginx:

```powershell
curl.exe http://127.0.0.1:3000/login      # Next
curl.exe http://127.0.0.1:5000/api/v1/health   # Flask -> {"data":{"status":"ok"}}
```

---

## 4. Run the portable nginx on Windows

```powershell
# 1) Extract the zip you downloaded (adjust the version)
cd $env:USERPROFILE\Downloads
Expand-Archive .\nginx-1.27.0.zip -DestinationPath C:\
# -> now C:\nginx-1.27.0\

# 2) Give it a stable, space-free path
Rename-Item C:\nginx-1.27.0 C:\nginx

# 3) Always run it from its own folder (Config/Logs are relative to it)
cd C:\nginx
.\nginx.exe -v            # nginx version: nginx/1.27.0
```

Commands you will use (run them from `C:\nginx`):

| Action | Command |
| --- | --- |
| Test the config | `.\nginx.exe -t` |
| Start (background) | `start nginx` |
| Reload after editing | `.\nginx.exe -s reload` |
| Stop gracefully | `.\nginx.exe -s stop` |
| Force stop | `taskkill /F /IM nginx.exe` |

Config lives at `C:\nginx\conf\nginx.conf`; logs at `C:\nginx\logs\`.

> Windows nginx is fine for a demo/interview box but is **not** a production
> target. For real deployments use Linux + systemd (sketch in §9).

---

## 5. The nginx config

Replace `C:\nginx\conf\nginx.conf` with the file below (or paste the `upstream` +
`server` blocks into the `http { … }` of an existing config — the `map` must also
be directly inside `http {}`, not inside `server {}`).

```nginx
worker_processes  1;                 # Windows: keep it at 1
error_log  logs/error.log warn;
pid        logs/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    keepalive_timeout  65;

    # Sendfile is a Linux optimisation; not supported on Windows.
    # sendfile  on;

    client_max_body_size 2m;

    # Lets the Next dev server's HMR websocket upgrade. `next start` does not
    # need it, but it is harmless there.
    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }

    upstream emr_next  { server 127.0.0.1:3000; }
    upstream emr_flask { server 127.0.0.1:5000; }

    server {
        listen       80;
        server_name  emr.local localhost;

        access_log logs/emr.access.log;
        error_log  logs/emr.error.log warn;

        # ---- Everything the browser uses: pages AND the /api BFF -> Next.js ----
        location / {
            proxy_pass         http://emr_next;
            proxy_http_version 1.1;
            proxy_set_header   Host              $host;
            proxy_set_header   X-Real-IP         $remote_addr;
            proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            # Pass a client-provided correlation id through to the API log line.
            proxy_set_header   X-Request-ID      $http_x_request_id;
            # Websocket upgrade (Next dev HMR).
            proxy_set_header   Upgrade           $http_upgrade;
            proxy_set_header   Connection        $connection_upgrade;
            proxy_read_timeout 300s;
        }

        # ---- Optional: expose Flask's raw API (note: /api/v1/, NOT /api/) ----
        location /api/v1/ {
            proxy_pass         http://emr_flask;   # URI is passed through unchanged
            proxy_http_version 1.1;
            proxy_set_header   Host              $host;
            proxy_set_header   X-Real-IP         $remote_addr;
            proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_set_header   X-Request-ID      $http_x_request_id;
        }

        # ---- Optional: Flask's Swagger UI + spec ----
        location /docs {
            proxy_pass         http://emr_flask;
            proxy_set_header   Host $host;
            proxy_set_header   X-Forwarded-Proto $scheme;
        }

        # Tiny liveness endpoint served by nginx itself.
        location = /nginx-health {
            add_header Content-Type text/plain;
            return 200 "ok\n";
        }
    }
}
```

### If you only want the app public (Flask fully private)

Delete the `/api/v1/` and `/docs` blocks. Next still reaches Flask at
`127.0.0.1:5000` directly, so everything keeps working — and the JSON API is not
reachable from outside at all. This is the safer default.

### Optional: pretty hostname

Add to `C:\Windows\System32\drivers\etc\hosts` (as Administrator):

```text
127.0.0.1  emr.local
```

Then browse `http://emr.local/`.

---

## 6. Reload and verify

```powershell
cd C:\nginx
.\nginx.exe -t          # expect: syntax is ok / test is successful
.\nginx.exe -s reload
```

Smoke tests (use `curl.exe`, not `curl`, in PowerShell — `curl` is an alias for
`Invoke-WebRequest`):

```powershell
curl.exe -I  http://localhost/                 # 200, served by Next
curl.exe -I  http://localhost/login            # 200, served by Next
curl.exe     http://localhost/api/v1/health    # Flask health (if /api/v1 exposed)
curl.exe -I  http://localhost/docs             # Swagger UI (if /docs exposed)
curl.exe     http://localhost/nginx-health     # ok
```

End-to-end: open `http://localhost/`, sign in as `admin` / `Demo@12345` (the seeded
demo user), and load the patient list. In the API console you should see one
access line per request, e.g.:

```text
INFO app: GET /api/v1/patients?page=1&per_page=20 -> 200 in 116ms (client=127.0.0.1, auth=yes, req=...)
```

---

## 7. Two-origin alternative (separate `api.` host)

If you would rather expose the API on its own hostname than under `/api/v1/`:

```nginx
server {
    listen 80;
    server_name api.emr.local;
    location / {
        proxy_pass http://emr_flask;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then add `127.0.0.1 api.emr.local` to `hosts`, and set Flask's
`CORS_ORIGINS=http://emr.local` in `emr-api/.env`. Note the app itself does **not**
need CORS — the BFF calls Flask server-to-server — so this is only for direct API
access from a browser.

---

## 8. TLS in production

The frontend marks the session cookie `Secure` when `NODE_ENV=production`, so the
public site **must** be HTTPS in production. Terminate TLS at nginx:

```nginx
server {
    listen 80;
    server_name emr.example.com;
    return 301 https://$host$request_uri;      # force HTTPS
}

server {
    listen 443 ssl;
    http2 on;
    server_name emr.example.com;

    ssl_certificate     /etc/nginx/ssl/emr.crt;
    ssl_certificate_key /etc/nginx/ssl/emr.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # ... same location blocks as §5 ...
}
```

- **Linux:** certificates via `certbot --nginx -d emr.example.com`.
- **Windows:** use `win-acme` (or terminate TLS at a load balancer / Cloudflare and
  keep nginx on plain :80 internally).
- Keep `X-Forwarded-Proto $scheme` so the app can build correct absolute URLs.

---

## 9. Running as a service (Linux sketch)

```ini
# /etc/systemd/system/emr-next.service
[Unit]
Description=EMR Next.js
After=network.target

[Service]
WorkingDirectory=/srv/emr-frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start -- -p 3000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/emr-api.service
[Unit]
Description=EMR Flask API
After=network.target postgresql.service

[Service]
WorkingDirectory=/srv/emr-api
EnvironmentFile=/srv/emr-api/.env
ExecStart=/srv/emr-api/.venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5000 'app:create_app()'
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

`systemctl daemon-reload && systemctl enable --now emr-next emr-api nginx`.

---

## 10. Gotchas specific to this project

1. **Do not proxy `/api/` to Flask.** `/api/*` is the Next BFF. Only `/api/v1/*`
   is Flask. Getting this wrong logs everyone out and breaks every screen.
2. **Port 5000 multi-bind on Windows.** Windows allows several processes to bind
   the same port (SO_REUSEADDR), so a stale Flask can silently sit behind a new
   one. Check with:
   `netstat -ano | findstr LISTENING | findstr :5000`
   and keep exactly one server running.
3. **Websocket upgrade is only needed for `npm run dev`.** If you proxy a dev
   server without the `Upgrade`/`Connection` headers, HMR hangs. `npm start` is
   fine either way.
4. **`X-Request-ID` passthrough** (already in the config) lets you correlate the
   browser call with the Flask access-log line. Nginx itself never needs any
   secret from either `.env`.
5. **Run nginx from its own directory** (`C:\nginx`) or use absolute paths for
   `include mime.types;` and the log/pid paths.
6. **Rate limiting** already exists in Flask (`RATELIMIT_*`). If you add nginx
   `limit_req`, keep the Flask one too — defense in depth, and the Flask rules
   distinguish `/auth/login` from general traffic.
7. **`client_max_body_size`** is small here (no uploads); raise it if that changes.
8. **Migrations:** run `flask db upgrade` before starting the API for the first
   time (the Docker image does this in its start command).

## 11. What NOT to do

- ❌ `location /api/ { proxy_pass http://emr_flask; }` — kills the BFF.
- ❌ `location / { proxy_pass http://emr_flask; }` — Flask cannot serve the pages.
- ❌ Exposing Flask and Next on the same path.
- ❌ Putting `SESSION_SECRET` / `SECRET_KEY` / `JWT_SECRET_KEY` in the nginx config
  or in any `NEXT_PUBLIC_*` variable — nginx never needs them, and public vars end
  up in the browser bundle.
