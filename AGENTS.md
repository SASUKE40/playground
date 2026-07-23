# Repository Guidelines

## Project Structure & Module Organization

All application code lives in `sql-agent/`:

- `sql-agent.ts` is the CLI entry point: thin wiring only (argv parsing, opening the real SQLite DB, constructing the model/agent, printing the result).
- `lib.ts` holds the testable core: `readSchema`, `createGetSchemaTool`, `createSubmitSqlTool`, `formatResult`, `SYSTEM_PROMPT`. Anything that doesn't need a live model or `process.exit` belongs here, not in `sql-agent.ts`.
- `test/lib.test.ts` covers `lib.ts` using `node:test` + `node:assert/strict` and in-memory (`:memory:`) SQLite databases — no network calls, no API key needed.
- `seed-example-db.ts` recreates the sample `example.sqlite` database.
- `example.sqlite` is the small development fixture described in `README.md`.
- `package.json` and `package-lock.json` define the Node.js dependencies and runnable scripts.

Keep new runtime modules beside the entry point until the codebase warrants a `src/` directory. Place new tests in `sql-agent/test/` as `*.test.ts`, and prefer adding testable logic to `lib.ts` over `sql-agent.ts` so it stays coverable without live API calls.

## Build, Test, and Development Commands

Run commands from `sql-agent/`:

```bash
npm install
cp .env.example .env
npm run seed
npm start -- example.sqlite "List orders by customer"
npm test              # run the unit test suite (node:test)
npm run test:coverage # same, with a coverage report
```

`npm install` restores the locked dependencies. `npm run seed` deletes and rebuilds the example database. `npm start -- ...` runs the CLI and passes the database path and question as arguments. There is no compilation step; Node executes the TypeScript files directly.

## Coding Style & Naming Conventions

Follow the existing TypeScript style: two-space indentation, semicolons, double quotes, trailing commas in multiline constructs, and explicit types at tool and external-data boundaries. Use `camelCase` for variables and functions, `PascalCase` for imported or declared types, and `UPPER_SNAKE_CASE` for constants such as `DB_PATH`. Use descriptive tool names in `snake_case` because they are exposed to the model (for example, `get_schema`).

No formatter or linter is configured. Match surrounding code and keep functions focused.

## Testing Guidelines

Run `npm test` (or `npm run test:coverage`) before submitting changes to `lib.ts`. Automated tests must avoid live API calls and use in-memory or temporary SQLite fixtures — the model/agent wiring in `sql-agent.ts` is intentionally left uncovered by automated tests for this reason. For changes that touch `sql-agent.ts` itself, also reseed the fixture and exercise both success and failure paths manually: confirm a valid prompt returns SQL, a missing argument prints usage, and an empty or invalid database fails clearly. Never let tests execute model-generated SQL against user data.

## Commit & Pull Request Guidelines

This repository has no commit history yet. Use short, imperative commit subjects such as `Add schema validation` and keep each commit focused. Pull requests should explain behavior changes, list manual or automated checks, link relevant issues, and include representative CLI input/output when output changes. Never commit API keys or local credentials.
