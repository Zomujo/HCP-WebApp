# Deploy runbook

How to deploy the HCP web app to a VPS with Docker, written so that someone who has never done it can. It follows the same layout as the DNH API's runbook (`deploy/RUNBOOK.md` in `dnh-server`), and both can run on the same VPS. Staging and production run side by side; set up only production if staging isn't needed.

| | Staging | Production |
|---|---|---|
| Built from | `staging` branch | `master` branch |
| Listens on (VPS loopback) | `127.0.0.1:3001` | `127.0.0.1:3000` |
| Container | `hcp-web-staging` | `hcp-web-production` |
| Settings file | `/opt/hcp-web/.env.staging` | `/opt/hcp-web/.env.production` |
| Image | `hcp-web:staging` → `hcp-web:staging-<sha>` | `hcp-web:production` → `hcp-web:production-<sha>` |
| Calls | the staging API | the production API |

```
 health worker's browser
   │ HTTPS                                  │ HTTPS (API calls, straight from the browser)
   ▼                                        ▼
 reverse proxy on the VPS ───────────► reverse proxy for the API
   │ http://127.0.0.1:3000 / :3001          │ http://127.0.0.1:4815 / :4816
   ▼                                        ▼
 hcp-web-<env>  (serves pages only)     dnh-api-<env>
```

The web server only serves pages and scripts. Every data call goes from the browser straight to the API, so the web container needs no database, secrets or network access to the API.

**Settings are baked in at build time.** The app's two settings (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) are written into the browser bundle when the image is built. Changing one takes a new deploy, not a restart, and rolling back brings back the settings the old image was built with. They are visible to anyone who opens the site, so they are not secrets and no secret may be added.

Everything lives in one directory on the VPS:

```
/opt/hcp-web/                    root:root 755
├── deploy.sh                    755  builds and swaps the site     (from deploy/deploy.sh)
├── compose.yml                  644  runs the containers           (from deploy/compose.yml)
├── deploy.conf                  644  optional: REPO=<git url>
├── .env.staging                 600  staging build settings        (from deploy/.env.example)
├── .env.production              600  production build settings
└── .deploy.lock                      stops two deploys running at once
```

---

## 1. Prerequisites

### On the VPS

The same as for the API: Linux (Ubuntu 22.04/24.04 or Debian 12), Docker Engine 25+, the Compose plugin 2.24+, `git`, `flock`, a reverse proxy with TLS, and a firewall with only 22, 80 and 443 open. Docker's published ports bypass `ufw`, which is why the containers publish on `127.0.0.1` only.

The build downloads npm packages and the Inter font from Google Fonts, so the VPS needs outbound internet while it builds. About 2 GB of free memory is enough for the build.

### Access

| What | Why |
|---|---|
| SSH to the VPS with `sudo` | `deploy.sh` and `docker compose` need root |
| Read access to the GitHub repository | the VPS clones it on every deploy (section 7.1) |

### Things that must agree with the API

| Here | Must match |
|---|---|
| `NEXT_PUBLIC_API_URL` | The public `https://` address of the same environment's API. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | One of the IDs in that API's `GOOGLE_CLIENT_ID`. |
| This site's `https://` address | Listed in that API's `CORS_ORIGINS`, and in the Google OAuth client's "Authorized JavaScript origins" (Google Cloud console → APIs & Services → Credentials). |

If the site's address is missing from the Google client's origins, the Google sign-in button fails; email sign-in still works. While the API's `CORS_ORIGINS` is empty it accepts any origin; once it is set, it must include this site.

---

## 2. Before every deploy: what is going out

```bash
git fetch --prune origin
git log --oneline <live sha>..origin/staging      # staging; origin/master for production
```

The live sha is in the image tag: on the VPS, `sudo docker image ls hcp-web` lists `production-<sha>` and the `production` tag shares its IMAGE ID.

| Look for | What to do |
|---|---|
| A new key in `deploy/.env.example` | Add it to `/opt/hcp-web/.env.<env>` first (section 5). |
| Changes to `deploy/compose.yml` or `deploy/deploy.sh` | Copy them to the VPS first (section 6). |
| New API endpoints the pages call | Deploy the API first. |

---

## 3. Deploy

### Staging

```bash
ssh <you>@<vps>
sudo bash /opt/hcp-web/deploy.sh staging
```

It checks the settings file, clones `staging`, builds `hcp-web:staging-<sha>` for the API in the settings file, swaps the container and waits for it to report healthy. A good run ends with:

```
web-staging is healthy on hcp-web:staging-<sha>, serving 127.0.0.1:3001.
```

### Production

Production only gets what staging has proven, when staging exists. Merge `staging` into `master` through a PR, then:

```bash
sudo bash /opt/hcp-web/deploy.sh production
```

It prints the commit and the API it builds for, then asks `Deploy <sha> to production (127.0.0.1:3000)? [y/N]`; answer `y`.

### What happens on a failure

| Fails at | Effect |
|---|---|
| Settings check | Lists every problem, deploys nothing. |
| Clone or `docker build` | The running site is untouched. |
| New container not healthy within 90s | Prints its last health checks and log lines and the rollback command. Roll back to restore service. |

The swap restarts the container in place, so the site is down for a few seconds. People already signed in stay signed in: their session lives in the browser.

### Rolling back

```bash
sudo bash /opt/hcp-web/deploy.sh <staging|production> --rollback <7-char sha>
```

