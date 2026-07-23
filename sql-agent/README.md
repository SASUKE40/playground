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

Start the local web interface:

```bash
npm run web
```

Open `http://127.0.0.1:3000`. The server uses `example.sqlite` by default and
keeps the API key out of the browser. Select another database or port with
environment variables:

```bash
SQL_AGENT_DB_PATH=/path/to/database.sqlite PORT=8080 npm run web
```

Start the interactive terminal interface:

```bash
npm run tui
```

Press Enter to use `example.sqlite`, then ask as many questions as needed.
Within the interface, use `:schema` to inspect the active database, `:clear`
to redraw the screen, `:help` to list commands, and `:quit` to exit. You can
also provide the database path directly:

```bash
npm run tui -- example.sqlite
```

For scripts and one-off generation, use the existing CLI:

```bash
npm start -- <path-to-sqlite-file> "<question>"
```

Example:

```bash
npm start -- example.sqlite "How many orders did each customer place?"
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

`generate-sql.ts` contains the shared live-agent runner used by the CLI, TUI,
and local web server, so every interface follows the same schema-first
generation flow. `web-server.ts` serves the browser assets and exposes schema
and generation JSON endpoints; it binds to `127.0.0.1` by default.

## Testing

```bash
npm test              # run the unit test suite (node:test, no API key needed)
npm run test:coverage # same, with a coverage report
```

Tests cover `lib.ts` against in-memory SQLite databases and exercise the web
server with an injected agent runner. Live model calls are not part of the
automated suite; exercise those paths manually with `npm start`, `npm run tui`,
or `npm run web`.
