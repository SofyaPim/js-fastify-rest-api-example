# Сборки нет намеренно: tsconfig стоит на noEmit, а node 26 исполняет
# TypeScript сам, снимая типы. Поэтому образ копирует исходники как есть.
FROM node:26-slim AS deps

# better-sqlite3 — нативный модуль, и под slim готового бинаря может не быть:
# без тулчейна установка падает на сборке.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# corepack из образов node 26 убран, поэтому pnpm ставится явно — версией из
# packageManager, чтобы лок-файл читался тем же, что и локально.
ARG PNPM_VERSION=11.22.0
RUN npm install -g pnpm@$PNPM_VERSION

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM node:26-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Непривилегированный пользователь: образ node его уже содержит.
USER node

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node tsp-output ./tsp-output

EXPOSE 3000

# Через node_modules напрямую, а не pnpm exec: в рантайме pnpm не нужен.
CMD ["node", "node_modules/fastify-cli/cli.js", "start", "-l", "info", "-a", "0.0.0.0", "src/app.ts"]
