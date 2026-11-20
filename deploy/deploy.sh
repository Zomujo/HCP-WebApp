#!/usr/bin/env bash
# Builds and runs the HCP web app on the VPS. Copy it to /opt/hcp-web/deploy.sh
# and run it there as root:
#
#   deploy.sh staging                               staging branch -> :3001
#   deploy.sh production                            master         -> :3000
#   deploy.sh <staging|production> --rollback <sha>
#
# A deploy clones the environment's branch, builds hcp-web:<env>-<sha> with
# that environment's settings baked in, then points hcp-web:<env> at the new
# image and recreates only that environment's container. A failed build never
# touches the running site. A rollback re-points hcp-web:<env> at a kept image
# and never builds; the settings baked into that image come back with it.

set -euo pipefail

# HCP_WEB_DIR and HCP_WEB_REPO exist for testing the script away from the VPS.
# On the server, set the repository in $APP_DIR/deploy.conf instead
# (REPO=...), so that copying a new deploy.sh never resets it.
APP_DIR="${HCP_WEB_DIR:-/opt/hcp-web}"
REPO="git@github.com-hcp-web:Zomujo/HCP-WebApp.git"
if [ -f "$APP_DIR/deploy.conf" ]; then
  # shellcheck source=/dev/null
  . "$APP_DIR/deploy.conf"
fi
REPO="${HCP_WEB_REPO:-$REPO}"

COMPOSE_FILE="$APP_DIR/compose.yml"
LOCK_FILE="$APP_DIR/.deploy.lock"
IMAGE="hcp-web"
KEEP=5
HEALTH_TIMEOUT=90
BUILT_LABEL="hcp-web.built"
BUILD_KEYS=(NEXT_PUBLIC_API_URL NEXT_PUBLIC_GOOGLE_CLIENT_ID)

usage() {
  cat >&2 <<'USAGE'
Usage:
  deploy.sh staging
  deploy.sh production
  deploy.sh <staging|production> --rollback <sha>
USAGE
  exit 1
}

ENV_NAME="${1:-}"
ROLLBACK_SHA=""
case "$#" in
  1) ;;
  3) [ "$2" = "--rollback" ] || usage
     ROLLBACK_SHA="$3"
     [[ "$ROLLBACK_SHA" =~ ^[0-9a-f]{7}$ ]] || usage ;;
  *) usage ;;
esac

case "$ENV_NAME" in
  staging)
    BRANCH="staging"
    OTHER_ENV="production"
    ADDRESS="127.0.0.1:3001"
    ;;
  production)
    BRANCH="master"
    OTHER_ENV="staging"
    ADDRESS="127.0.0.1:3000"
    ;;
  *) usage ;;
esac
SERVICE="web-$ENV_NAME"
ENV_FILE="$APP_DIR/.env.$ENV_NAME"
OTHER_ENV_FILE="$APP_DIR/.env.$OTHER_ENV"

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another deploy is running (lock: $LOCK_FILE). Try again when it finishes." >&2
  exit 1
fi

