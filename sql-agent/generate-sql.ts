import type { DatabaseSync } from "node:sqlite";
import { Agent } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import {
  createGetSchemaTool,
  createSubmitSqlTool,
  formatResult,
  SYSTEM_PROMPT,
  type FormattedResult,
  type SubmittedSql,
} from "./lib.ts";

export async function generateSql(db: DatabaseSync, question: string): Promise<FormattedResult> {
  let submitted: SubmittedSql | undefined;

  const models = createModels();
  models.setProvider(openrouterProvider());
  const model = models.getModel("openrouter", "openrouter/free");
  if (!model) throw new Error("OpenRouter free model not found.");

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

  await agent.prompt(question);
  return formatResult(submitted, agent.state.errorMessage);
}
