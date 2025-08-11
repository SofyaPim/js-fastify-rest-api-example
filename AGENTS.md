# Repository Guidelines

## Project Structure & Module Organization

- `app.js`: Fastify entry; autoloads `plugins/` and `routes/`.
- `routes/`: HTTP handlers.
- `plugins/`: App plugins (JWT auth, DB, sensible errors, response validation, route glue).
- `db/`: Drizzle ORM schema and seeds; `drizzle/` holds generated migrations.
- `lib/`: Utilities and test data builders.
- `test/`: Node tests; helpers in `test/helper.js`, route specs in `test/routes/*.test.js`.
- `types/`: ts types
- `main.tsp`, `tsp-output/`: TypeSpec and generated OpenAPI/handler typings.

## Build, Test, and Development Commands
- `npm run dev`: Start Fastify with watch on http://localhost:3000.
- `npm start`: Start in production mode.
- `npm test` or `make test`: Run Node tests (`node --test`).
- `make lint` / `make lint-fix`: Lint and autofix.
- `make check-types`: Type-check with `tsc` (JS + d.ts).
- `make generate-types`: Compile TypeSpec and generate Fastify handler types.
- `make migration-generate`: Generate Drizzle migrations.
- `make mock`: Serve mocked API from generated OpenAPI.

## Coding Style & Naming Conventions
- **Modules**: ESM only (`type: module`). Prefer named exports; keep JSDoc types consistent with `types/`.
- **Formatting**: 2-space indent, no semicolons; follow ESLint + `@stylistic` rules. Run `make lint` before committing.
- **Files**: Group endpoints by resource in `routes/api/` (e.g., `routes/api/books.js`). Co-locate validators and serializers by domain when present.

## Testing Guidelines
- **Framework**: Node built-in `node:test` with `app.inject()`; see `test/helper.js` for server bootstrap.
- **Naming**: Place specs under `test/routes/` as `*.test.js` (e.g., `test/routes/users.test.js`).
- **Scope**: Add success tests for each new/changed route. No coverage gate enforced.

## Commit & Pull Request Guidelines
- **Commits**: Use clear, imperative messages (optionally Conventional Commits). Reference issues when applicable.
- **PRs**: Provide purpose, summary, linked issues, test plan, and example requests/responses (curl or HTTPie). Keep diffs focused.

## Security & Configuration Tips
- **Secrets**: Move JWT secret to env (e.g., `JWT_SECRET`) rather than hardcoding; use `.env` locally and never commit secrets.
- **DB**: Current DB is in-memory SQLite (`plugins/drizzle.js`). Switch to file/real DB for persistence before production.
