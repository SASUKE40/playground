import type { DatabaseSync } from "node:sqlite";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";

export const SYSTEM_PROMPT = [
  "You are a SQL generation assistant for a SQLite database.",
  "Always call get_schema first to learn the exact tables and columns before writing any query.",
  "Never guess table or column names.",
  "Default to a read-only SELECT query unless the question explicitly asks for a mutation.",
  "Once you have written the final query, call submit_sql exactly once with the query and a short explanation, as your last action.",
].join("\n");

export function readSchema(db: DatabaseSync): string {
  const rows = db
    .prepare("SELECT sql FROM sqlite_master WHERE type IN ('table', 'index') AND sql IS NOT NULL")
    .all() as { sql: string }[];
  if (rows.length === 0) throw new Error("No tables found in this database.");
  return rows.map((row) => row.sql).join("\n\n");
}

export function createGetSchemaTool(db: DatabaseSync): AgentTool {
  return {
    name: "get_schema",
    label: "Read schema",
    description: "Read the CREATE TABLE/INDEX statements for every table in the target SQLite database.",
    parameters: Type.Object({}),
    execute: async () => ({
      content: [{ type: "text", text: readSchema(db) }],
      details: undefined,
    }),
  };
}

export interface SubmittedSql {
  sql: string;
  explanation?: string;
}

export function createSubmitSqlTool(onSubmit: (result: SubmittedSql) => void): AgentTool {
  return {
    name: "submit_sql",
    label: "Submit SQL",
    description:
      "Submit the final generated SQL query as your answer. Call this exactly once, as your last action, after inspecting the schema.",
    parameters: Type.Object({
      sql: Type.String({ description: "The final SQL query that answers the question." }),
      explanation: Type.Optional(Type.String({ description: "A short explanation of what the query does." })),
    }),
    execute: async (_toolCallId, args) => {
      onSubmit(args);
      return {
        content: [{ type: "text", text: "SQL received." }],
        details: undefined,
        terminate: true,
      };
    },
  };
}

export interface FormattedResult {
  ok: boolean;
  message: string;
}

export function formatResult(submitted: SubmittedSql | undefined, errorMessage: string | undefined): FormattedResult {
  if (!submitted) {
    return {
      ok: false,
      message: errorMessage ? `Agent error: ${errorMessage}` : "Agent finished without submitting a SQL query.",
    };
  }
  return {
    ok: true,
    message: submitted.explanation ? `${submitted.sql}\n\n-- ${submitted.explanation}` : submitted.sql,
  };
}
