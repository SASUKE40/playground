# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This is a playground repo. It currently contains one project, `sql-agent/`, a custom natural-language-to-SQL agent built on the [`pi` agent harness](https://github.com/earendil-works/pi) (`@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`).

## Commands (run from `sql-agent/`)

```bash
npm install                              # install dependencies
cp .env.example .env                     # add OPENROUTER_API_KEY to this ignored file
npm run seed                             # (re)generate example.sqlite (customers/products/orders demo data)
npm start -- <path-to-sqlite-file> "<question>"
npm test                                  # run unit tests (node:test, no network/API key needed)
npm run test:coverage                     # same, with a coverage report (node --experimental-test-coverage)
```

There is no build step: files are plain `.ts` and run directly via `node` — Node 24's native TypeScript type-stripping handles them, so don't add a bundler/tsconfig/ts-node here without reason. There is no linter configured.

Requires `OPENROUTER_API_KEY` in `.env` or the environment. The CLI uses
`pi-ai`'s `openrouterProvider` with the zero-cost `openrouter/free` router for
testing.

## Architecture

The CLI is split across two files specifically so the core logic is unit-testable without a live model or API key:

- `sql-agent/lib.ts` — the testable core: `readSchema`, `createGetSchemaTool`, `createSubmitSqlTool`, `formatResult`, `SYSTEM_PROMPT`. Pure functions / factories with no network or process-lifecycle side effects.
- `sql-agent/sql-agent.ts` — thin CLI wiring only: argv parsing, opening the real SQLite DB, constructing `models`/`agent` from `lib.ts` pieces, and `process.exit`. Deliberately kept free of logic worth unit-testing, since exercising it for real requires a live model call.

The core design: give the LLM exactly two tools and drive the whole interaction through them rather than parsing free-form text output.

- **`get_schema`** (no params) — reads `sqlite_master` from the target SQLite file (opened read-only via Node's built-in `node:sqlite`) and returns the raw `CREATE TABLE`/`CREATE INDEX` statements as context. The system prompt requires the model to call this before writing any query, so it never guesses table/column names.
- **`submit_sql`** (`{ sql, explanation? }`) — the model's final-answer tool. `createSubmitSqlTool` takes an `onSubmit` callback (rather than closing over a module-level variable) specifically so it can be unit-tested in isolation; `sql-agent.ts` passes a callback that assigns to a local variable. Returning `terminate: true` stops the `pi-agent-core` agent loop after that tool call.
- The agent **only generates SQL — it never executes the generated query** against the database. This is an intentional safety boundary baked into the tool design (there is no "run query" tool), not just a prompt instruction.
- Errors surface via `agent.state.errorMessage` after `agent.prompt()` resolves (the `Agent` class does not throw on provider/API errors — check this field rather than wrapping `prompt()` in try/catch for that case). `formatResult(submitted, errorMessage)` in `lib.ts` turns that plus the captured `submitted` value into the final `{ ok, message }` the CLI prints.

`sql-agent/test/lib.test.ts` covers `lib.ts` with `node:test` + `node:assert/strict`, using in-memory (`:memory:`) SQLite databases — no network calls or fixture files needed. Run via `npm test` / `npm run test:coverage` from `sql-agent/`.

`seed-example-db.ts` regenerates `example.sqlite` from scratch (deletes and recreates it) with a small `customers` / `products` / `orders` schema and a handful of rows, purely so the CLI has something to point at without needing a real database.

### Working with `pi-agent-core` / `pi-ai`

- Tools are defined as `AgentTool` objects with a `typebox`-based `parameters` schema and an `execute(toolCallId, args, signal, onUpdate)` function. Throw an `Error` inside `execute` for failure cases — don't return error text as content.
- `new Agent({ initialState: { systemPrompt, model, tools }, streamFn })` then `await agent.prompt(question)` is the whole integration surface; no manual event-loop handling is needed unless streaming UI output is required (see `agent.subscribe(...)` in the `pi` repo's own README if that's ever needed here).
- Model selection: `createModels()` → `models.setProvider(openrouterProvider())` → `models.getModel("openrouter", "openrouter/free")`. Swapping providers means importing a different provider from `@earendil-works/pi-ai/providers/*` and changing the id passed to `getModel`.
