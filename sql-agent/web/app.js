const form = document.getElementById("question-form");
const question = document.getElementById("question");
const generateButton = document.getElementById("generate");
const resultPanel = document.getElementById("result-panel");
const resultTitle = document.getElementById("result-title");
const sqlOutput = document.getElementById("sql-output");
const explanation = document.getElementById("explanation");
const copyButton = document.getElementById("copy");
const schemaToggle = document.getElementById("schema-toggle");
const schemaOutput = document.getElementById("schema");

let generatedSql = "";

function setLoading(loading) {
  generateButton.disabled = loading;
  question.disabled = loading;
  generateButton.querySelector("span").textContent = loading ? "Inspecting schema…" : "Generate SQL";
  resultPanel.classList.toggle("loading", loading);
  if (loading) {
    resultTitle.textContent = "Building your query";
    sqlOutput.textContent = "Reading tables and columns…";
    explanation.textContent = "";
    copyButton.hidden = true;
  }
}

function splitResult(message) {
  const separator = "\n\n-- ";
  const position = message.indexOf(separator);
  if (position === -1) return { sql: message, explanation: "" };
  return {
    sql: message.slice(0, position),
    explanation: message.slice(position + separator.length),
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoading(true);

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SQL-Agent-Client": "web",
      },
      body: JSON.stringify({ question: question.value }),
    });
    const result = await response.json();

    if (!response.ok || !result.ok) throw new Error(result.message || "Unable to generate SQL.");

    const parsed = splitResult(result.message);
    generatedSql = parsed.sql;
    resultTitle.textContent = "Query generated";
    sqlOutput.textContent = parsed.sql;
    explanation.textContent = parsed.explanation;
    copyButton.hidden = false;
  } catch (error) {
    generatedSql = "";
    resultTitle.textContent = "Generation failed";
    sqlOutput.textContent = error instanceof Error ? error.message : "Unexpected error.";
    explanation.textContent = "";
    copyButton.hidden = true;
  } finally {
    setLoading(false);
  }
});

document.querySelectorAll("[data-question]").forEach((button) => {
  button.addEventListener("click", () => {
    question.value = button.dataset.question;
    question.focus();
  });
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(generatedSql);
  copyButton.textContent = "Copied";
  setTimeout(() => {
    copyButton.textContent = "Copy SQL";
  }, 1500);
});

schemaToggle.addEventListener("click", () => {
  const expanded = schemaToggle.getAttribute("aria-expanded") === "true";
  schemaToggle.setAttribute("aria-expanded", String(!expanded));
  schemaToggle.textContent = expanded ? "View schema" : "Hide schema";
  schemaOutput.hidden = expanded;
});

fetch("/api/schema")
  .then((response) => response.json())
  .then((result) => {
    schemaOutput.textContent = result.schema;
  })
  .catch(() => {
    schemaOutput.textContent = "Schema unavailable.";
  });
