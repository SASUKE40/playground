import { DatabaseSync } from "node:sqlite";
import { generateSql } from "./generate-sql.ts";

const [dbPath, question] = process.argv.slice(2);

if (!dbPath || !question) {
  console.error('Usage: node sql-agent.ts <path-to-sqlite-file> "<question>"');
  process.exit(1);
}

const db = new DatabaseSync(dbPath, { readOnly: true });

let exitCode = 0;
try {
  const result = await generateSql(db, question);
  if (result.ok) {
    console.log(result.message);
  } else {
    console.error(result.message);
    exitCode = 1;
  }
} finally {
  db.close();
}

process.exitCode = exitCode;
