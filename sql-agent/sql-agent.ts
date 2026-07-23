import { DatabaseSync } from "node:sqlite";
import { Agent } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import { createGetSchemaTool, createSubmitSqlTool, formatResult, SYSTEM_PROMPT, type SubmittedSql } from "./lib.ts";

const [dbPath, question] = process.argv.slice(2);

if (!dbPath || !question) {
  console.error('Usage: node sql-agent.ts <path-to-sqlite-file> "<question>"');
  process.exit(1);
}

const db = new DatabaseSync(dbPath, { readOnly: true });

let submitted: SubmittedSql | undefined;

const models = createModels();
models.setProvider(openrouterProvider());
const model = models.getModel("openrouter", "openrouter/free");
if (!model) throw new Error("Model not found");

const agent = new Agent({
  initialState: {
    systemPrompt: SYSTEM_PROMPT,
    model,
    tools: [
      createGetSchemaTool(db),
      createSubmitSqlTool((result) => {
        submitted = result;
      }),
    ],
  },
  streamFn: models.streamSimple.bind(models),
});

try {
  await agent.prompt(question);
} finally {
  db.close();
}

const result = formatResult(submitted, agent.state.errorMessage);
if (result.ok) {
  console.log(result.message);
} else {
  console.error(result.message);
  process.exit(1);
}
