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
export OPENROUTER_API_KEY=sk-or-v1-...
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

The agent has two tools:

- `get_schema` — reads every `CREATE TABLE`/`CREATE INDEX` statement from the
  target database and returns it as context. The system prompt requires the
  model to call this before writing any query, so it never guesses table or
  column names.
- `submit_sql` — the model calls this exactly once with the final query (and
  an optional explanation). Calling it ends the agent run; the CLI prints
  whatever was submitted.
