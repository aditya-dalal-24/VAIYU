# Deploying VAIYU

One Linux server, Docker Compose, HTTPS handled automatically. This is the
simplest production setup that is actually safe: one public address, secrets
outside the repository, and nothing but the web server reachable from the
internet.

```text
internet ──443──▶ Caddy ──/api/*──▶ Spring Boot ──▶ PostgreSQL
                    │                    └──────▶ AI service (private)
                    └────────/*────▶ console (Node SSR)
```

**Honest status:** the compose files are validated and each service's build
output has been run by hand, but the Docker images have not been built end to
end yet. Step 5 is the first time they are. If a build fails there, that is a
real defect to report, not a setup mistake on your part.

---

## What you need

| | |
| --- | --- |
| A server | Ubuntu 22.04 or 24.04, **4 GB RAM minimum**, 2 vCPU, 30 GB disk. Any provider: DigitalOcean, Hetzner, AWS Lightsail, Azure, a college server. |
| A domain | Any name you control, e.g. `vaiyu.example.com`. A subdomain is fine. |
| Your laptop | The trained checkpoints and the observation table, which are not in git. |

4 GB is the real floor: PostgreSQL, the JVM, PyTorch and the Node server run at
once, and on this development machine processes were killed at around 2 GB free.

---

## 1. Point the domain at the server

At your DNS provider, create an **A record**:

| Type | Name | Value |
| --- | --- | --- |
| A | `vaiyu` (or `@` for the bare domain) | the server's public IPv4 address |

Wait until `ping vaiyu.example.com` answers with that IP. Caddy cannot obtain a
certificate before the name resolves.

## 2. Prepare the server

```bash
ssh your-user@your-server-ip

# Docker and the compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit            # log out and back in so the group applies
ssh your-user@your-server-ip

# Firewall: only SSH and web traffic
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 3. Get the code and the data onto it

On the server:

```bash
git clone <your-repository-url> vaiyu
cd vaiyu
git checkout AdityaDalal
```

The models and the archive are not in git. Copy them **from your laptop** — run
this on the laptop, from the repository root:

```bash
scp -r ai-service/checkpoints            your-user@your-server-ip:~/vaiyu/ai-service/
scp    ai-service/data/processed/observations.csv \
                                        your-user@your-server-ip:~/vaiyu/ai-service/data/processed/
```

(`ai-service/data/processed/` may need creating first: `mkdir -p` it on the server.)

## 4. Set the secrets

On the server, in `~/vaiyu`:

```bash
cp deploy/.env.example .env
openssl rand -hex 32     # run twice, one value for each secret below
nano .env
```

Fill in all three:

```properties
VAIYU_DOMAIN=vaiyu.example.com
VAIYU_DB_PASSWORD=<first random value>
VAIYU_ADMIN_TOKEN=<second random value>
```

Keep the admin token somewhere safe — it is what lets you load or reload the
archive. If any of the three is missing, the next step refuses to start and
names the one that is missing.

## 5. Build and start

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The first build takes 10–20 minutes, mostly PyTorch. Watch it come up:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Wait until `vaiyu-backend` and `vaiyu-ai` show `healthy`.

## 6. Load the archive

```bash
source .env
curl -X POST -H "X-Admin-Token: $VAIYU_ADMIN_TOKEN" \
  https://$VAIYU_DOMAIN/api/internal/ingest/ibtracs
```

Expect roughly 30 seconds and a reply with `"storms":4450`,
`"observations":111960` and `"malformedRows":0`.

## 7. Check it

- Open `https://vaiyu.example.com` — Mission Control with the storm list.
- `https://vaiyu.example.com/system` should report **3 of 4 models loaded**.
  (Satellite is the fourth, and stays unavailable until it is trained.)
- Open any storm, open the Prediction Lab, and run a forecast.

---

## Day-to-day

| Task | Command (in `~/vaiyu`) |
| --- | --- |
| See logs | `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend` |
| Restart | `docker compose -f docker-compose.yml -f docker-compose.prod.yml restart` |
| Deploy new code | `git pull` then the step 5 command again |
| New checkpoints | copy them as in step 3, then `... restart ai-service` |
| Back up the database | `docker exec vaiyu-db pg_dump -U postgres vaiyu > vaiyu-$(date +%F).sql` |

Back up the database before any upgrade. Forecast runs and satellite analyses
live only there; the archive itself can always be re-ingested.

## If something is wrong

| Symptom | Likely cause |
| --- | --- |
| Browser shows a certificate error | DNS did not point at the server when Caddy started. Fix DNS, then `restart caddy`. |
| `required variable ... is missing` | That line in `.env` is empty. |
| Storm list is empty | Step 6 has not been run, or returned an error. |
| Ingest returns 401 | The token in the header does not match `.env`. |
| Ingest returns 403 | `VAIYU_ADMIN_TOKEN` is unset or shorter than 24 characters. |
| System shows 0 models | `ai-service/checkpoints/` was not copied (step 3). |
| Containers restarting repeatedly | The server is out of memory; check with `free -h`. |
