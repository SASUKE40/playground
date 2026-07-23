import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { createWebServer } from "../web-server.ts";

let fixtureDirectory: string;
let dbPath: string;

before(() => {
  fixtureDirectory = mkdtempSync(join(tmpdir(), "sql-agent-web-"));
  dbPath = join(fixtureDirectory, "test.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec("CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  db.close();
});

after(() => {
  rmSync(fixtureDirectory, { recursive: true });
});

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("web server", () => {
  it("serves the application shell", async () => {
    const server = createWebServer({ dbPath });
    const baseUrl = await listen(server);

    try {
      const response = await fetch(baseUrl);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /<title>SQL Agent<\/title>/);
    } finally {
      await close(server);
    }
  });

  it("returns the connected database schema", async () => {
    const server = createWebServer({ dbPath });
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/api/schema`);
      const body = (await response.json()) as { schema: string };
      assert.equal(response.status, 200);
      assert.match(body.schema, /CREATE TABLE widgets/);
    } finally {
      await close(server);
    }
  });

  it("generates SQL through the injected agent runner", async () => {
    const server = createWebServer({
      dbPath,
      generate: async (_db, question) => ({
        ok: true,
        message: `SELECT '${question}'`,
      }),
    });
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SQL-Agent-Client": "web",
        },
        body: JSON.stringify({ question: "widget names" }),
      });
      const body = (await response.json()) as { ok: boolean; message: string };
      assert.equal(response.status, 200);
      assert.deepEqual(body, { ok: true, message: "SELECT 'widget names'" });
    } finally {
      await close(server);
    }
  });

  it("rejects an empty question without calling the agent", async () => {
    let called = false;
    const server = createWebServer({
      dbPath,
      generate: async () => {
        called = true;
        return { ok: true, message: "SELECT 1" };
      },
    });
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SQL-Agent-Client": "web",
        },
        body: JSON.stringify({ question: "   " }),
      });
      const body = (await response.json()) as { message: string };
      assert.equal(response.status, 400);
      assert.equal(body.message, "Question is required.");
      assert.equal(called, false);
    } finally {
      await close(server);
    }
  });

  it("reports agent failures as server errors", async () => {
    const server = createWebServer({
      dbPath,
      generate: async () => {
        throw new Error("provider unavailable");
      },
    });
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SQL-Agent-Client": "web",
        },
        body: JSON.stringify({ question: "show widgets" }),
      });
      assert.equal(response.status, 500);
    } finally {
      await close(server);
    }
  });

  it("rejects cross-site-compatible generation requests", async () => {
    const server = createWebServer({
      dbPath,
      generate: async () => ({ ok: true, message: "SELECT 1" }),
    });
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ question: "show widgets" }),
      });
      assert.equal(response.status, 403);
    } finally {
      await close(server);
    }
  });
});
