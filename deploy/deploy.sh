#!/usr/bin/env bash
# Zero-downtime deploy (blue/green) for the Nera web + api.
#
#   deploy/deploy.sh            pull, build, start the idle slot, health-check, switch nginx, stop the old slot
#   deploy/deploy.sh --no-pull  deploy the current checkout
#
# Prod keeps serving from the active slot until the new one is healthy; a failed
# health check removes the new slot and leaves prod untouched.
set -euo pipefail
cd "$(dirname "$0")/.."

[ "${1:-}" = "--no-pull" ] || git pull --ff-only -q
set -a; . ./.env.deploy; set +a
: "${PUBLIC_URL:?set PUBLIC_URL in .env.deploy}" "${MAIL_HOST:?set MAIL_HOST in .env.deploy}"

export TAG
TAG="$(git rev-parse --short HEAD)"
UPSTREAM=/etc/nginx/conf.d/nera-upstream.conf
STATE=deploy/.active
compose() { docker compose --env-file .env.deploy "$@"; }

echo "==> build $TAG"
docker build -q --target web -t "nera-web:$TAG" . >/dev/null
docker build -q --target api -t "nera-api:$TAG" . >/dev/null

docker network inspect nera-net >/dev/null 2>&1 || docker network create nera-net >/dev/null
compose -f deploy/infra.yml up -d --wait db

ACTIVE="$(cat "$STATE" 2>/dev/null || echo none)"
if [ "$ACTIVE" = blue ]; then NEXT=green; WEB_PORT=3101; API_PORT=4101; else NEXT=blue; WEB_PORT=3100; API_PORT=4100; fi
export WEB_PORT API_PORT

echo "==> start $NEXT (web :$WEB_PORT, api :$API_PORT)"
compose -p "nera-$NEXT" -f deploy/app.yml up -d --force-recreate

healthy=""
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1 && curl -fsS -o /dev/null "http://127.0.0.1:$WEB_PORT/" 2>/dev/null; then
    healthy=1; break
  fi
  sleep 2
done
if [ -z "$healthy" ]; then
  echo "!! $NEXT failed its health check; prod stays on $ACTIVE" >&2
  compose -p "nera-$NEXT" -f deploy/app.yml logs --tail 40 >&2 || true
  compose -p "nera-$NEXT" -f deploy/app.yml down
  exit 1
fi

echo "==> switch nginx to $NEXT"
printf 'upstream nera_web { server 127.0.0.1:%s; }\nupstream nera_api { server 127.0.0.1:%s; }\n' "$WEB_PORT" "$API_PORT" | sudo tee "$UPSTREAM" >/dev/null
sudo nginx -t -q && sudo systemctl reload nginx
echo "$NEXT" > "$STATE"

echo "==> worker (smtp + scheduler)"
compose -f deploy/infra.yml up -d worker

if [ "$ACTIVE" != none ]; then
  # let in-flight requests on the old slot finish before stopping it
  sleep 15
  echo "==> stop $ACTIVE"
  compose -p "nera-$ACTIVE" -f deploy/app.yml down
fi

# keep the last 3 builds for quick rollback
for repo in nera-web nera-api; do
  docker images "$repo" --format '{{.CreatedAt}}\t{{.Tag}}' | sort -r | tail -n +4 | cut -f2 | xargs -r -I{} docker rmi -f "$repo:{}" >/dev/null || true
done
# each build leaves cache and untagged layers behind; a full disk breaks the next deploy
docker image prune -f >/dev/null || true
docker builder prune -f --filter until=24h >/dev/null 2>&1 || true
echo "==> live: $NEXT ($TAG)"
