#!/usr/bin/env bash
# Проверка собранного образа, а не исходников: при noEmit сборки нет, образ
# исполняет TypeScript напрямую нодой, и ломается это только в production-
# установке. Так уже нашлось, что db/seeds.ts тянул @faker-js/faker из
# devDependencies и боевой запуск не поднимался вовсе.
set -euo pipefail

IMAGE="${IMAGE:-js-fastify-rest-api-example:smoke}"
PORT="${PORT:-3300}"
NAME="${NAME:-jfrae-smoke}"
BASE="http://127.0.0.1:${PORT}"

docker build -t "$IMAGE" .

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -p "${PORT}:3000" \
  -e JWT_SECRET=smoke-secret-not-for-production-0123456789 \
  "$IMAGE" >/dev/null
trap 'docker logs "$NAME" 2>&1 | tail -30; docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 60); do
  if curl -sf "$BASE/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! curl -sf "$BASE/health" >/dev/null 2>&1; then
  echo "контейнер не стал здоровым за 60 с" >&2
  exit 1
fi

# Обе версии и документация: именно они ломаются, если в образ не попали
# tsp-output или drizzle.
for path in /health /v1/courses /v1/openapi.json /v2/openapi.json /v2/courses; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")
  echo "$path -> $code"
  if [ "$code" != "200" ]; then
    echo "ожидался 200 на $path" >&2
    exit 1
  fi
done

# Авторизация должна работать и в образе, а не только в тестах.
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/v1/users")
echo "/v1/users без токена -> $code"
if [ "$code" != "401" ]; then
  echo "ожидался 401 на /v1/users без токена" >&2
  exit 1
fi

# В production сиды не применяются, поэтому база должна быть пустой: если тут
# окажутся выдуманные пользователи, значит фикстуры уехали в бой.
total=$(curl -sf "$BASE/v1/courses" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).meta.total))')
echo "курсов в production-образе: $total"
if [ "$total" != "0" ]; then
  echo "в production применились сиды" >&2
  exit 1
fi

echo "smoke-тест пройден"
