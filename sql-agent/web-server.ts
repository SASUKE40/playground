import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { generateSql } from "./generate-sql.ts";
import { readSchema, type FormattedResult } from "./lib.ts";

const MAX_BODY_BYTES = 16_384;
const STATIC_FILES = {
  "/": { content: readFileSync(new URL("./web/index.html", import.meta.url)), type: "text/html; charset=utf-8" },
  "/app.js": {
    content: readFileSync(new URL("./web/app.js", import.meta.url)),
    type: "text/javascript; charset=utf-8",
  },
  "/styles.css": {
    content: readFileSync(new URL("./web/styles.css", import.meta.url)),
    type: "text/css; charset=utf-8",
  },
} as const;

type Generate = (db: DatabaseSync, question: string) => Promise<FormattedResult>;

export interface WebServerOptions {
  dbPath: string;
  generate?: Generate;
}

class RequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function sendStatic(response: ServerResponse, content: Buffer, type: string): void {
  response.writeHead(200, {
    "Content-Type": type,
    "Content-Length": content.byteLength,
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(content);
}

async function readQuestion(request: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) throw new RequestError("Request body is too large.", 413);
    chunks.push(buffer);
  }

  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError("Request body must be valid JSON.", 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("question" in body) ||
    typeof body.question !== "string" ||
    !body.question.trim()
  ) {
    throw new RequestError("Question is required.", 400);
  }

  return body.question.trim();
}

export function createWebServer(options: WebServerOptions): Server {
  const db = new DatabaseSync(options.dbPath, { readOnly: true });
  const schema = readSchema(db);
  const runGenerate = options.generate ?? generateSql;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "GET" && url.pathname === "/api/schema") {
      sendJson(response, 200, { schema });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/generate") {
      if (request.headers["x-sql-agent-client"] !== "web") {
        sendJson(response, 403, { ok: false, message: "Request origin is not allowed." });
        return;
      }
      try {
        const question = await readQuestion(request);
        const result = await runGenerate(db, question);
        sendJson(response, result.ok ? 200 : 502, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error.";
        const status = error instanceof RequestError ? error.status : 500;
        sendJson(response, status, { ok: false, message });
      }
      return;
    }

    if (request.method === "GET" && url.pathname in STATIC_FILES) {
      const file = STATIC_FILES[url.pathname as keyof typeof STATIC_FILES];
      sendStatic(response, file.content, file.type);
      return;
    }

    sendJson(response, 404, { ok: false, message: "Not found." });
  });

  server.on("close", () => db.close());
  return server;
}

export function startWebServer(options: WebServerOptions, port: number, host: string): Server {
  const server = createWebServer(options);
  server.listen(port, host, () => {
    const address = server.address();
    const activePort = typeof address === "object" && address ? address.port : port;
    console.log(`SQL Agent web UI: http://${host}:${activePort}`);
    console.log(`Database: ${resolve(options.dbPath)}`);
  });
  return server;
}

if (import.meta.main) {
  const dbPath = resolve(process.env.SQL_AGENT_DB_PATH ?? "example.sqlite");
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  const host = process.env.HOST ?? "127.0.0.1";
  const server = startWebServer({ dbPath }, port, host);

  const close = () => server.close();
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
