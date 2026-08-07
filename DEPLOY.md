# Deploying

Node process on `127.0.0.1:8008`, managed by PM2, behind nginx.

---

## 1. Server prerequisites

```bash
# Node 18.18+ (20 LTS recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git

node -v && nginx -v
```

## 2. Get the code

```bash
sudo mkdir -p /var/www && sudo chown "$USER":"$USER" /var/www
cd /var/www
git clone <your-repo> portfolio && cd portfolio
```

## 3. Configure

```bash
cp .env.example .env.local
nano .env.local
```

Everything is optional — the site boots with an empty file. What each one unlocks:

| variable | unlocks |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | correct canonical tags, sitemap and OG URLs |
| `ANTHROPIC_API_KEY` | synthesised answers on `/ask`, résumé extraction in `/admin` |
| `ADMIN_EMAIL` + `ADMIN_PASSWORD` | creates the first admin account on first start; without them `/admin` cannot be opened |
| `ADMIN_SECRET` | signs session tokens for both the browser cookie and the mobile bearer token — long and random, changing it logs everyone out |
| `GITHUB_USERNAME` | `/proof` — the receipts page |
| `GITHUB_TOKEN` | raises GitHub from 60 to 5,000 req/hr. **Grant it zero scopes** |
| `MONGODB_URI` | **all content** — profile, projects, decisions, experience, skills, routine, résumé history — plus check-ins and the answer cache move to Mongo |
| `PORTFOLIO_REPO` | the repo shown in the footer card |

`.env.local` is read automatically by `next start`. Never put secrets in
`ecosystem.config.cjs` — that file is committed.

```bash
chmod 600 .env.local
```

## 4. One-time PM2 setup

```bash
./deploy/setup-server.sh
```

Installs PM2 globally, configures log rotation (10MB × 14, compressed, daily),
and prints the `sudo env PATH=...` line that enables start-on-boot. Run that
line, then continue.

## 5. Deploy

```bash
./deploy/deploy.sh          # build from the working tree
./deploy/deploy.sh --pull   # git pull first
```

The script installs, typechecks, **builds, and only then reloads** — a broken
build leaves the running site untouched. It finishes by polling
`/api/health` and printing the real status:

```
→ up on 127.0.0.1:8008 — status=ok store=file degraded=[] unconfigured=[llm.credential]
```

Roll back with `./deploy/rollback.sh`.

## 6. nginx

**Before DNS/TLS exist** — get it reachable by IP:

```bash
sudo cp deploy/nginx-http-only.conf /etc/nginx/sites-available/portfolio
sudo ln -sf /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**Once DNS points at the box:**

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/portfolio
sudo sed -i 's/igaurav\.dev/YOURDOMAIN.com/g' /etc/nginx/sites-available/portfolio
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOURDOMAIN.com -d www.YOURDOMAIN.com
sudo nginx -t && sudo systemctl reload nginx
```

Certbot writes the certificate paths the config already references.

### Three settings that will bite you if you change them

**`client_max_body_size 10M`** — nginx defaults to 1MB. Résumé uploads are
capped at 8MB in the app, so the default rejects them with a 413 before Node
ever sees the file.

**`X-Forwarded-For`** — `lib/ratelimit.ts` reads this header to identify a
visitor. Drop it and every visitor on earth shares one token bucket.

**`proxy_read_timeout 120s` on `/api/admin/`** — résumé extraction sends a PDF
to Claude and legitimately runs for up to a minute. nginx's 60s default cuts it
off mid-flight.

### Locking down the admin

Uncomment the `allow`/`deny` lines in the `/admin` and `/api/admin/` blocks and
put your own IP in. The panel is already password-gated with a signed cookie and
rate-limited login, but there's no reason to expose it to the internet at all.

## 7. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Port 8008 stays closed — the app binds to `127.0.0.1` only, so it is
unreachable from outside regardless.

---

## Why one PM2 instance

`ecosystem.config.cjs` sets `instances: 1` and `exec_mode: "fork"`. That is
deliberate. Three things live in the memory of a single process:

