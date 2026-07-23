# sql-agent

A small custom agent, built on [`pi`](https://github.com/earendil-works/pi)'s
`@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`, that generates SQL
for a SQLite database from a natural-language question.

It never runs the generated query — it only reads the schema (via
`sqlite_master`) and returns SQL text.

## Setup

```bash
cd sql-agent
npm install
cp .env.example .env
# Add your OPENROUTER_API_KEY to .env
npm run seed   # creates example.sqlite with a tiny customers/products/orders schema
```

The CLI uses OpenRouter's `openrouter/free` router for zero-cost testing. Free
models have lower rate limits and variable availability, so use a paid,
fixed model for production workloads.

## Usage

```bash
node sql-agent.ts <path-to-sqlite-file> "<question>"
```

Example:

```bash
node sql-agent.ts example.sqlite "How many orders did each customer place?"
```

## How it works

The agent has two tools, defined in `lib.ts`:

- `get_schema` — reads every `CREATE TABLE`/`CREATE INDEX` statement from the
  target database and returns it as context. The system prompt requires the
  model to call this before writing any query, so it never guesses table or
  column names.
- `submit_sql` — the model calls this exactly once with the final query (and
  an optional explanation). Calling it ends the agent run; the CLI prints
  whatever was submitted.

## Testing

```bash
npm test              # run the unit test suite (node:test, no API key needed)
npm run test:coverage # same, with a coverage report
```

Tests cover `lib.ts` (schema reading, the two tools, and result formatting)
against in-memory SQLite databases. The CLI wiring in `sql-agent.ts` itself
isn't unit-tested since it requires a live model call — exercise that path
manually with `npm start`.
