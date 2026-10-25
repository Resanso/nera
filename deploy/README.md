# Deploy

Zero-downtime (blue/green) deploy on the VPS:

```
ssh mentio-vps 'cd ~/nera && deploy/deploy.sh'
```

- `infra.yml` (project `nera-infra`): Postgres (`nera-db`) and the `worker`
  (inbound SMTP on port 25 + Gmail sync scheduler). Not restarted by app deploys
  except the worker, which picks up the new image (mail servers retry briefly).
- `app.yml` (projects `nera-blue` / `nera-green`): web + api. The idle slot gets the
  new build, must pass health checks, then nginx's `nera_web` / `nera_api` upstreams
  (`/etc/nginx/conf.d/nera-upstream.conf`) are switched with a graceful reload and the
  old slot is stopped.
- Rollback: `TAG=<previous> ` images are kept (last 3); re-point the upstream or
  check out the previous commit and run `deploy/deploy.sh --no-pull`.
- Secrets and settings live in `~/nera/.env.deploy` (see `.env.example`), including
  `PUBLIC_URL`, `MAIL_HOST`, `NERA_DB_PASSWORD`, `ADMIN_EMAILS`.