WORK=""
cleanup() {
  if [ -n "$WORK" ]; then
    rm -rf "$WORK"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# The value of KEY in an env file: the last KEY= line, with one pair of
# surrounding quotes removed.
env_value() {
  local file="$1" key="$2" value
  value="$(sed -n "s/^$key=//p" "$file" | tail -n 1)"
  value="${value%$'\r'}"
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac
  printf '%s' "$value"
}

# Refuses a settings file that was written for the other environment or that
# would build a site pointing at the wrong API. Runs before anything is built.
check_env_file() {
  local mode key url problems=()
  if [ ! -f "$ENV_FILE" ]; then
    echo "$ENV_FILE is missing. Copy deploy/.env.example there and fill it in." >&2
    exit 1
  fi
  mode="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE")"
  [ "$mode" = "600" ] || problems+=("its mode is $mode; run chmod 600 $ENV_FILE")

  if grep -q '^[[:space:]]*export[[:space:]]' "$ENV_FILE"; then
    problems+=("remove the 'export ' prefix from every line (KEY=value only)")
  fi

  for key in "${BUILD_KEYS[@]}"; do
    [ -n "$(env_value "$ENV_FILE" "$key")" ] || problems+=("$key must be set")
  done

  # Browsers block an http:// API called from an https:// page, and the
  # build itself refuses a path or trailing slash.
  url="$(env_value "$ENV_FILE" NEXT_PUBLIC_API_URL)"
  if [ -n "$url" ] && ! [[ "$url" =~ ^https://[^/]+$ ]]; then
    problems+=("NEXT_PUBLIC_API_URL must be the API's https:// origin, with no path or trailing slash")
  fi

  # A staging site pointed at the production API would let testers change
  # real patients' records.
  if [ -n "$url" ] && [ -r "$OTHER_ENV_FILE" ] \
    && [ "$url" = "$(env_value "$OTHER_ENV_FILE" NEXT_PUBLIC_API_URL)" ]; then
    problems+=("NEXT_PUBLIC_API_URL is the same as in $OTHER_ENV_FILE; each environment calls its own API")
  fi

  if [ "${#problems[@]}" -gt 0 ]; then
    echo "$ENV_FILE is not ready, nothing was deployed:" >&2
    printf '  - %s\n' "${problems[@]}" >&2
    exit 1
  fi
}

confirm() {
  local answer=""
  printf 'Deploy %s to %s (%s)? [y/N] ' "$1" "$ENV_NAME" "$ADDRESS" >&2
  read -r answer || true
  if [ "$answer" != "y" ]; then
    echo "Nothing deployed."
    exit 0
  fi
}

# The <env>-<sha> tags of this environment, newest build first. The order comes
# from the BUILT_LABEL each build stamps, not from the image's Created time:
# BuildKit sets Created from the newest layer it ran, so once the runtime
# stage's layers are cached every later image reports the same Created.
kept_tags() {
  local tag
  docker image ls "$IMAGE" --format '{{.Tag}}' | grep "^$ENV_NAME-" \
    | while read -r tag; do
        printf '%s|%s\n' \
          "$(docker image inspect --format "{{index .Config.Labels \"$BUILT_LABEL\"}}" "$IMAGE:$tag")" "$tag"
      done | sort -r | cut -d'|' -f2 || true
}

# The <env>-<sha> tag the live <env> tag points at, if any.
live_tag() {
  local id
  id="$(docker image inspect --format '{{.Id}}' "$IMAGE:$ENV_NAME" 2>/dev/null)" || return 0
  docker image inspect --format '{{range .RepoTags}}{{println .}}{{end}}' "$id" \
    | grep "^$IMAGE:$ENV_NAME-" | head -n1 | sed "s|^$IMAGE:||" || true
}

release() {
  local tag="$1" previous="$2" container status waited=0
  docker tag "$IMAGE:$tag" "$IMAGE:$ENV_NAME"
  compose up -d --no-deps "$SERVICE"

  container="$(compose ps -q "$SERVICE")"
  echo "Waiting up to ${HEALTH_TIMEOUT}s for $SERVICE to report healthy..."
  while :; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container")"
    if [ "$status" = "healthy" ]; then
      echo "$SERVICE is healthy on $IMAGE:$tag, serving $ADDRESS."
      return 0
    fi
    if [ "$status" = "unhealthy" ] || [ "$waited" -ge "$HEALTH_TIMEOUT" ]; then
      break
    fi
    sleep 2
    waited=$((waited + 2))
  done

  echo "$SERVICE is not healthy after ${waited}s (status: $status)." >&2
  echo "Its last health checks:" >&2
  docker inspect --format '{{if .State.Health}}{{range .State.Health.Log}}  exit {{.ExitCode}}: {{.Output}}{{println}}{{end}}{{end}}' "$container" \
    | sed '/^[[:space:]]*$/d' | tail -n 3 >&2 || true
  echo "Its last log lines:" >&2
  docker logs --tail 20 "$container" 2>&1 | sed 's/^/  /' >&2 || true
  if [ -n "$previous" ] && [ "$previous" != "$tag" ]; then
    echo "The previous image is still kept. To go back: deploy.sh $ENV_NAME --rollback ${previous#"$ENV_NAME-"}" >&2
  fi
  exit 1
}

# Keeps the KEEP newest <env>-<sha> images, counting the live one, which is
# never removed.
prune() {
  local live tag count=0
  live="$(live_tag)"
  [ -n "$live" ] && count=1
  for tag in $(kept_tags); do
    [ "$tag" = "$live" ] && continue
    if [ "$count" -lt "$KEEP" ]; then
      count=$((count + 1))
    else
      docker image rm "$IMAGE:$tag" >/dev/null
      echo "Removed $IMAGE:$tag."
    fi
  done
  # A rebuild of a SHA that is already kept moves its tag to the new image and
  # leaves the old one untagged; build stages leave dangling cache images too.
  docker image prune -f --filter "label=$BUILT_LABEL" >/dev/null
}

PREVIOUS="$(live_tag)"

if [ -n "$ROLLBACK_SHA" ]; then
  # A kept image already has its settings baked in, so the settings file is
  # not checked: a rollback must work even while that file is being fixed.
  TAG="$ENV_NAME-$ROLLBACK_SHA"
  if ! docker image inspect "$IMAGE:$TAG" >/dev/null 2>&1; then
    KEPT="$(kept_tags | sed "s|^$ENV_NAME-||" | paste -sd' ' -)"
    echo "No $IMAGE:$TAG image on this machine. Kept: ${KEPT:-none}" >&2
    exit 1
  fi
  if [ "$ENV_NAME" = "production" ]; then
    confirm "$ROLLBACK_SHA (rollback)"
  fi
  release "$TAG" "$PREVIOUS"
  exit 0
fi

check_env_file

WORK="$(mktemp -d)"
git clone --quiet --depth 1 --single-branch --branch "$BRANCH" "$REPO" "$WORK/src"
FULL_SHA="$(git -C "$WORK/src" rev-parse HEAD)"
SHA="${FULL_SHA:0:7}"
echo "$BRANCH is at $(git -C "$WORK/src" log -1 --format='%h %s (%cd)' --date=format:'%Y-%m-%d %H:%M')"
echo "Building for API $(env_value "$ENV_FILE" NEXT_PUBLIC_API_URL)"

if [ "$ENV_NAME" = "production" ]; then
  confirm "$SHA"
fi

build_args=()
for key in "${BUILD_KEYS[@]}"; do
  build_args+=(--build-arg "$key=$(env_value "$ENV_FILE" "$key")")
done

TAG="$ENV_NAME-$SHA"
docker build \
  "${build_args[@]}" \
  --label "$BUILT_LABEL=$(date -u +%Y%m%dT%H%M%SZ)" \
  --label "org.opencontainers.image.revision=$FULL_SHA" \
  --label "hcp-web.api-url=$(env_value "$ENV_FILE" NEXT_PUBLIC_API_URL)" \
  -t "$IMAGE:$TAG" \
  "$WORK/src"

release "$TAG" "$PREVIOUS"
prune
