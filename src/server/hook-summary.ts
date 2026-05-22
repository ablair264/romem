import type { AgentKind, TaskSummaryInput } from "../shared/schema.js";
import { normalizeList, normalizeTag } from "./utils.js";

type HookPayload = Record<string, unknown>;

const CANDIDATE_TEXT_FIELDS = [
  "finalResponse",
  "response",
  "output",
  "assistant_message",
  "last_assistant_message",
  "prompt",
  "user_prompt",
];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractSection(text: string, label: string): string[] {
  const regex = new RegExp(`${label}:([\\s\\S]*?)(?:\\n[A-Z][A-Za-z ]+:|$)`, "i");
  const match = text.match(regex);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => Boolean(line) && !line.startsWith("#"));
}

export function normalizeHookSummary(payload: HookPayload, projectId: string, agent: AgentKind): TaskSummaryInput | null {
  const directJson = asString(payload.summary_json);
  if (directJson) {
    try {
      return JSON.parse(directJson) as TaskSummaryInput;
    } catch {
      return null;
    }
  }

  const sourceText = CANDIDATE_TEXT_FIELDS.map((field) => asString(payload[field])).find(Boolean) ?? "";
  if (!sourceText) return null;

  const embeddedJson = sourceText.match(/ROMEM_TASK_SUMMARY:\s*(\{[\s\S]+\})/);
  if (embeddedJson) {
    try {
      return JSON.parse(embeddedJson[1]) as TaskSummaryInput;
    } catch {
      return null;
    }
  }

  const summary = sourceText.split("\n").find((line) => line.trim()) ?? sourceText.slice(0, 500);
  const changes = extractSection(sourceText, "Changes");
  const decisions = extractSection(sourceText, "Decisions");
  const gotchas = extractSection(sourceText, "Gotchas");
  const todos = extractSection(sourceText, "Todos");
  const docsImpact = extractSection(sourceText, "Docs Impact");
  const skillsImpact = extractSection(sourceText, "Skills Impact");
  const tags = normalizeList(
    Array.from(sourceText.matchAll(/#([a-z0-9-]+)/gi)).map((match) => normalizeTag(match[1])),
  );

  return {
    projectId,
    agent,
    taskId: asString(payload.task_id) || `hook-${Date.now()}`,
    summary,
    changes,
    decisions,
    gotchas,
    todos,
    docsImpact,
    skillsImpact,
    categories: [],
    tags,
  };
}
