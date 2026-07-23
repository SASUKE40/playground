import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { generateSql } from "./generate-sql.ts";
import { readSchema } from "./lib.ts";

const color = {
  cyan: (text: string) => (output.isTTY ? `\u001b[36m${text}\u001b[0m` : text),
  dim: (text: string) => (output.isTTY ? `\u001b[2m${text}\u001b[0m` : text),
  green: (text: string) => (output.isTTY ? `\u001b[32m${text}\u001b[0m` : text),
  red: (text: string) => (output.isTTY ? `\u001b[31m${text}\u001b[0m` : text),
  yellow: (text: string) => (output.isTTY ? `\u001b[33m${text}\u001b[0m` : text),
};

function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    readSchema(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function printBanner(): void {
  console.log(color.cyan("┌──────────────────────────────────────────┐"));
  console.log(color.cyan("│  SQL Agent                               │"));
  console.log(color.cyan("│  Natural language → SQLite               │"));
  console.log(color.cyan("└──────────────────────────────────────────┘"));
}

function printHelp(): void {
  console.log(color.dim("Commands: :schema  :clear  :help  :quit"));
}

function startSpinner(label: string): () => void {
  if (!output.isTTY) {
    console.log(label);
    return () => {};
  }

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frame = 0;
  const timer = setInterval(() => {
    output.write(`\r${color.cyan(frames[frame % frames.length]!)} ${label}`);
    frame += 1;
  }, 80);

  return () => {
    clearInterval(timer);
    output.write("\r\u001b[2K");
  };
}

const rl = createInterface({ input, output });
let db: DatabaseSync | undefined;

try {
  printBanner();

  const pathArgument = process.argv[2];
  const enteredPath = pathArgument ?? (await rl.question(`Database ${color.dim("[example.sqlite]")}: `));
  const dbPath = resolve(enteredPath.trim() || "example.sqlite");
  db = openDatabase(dbPath);

  console.log(`${color.green("Connected")} ${dbPath}`);
  printHelp();

  while (true) {
    const question = (await rl.question(`\n${color.cyan("sql-agent›")} `)).trim();
    if (!question) continue;

    if (question === ":quit" || question === ":q") break;
    if (question === ":clear") {
      console.clear();
      printBanner();
      console.log(`${color.green("Connected")} ${dbPath}`);
      printHelp();
      continue;
    }
    if (question === ":help") {
      printHelp();
      continue;
    }
    if (question === ":schema") {
      console.log(`\n${color.yellow("Schema")}\n${readSchema(db)}`);
      continue;
    }

    const stopSpinner = startSpinner("Generating SQL…");
    try {
      const result = await generateSql(db, question);
      stopSpinner();
      if (result.ok) {
        console.log(`${color.green("SQL")}\n${result.message}`);
      } else {
        console.error(color.red(result.message));
      }
    } catch (error) {
      stopSpinner();
      const message = error instanceof Error ? error.message : String(error);
      console.error(color.red(`Error: ${message}`));
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(color.red(`Error: ${message}`));
  process.exitCode = 1;
} finally {
  db?.close();
  rl.close();
}