It re-points the site at a kept image (the five newest per environment are kept) and never builds. The settings come back with it: each image is labelled with the API it was built for (`sudo docker image inspect --format '{{index .Config.Labels "hcp-web.api-url"}}' hcp-web:production-<sha>`).

---

## 4. Verify

```bash
W=http://127.0.0.1:3000                     # 3001 for staging; or the public https:// address
curl -s -o /dev/null -w "%{http_code}\n" "$W/login"     # 200, the page the container checks
curl -sI "$W/login" | grep -i x-frame-options           # DENY
```

Then in a browser, on the public address:

1. The sign-in page loads, with the logo.
2. Email sign-in works for a test account, and the dashboard lists that account's data.
3. The browser's developer tools (Network) show the calls going to this environment's API address.
4. The Google button signs in (if it says the origin isn't allowed, see section 1).

On the VPS:

```bash
sudo docker compose -f /opt/hcp-web/compose.yml ps        # healthy
sudo docker logs --since 10m hcp-web-production 2>&1 | tail
```

Report what went out: the image tag and commit sha, the PRs, any setting changed, and each check with its result.

---

## 5. Changing a setting

1. Edit the master copy.
2. Upload it and put it in place:

   ```bash
   scp -p .env.production <you>@<vps>:env.upload
   ssh -t <you>@<vps> 'sudo install -o root -g root -m 600 ~/env.upload /opt/hcp-web/.env.production && rm ~/env.upload'
   ```

3. Deploy again (section 3). A restart is not enough: the settings are in the image.

---

## 6. Updating `compose.yml` or `deploy.sh` on the VPS

After a merged change to either, from a checkout of the branch you deploy:

```bash
scp deploy/compose.yml deploy/deploy.sh <you>@<vps>:
ssh -t <you>@<vps> '
  sudo install -o root -g root -m 644 ~/compose.yml /opt/hcp-web/compose.yml &&
  sudo install -o root -g root -m 755 ~/deploy.sh   /opt/hcp-web/deploy.sh &&
  rm ~/compose.yml ~/deploy.sh'
```

A changed `compose.yml` takes effect on the next deploy, or now with `sudo docker compose -f /opt/hcp-web/compose.yml up -d web-<env>`.

---

## 7. Setting up the VPS (one time)

### 7.1 Directory and repository access

```bash
sudo install -d -o root -g root -m 755 /opt/hcp-web
```

The VPS clones the repository as root with its own read-only deploy key (GitHub allows a deploy key on one repository only, so this is a second key next to the API's):

```bash
sudo ssh-keygen -t ed25519 -N '' -C hcp-web-vps -f /root/.ssh/hcp-web
sudo cat /root/.ssh/hcp-web.pub
```

Add the public key on GitHub: repository → Settings → Deploy keys → Add, **without** write access. Then:

```bash
sudo tee -a /root/.ssh/config >/dev/null <<'EOF'
Host github.com-hcp-web
  HostName github.com
  User git
  IdentityFile /root/.ssh/hcp-web
  IdentitiesOnly yes
EOF
sudo ssh -T git@github.com-hcp-web        # "successfully authenticated", answer yes to the host key
```

`deploy.sh` clones `git@github.com-hcp-web:Zomujo/HCP-WebApp.git`. To deploy from another repository (a fork), put its URL in `/opt/hcp-web/deploy.conf` (root, 644), using the same host alias:

```bash
echo 'REPO=git@github.com-hcp-web:<owner>/HCP-WebApp.git' | sudo tee /opt/hcp-web/deploy.conf
```

### 7.2 Files

Copy `compose.yml` and `deploy.sh` as in section 6. Fill in `.env.<env>` from `deploy/.env.example` and upload it as in section 5.

### 7.3 First deploy

Deploy the API first, so its public address exists. Then:

```bash
sudo bash /opt/hcp-web/deploy.sh staging        # or production
```

Run the checks in section 4.

---

## 8. Reverse proxy

The site listens on the VPS's loopback only. Put one of these in front, with TLS:

**nginx** (with a certificate from certbot):

```nginx
server {
    listen 443 ssl http2;
    server_name hcp.example.gov.gh;
    # ssl_certificate / ssl_certificate_key from certbot
    add_header Strict-Transport-Security "max-age=31536000" always;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Caddy** (gets its own certificate):

```
hcp.example.gov.gh {
    header Strict-Transport-Security "max-age=31536000"
    reverse_proxy 127.0.0.1:3000
}
```

**Cloudflare Tunnel**: route the public hostname to `http://127.0.0.1:3000`.

Then add `https://hcp.example.gov.gh` to the API's `CORS_ORIGINS` and to the Google client's authorized origins (section 1).

---

## 9. Gotchas

- **Always use `sudo` on the VPS** for `deploy.sh` and `docker compose`.
- **A staging site must call the staging API.** `deploy.sh` refuses two settings files with the same `NEXT_PUBLIC_API_URL`, and the build refuses a missing one rather than fall back to some default.
- **`http://` APIs don't work from an `https://` site**: browsers block the calls. `deploy.sh` requires `https://`.
- **Changing a setting needs a deploy** (section 5), and a rollback restores the old one.
- **The container's filesystem is read-only.** The site writes nothing to disk; nothing needs backing up here.
- **Logs** are rotated by Docker (5 × 10 MB per container). The site logs little: errors from API calls show up in the user's browser console, and on the API's side.
