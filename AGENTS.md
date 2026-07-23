# Repository Guidelines

## Project Structure & Module Organization

All application code lives in `sql-agent/`:

- `sql-agent.ts` is the CLI entry point. It opens a SQLite database read-only, exposes schema and submission tools to the agent, and prints generated SQL.
- `seed-example-db.ts` recreates the sample `example.sqlite` database.
- `example.sqlite` is the small development fixture described in `README.md`.
- `package.json` and `package-lock.json` define the Node.js dependencies and runnable scripts.

Keep new runtime modules beside the entry point until the codebase warrants a `src/` directory. If tests are added, place them in `sql-agent/test/` or next to their subject as `*.test.ts`.

## Build, Test, and Development Commands

Run commands from `sql-agent/`:

```bash
npm install
npm run seed
OPENROUTER_API_KEY=... npm start -- example.sqlite "List orders by customer"
```

`npm install` restores the locked dependencies. `npm run seed` deletes and rebuilds the example database. `npm start -- ...` runs the CLI and passes the database path and question as arguments. There is no compilation step or automated test command currently; Node executes the TypeScript files directly.

## Coding Style & Naming Conventions

Follow the existing TypeScript style: two-space indentation, semicolons, double quotes, trailing commas in multiline constructs, and explicit types at tool and external-data boundaries. Use `camelCase` for variables and functions, `PascalCase` for imported or declared types, and `UPPER_SNAKE_CASE` for constants such as `DB_PATH`. Use descriptive tool names in `snake_case` because they are exposed to the model (for example, `get_schema`).

No formatter or linter is configured. Match surrounding code and keep functions focused.

## Testing Guidelines

Before submitting changes, reseed the fixture and exercise both success and failure paths manually. Confirm a valid prompt returns SQL, a missing argument prints usage, and an empty or invalid database fails clearly. Never let tests execute model-generated SQL against user data. When adding automated tests, avoid live API calls and use temporary SQLite fixtures.

## Commit & Pull Request Guidelines

This repository has no commit history yet. Use short, imperative commit subjects such as `Add schema validation` and keep each commit focused. Pull requests should explain behavior changes, list manual or automated checks, link relevant issues, and include representative CLI input/output when output changes. Never commit API keys or local credentials.