- **`lib/trace.ts`** — request traces. The strip at the bottom of every page
  fetches `/api/trace?id=…` after render. With two workers, half those calls
  land on the process that didn't render the page and the strip honestly
  reports "trace not retained on this instance".
- **`lib/ratelimit.ts`** — the per-visitor token bucket and daily spend meter.
  Two workers means two buckets, so the effective rate limit doubles and the
  spend ceiling stops meaning anything.
- **`lib/semantic-cache.ts`** — the in-process half of the answer cache. Split
  it and the hit rate halves, which costs real money.

One Node process handles this comfortably: a page render is ~15ms and almost
entirely I/O. To scale out later, move those three stores to Redis (or Mongo,
already wired for the cache), then raise `instances` and switch to `cluster`.

**The cost:** a deploy restarts that process, so there is roughly a one-second
gap. The nginx config softens it with `proxy_next_upstream` retries and
`max_fails=0`, which makes it invisible for most requests but not all. If you
need genuinely zero-downtime deploys, run blue/green — a second PM2 app on 8009,
both in the upstream block, restarted one at a time.

## Operating it

```bash
pm2 status                  # is it up
pm2 logs portfolio          # tail
pm2 monit                   # live cpu/memory
pm2 describe portfolio      # restarts, uptime, memory
curl -s localhost:8008/api/health | jq
```

`/status` in a browser gives you the same picture plus p50/p95/p99 from real
traffic, cache hit rate, spend against the daily budget, and which storage
backend is actually live.

### The first admin

On startup the server checks for an admin account. If the store is empty and
`ADMIN_EMAIL` / `ADMIN_PASSWORD` are set, it creates one and logs it:

```
[admin] created the first admin from ADMIN_EMAIL / ADMIN_PASSWORD — you@example.com
```

Passwords are PBKDF2-hashed; nothing readable is ever written. Change the password
from the Account page afterwards — the environment values are only a bootstrap, and
once changed they stop working.

If an account already exists the bootstrap is a no-op, so redeploying never resets
your credentials. Lost the password? Delete the `admins` collection (or
`data/admins.json`) and restart; it rebuilds from the environment.

### Mobile app

`mobile/` is a Flutter client for the same API. Point it at your server, sign in
with the same credentials, and it gets a 30-day bearer token. See
`mobile/README.md`. Nothing extra is needed server-side — `/api/admin/*` already
accepts `Authorization: Bearer` alongside the cookie.

### Moving content into MongoDB

Without `MONGODB_URI` everything lives in `content/*.json`, which works but means
admin edits have to be committed to git or the next `git pull` overwrites them.

With it set, the collections **seed themselves from those files on first read**, so
there is nothing to run — a fresh database comes up populated. If you want to force it,
`/admin` → Overview → **Import JSON → MongoDB**. Same page has **Export everything as
JSON** to pull the database back out for backup or to commit.

After that the database is the source of truth and the JSON files are just seed data.
Back the database up with `mongodump`, not by copying `content/`.

Two failure modes, both handled: an unreachable Mongo falls back to reading the JSON
files rather than serving an empty site, and `/api/health` reports `degraded` with the
real connection error instead of pretending.

### Writable directories

PM2 on a real box means `data/` is writable, which serverless hosting doesn't
give you. That's what makes the admin panel fully functional here: résumé
uploads land in `data/uploads/`, content edits write straight to `content/*.json`,
and check-ins persist to `data/checkins.json` when Mongo isn't configured.

Back these up — they are the only state that isn't in git:

```bash
tar czf ~/portfolio-data-$(date +%F).tar.gz data/ content/ .env.local
```

## Updating content in production

Two routes, and they don't conflict:

1. **Through `/admin`** — writes to `content/*.json` on the server, live on the
   next request, no rebuild. Copy the files back into git afterwards or the next
   `git pull` overwrites them.
2. **Through git** — edit locally, commit, `./deploy/deploy.sh --pull`.

If you use the admin regularly, pull the JSON down periodically:

```bash
scp user@server:/var/www/portfolio/content/*.json ./content/
```
