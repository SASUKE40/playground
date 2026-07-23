import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { createGetSchemaTool, createSubmitSqlTool, formatResult, readSchema } from "../lib.ts";

describe("readSchema", () => {
  it("returns the CREATE statements for every table and index", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT)");
    db.exec("CREATE INDEX idx_customers_name ON customers (name)");

    const schema = readSchema(db);

    assert.match(schema, /CREATE TABLE customers/);
    assert.match(schema, /CREATE INDEX idx_customers_name/);
    db.close();
  });

  it("excludes automatic indexes, which have no sql of their own", () => {
    const db = new DatabaseSync(":memory:");
    // A UNIQUE column creates a sqlite_autoindex_* entry in sqlite_master with sql = NULL.
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, email TEXT UNIQUE)");

    const schema = readSchema(db);

    assert.doesNotMatch(schema, /sqlite_autoindex/);
    db.close();
  });

  it("throws when the database has no tables", () => {
    const db = new DatabaseSync(":memory:");

    assert.throws(() => readSchema(db), /No tables found/);
    db.close();
  });
});

describe("createGetSchemaTool", () => {
  it("exposes a no-argument tool named get_schema", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");

    const tool = createGetSchemaTool(db);

    assert.equal(tool.name, "get_schema");
    db.close();
  });

  it("execute() returns the schema as text content", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE widgets (id INTEGER PRIMARY KEY)");
    const tool = createGetSchemaTool(db);

    const result = await tool.execute("call-1", {}, new AbortController().signal);

    assert.equal(result.content[0]?.type, "text");
    assert.match((result.content[0] as { text: string }).text, /CREATE TABLE widgets/);
    db.close();
  });

  it("execute() propagates errors for an empty database", async () => {
    const db = new DatabaseSync(":memory:");
    const tool = createGetSchemaTool(db);

    await assert.rejects(() => tool.execute("call-1", {}, new AbortController().signal), /No tables found/);
    db.close();
  });
});

describe("createSubmitSqlTool", () => {
  it("invokes the callback with the submitted args and terminates the loop", async () => {
    let captured: unknown;
    const tool = createSubmitSqlTool((result) => {
      captured = result;
    });

    const args = { sql: "SELECT 1", explanation: "returns one" };
    const result = await tool.execute("call-1", args, new AbortController().signal);

    assert.deepEqual(captured, args);
    assert.equal(result.terminate, true);
  });

  it("works without an explanation", async () => {
    let captured: unknown;
    const tool = createSubmitSqlTool((result) => {
      captured = result;
    });

    await tool.execute("call-1", { sql: "SELECT 1" }, new AbortController().signal);

    assert.deepEqual(captured, { sql: "SELECT 1" });
  });
});

describe("formatResult", () => {
  it("reports the query and explanation on success", () => {
    const result = formatResult({ sql: "SELECT 1", explanation: "returns one" }, undefined);

    assert.equal(result.ok, true);
    assert.equal(result.message, "SELECT 1\n\n-- returns one");
  });

  it("reports just the query when there is no explanation", () => {
    const result = formatResult({ sql: "SELECT 1" }, undefined);

    assert.equal(result.ok, true);
    assert.equal(result.message, "SELECT 1");
  });

  it("reports the agent error message when nothing was submitted", () => {
    const result = formatResult(undefined, "401 invalid x-api-key");

    assert.equal(result.ok, false);
    assert.equal(result.message, "Agent error: 401 invalid x-api-key");
  });

  it("reports a generic message when nothing was submitted and there is no error", () => {
    const result = formatResult(undefined, undefined);

    assert.equal(result.ok, false);
    assert.equal(result.message, "Agent finished without submitting a SQL query.");
  });
});
