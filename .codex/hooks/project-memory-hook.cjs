#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const TEXT_FIELDS = [
  "finalResponse",
  "response",
  "output",
  "assistant_message",
  "last_assistant_message",
  "prompt",
  "user_prompt",
];

function readInput() {
  return new Promise((resolve) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      try {
        resolve(input.trim() ? JSON.parse(input) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function resolveProjectDir(data) {
  const candidates = [
    data.cwd,
    data.workspace,
    data.workspaceRoot,
    data.project_path,
    process.env.CODEX_WORKSPACE,
    process.env.PWD,
    process.cwd(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(path.join(resolved, "package.json")) || fs.existsSync(path.join(resolved, ".mcp-memory"))) {
      return resolved;
    }
  }

  return process.cwd();
}

function normalizeList(items) {
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
}

function normalizeTag(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function extractSection(text, label) {
  const regex = new RegExp(`${label}:([\\s\\S]*?)(?:\\n[A-Z][A-Za-z ]+:|$)`, "i");
  const match = text.match(regex);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => Boolean(line) && !line.startsWith("#"));
}

function buildSummaryPayload(data, projectId) {
  const sourceText = TEXT_FIELDS.map((field) => (typeof data[field] === "string" ? data[field].trim() : "")).find(Boolean) || "";
  if (!sourceText) return null;

  const embeddedJson = sourceText.match(/ROMEM_TASK_SUMMARY:\s*(\{[\s\S]+\})/);
  if (embeddedJson) {
    try {
      return JSON.parse(embeddedJson[1]);
    } catch {
      return null;
    }
  }

  const summary = sourceText.split("\n").find((line) => line.trim()) || sourceText.slice(0, 400);
  return {
    projectId,
    agent: "codex",
    taskId: data.task_id || `codex-${Date.now()}`,
    summary,
    changes: extractSection(sourceText, "Changes"),
    decisions: extractSection(sourceText, "Decisions"),
    gotchas: extractSection(sourceText, "Gotchas"),
    todos: extractSection(sourceText, "Todos"),
    docsImpact: extractSection(sourceText, "Docs Impact"),
    skillsImpact: extractSection(sourceText, "Skills Impact"),
    categories: [],
    tags: normalizeList(Array.from(sourceText.matchAll(/#([a-z0-9-]+)/gi)).map((match) => normalizeTag(match[1]))),
  };
}

async function dispatchSummary(projectDir, payload) {
  const projectId = process.env.ROMEM_PROJECT_ID || "romem";
  const serverUrl = process.env.ROMEM_SERVER_URL || "http://127.0.0.1:4111";
  try {
    const response = await fetch(`${serverUrl}/api/projects/${projectId}/task-summaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return "submitted";
  } catch {
    const queueDir = path.join(projectDir, ".romem");
    const queueFile = path.join(queueDir, "pending-task-summaries.ndjson");
    fs.mkdirSync(queueDir, { recursive: true });
    fs.appendFileSync(queueFile, `${JSON.stringify(payload)}\n`, "utf8");
    return "queued";
  }
}

function contextMessage(projectDir) {
  return [
    "ROMEM ACTIVE:",
    `- Scope: ${projectDir}`,
    "- Runtime: Mastra + Express + React workbench.",
    "- Use structured task summaries when a task finishes. Preferred marker: ROMEM_TASK_SUMMARY: { ...json }",
    "- Summary contract fields: projectId, agent, taskId, summary, changes, decisions, gotchas, todos, docsImpact, skillsImpact, categories, tags.",
    "- If the server is offline, Stop hook writes summaries to .romem/pending-task-summaries.ndjson for later replay.",
  ].join("\n");
}

(async () => {
  const data = await readInput();
  const projectDir = resolveProjectDir(data);
  const eventName = data.hook_event_name || data.hookEventName || process.env.CODEX_HOOK_EVENT || "";
  const projectId = process.env.ROMEM_PROJECT_ID || "romem";

  let additionalContext = contextMessage(projectDir);

  if (eventName === "Stop") {
    const payload = buildSummaryPayload(data, projectId);
    if (payload) {
      const status = await dispatchSummary(projectDir, payload);
      additionalContext += `\n\nStop summary ${status}.`;
    }
  }

  const body = eventName
    ? { hookSpecificOutput: { hookEventName: eventName, additionalContext } }
    : { additionalContext };

  process.stdout.write(JSON.stringify(body));
})();
