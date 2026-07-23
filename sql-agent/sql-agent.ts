import { DatabaseSync } from "node:sqlite";
import { Agent, type AgentTool } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import { Type } from "typebox";

const [dbPath, question] = process.argv.slice(2);

if (!dbPath || !question) {
  console.error('Usage: node sql-agent.ts <path-to-sqlite-file> "<question>"');
  process.exit(1);
}

const db = new DatabaseSync(dbPath, { readOnly: true });

function getSchema(): string {
  const rows = db
    .prepare("SELECT sql FROM sqlite_master WHERE type IN ('table', 'index') AND sql IS NOT NULL")
    .all() as { sql: string }[];
  if (rows.length === 0) throw new Error("No tables found in this database.");
  return rows.map((row) => row.sql).join("\n\n");
}

const getSchemaTool: AgentTool = {
  name: "get_schema",
  label: "Read schema",
  description: "Read the CREATE TABLE/INDEX statements for every table in the target SQLite database.",
  parameters: Type.Object({}),
  execute: async () => ({
    content: [{ type: "text", text: getSchema() }],
    details: undefined,
  }),
};

let submitted: { sql: string; explanation?: string } | undefined;

const submitSqlTool: AgentTool = {
  name: "submit_sql",
  label: "Submit SQL",
  description:
    "Submit the final generated SQL query as your answer. Call this exactly once, as your last action, after inspecting the schema.",
  parameters: Type.Object({
    sql: Type.String({ description: "The final SQL query that answers the question." }),
    explanation: Type.Optional(Type.String({ description: "A short explanation of what the query does." })),
  }),
  execute: async (_toolCallId, args) => {
    submitted = args;
    return {
      content: [{ type: "text", text: "SQL received." }],
      details: undefined,
      terminate: true,
    };
  },
};

const models = createModels();
models.setProvider(openrouterProvider());
const model = models.getModel("openrouter", "openrouter/free");
if (!model) throw new Error("Model not found");

const agent = new Agent({
  initialState: {
    systemPrompt: [
      "You are a SQL generation assistant for a SQLite database.",
      "Always call get_schema first to learn the exact tables and columns before writing any query.",
      "Never guess table or column names.",
      "Default to a read-only SELECT query unless the question explicitly asks for a mutation.",
      "Once you have written the final query, call submit_sql exactly once with the query and a short explanation, as your last action.",
    ].join("\n"),
    model,
    tools: [getSchemaTool, submitSqlTool],
  },
  streamFn: models.streamSimple.bind(models),
});

try {
  await agent.prompt(question);
} finally {
  db.close();
}

if (!submitted) {
  console.error(
    agent.state.errorMessage
      ? `Agent error: ${agent.state.errorMessage}`
      : "Agent finished without submitting a SQL query.",
  );
  process.exit(1);
}

console.log(submitted.sql);
if (submitted.explanation) {
  console.log(`\n-- ${submitted.explanation}`);
}
