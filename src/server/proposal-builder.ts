import type { ProjectSnapshot } from "./project-snapshot.js";
import type { ProposalDraft, ProposalOperation, TaskSummaryInput } from "../shared/schema.js";
import { buildDocumentOperation, skillPathFromReason } from "./filesystem.js";
import { createId, normalizeList, normalizeTag } from "./utils.js";

function pickAgentDocFilename(input: string) {
  const lower = input.toLowerCase();
  if (lower.includes("claude")) return "CLAUDE.md";
  if (lower.includes("gemini")) return "GEMINI.md";
  if (lower.includes("codex")) return "CODEX.md";
  if (lower.includes("agent")) return "AGENTS.md";
  return "AGENTS.md";
}

const CANONICAL_AGENT_DOCS = new Set(["CLAUDE.md", "GEMINI.md", "AGENTS.md", "CODEX.md"]);

function canonicaliseAgentDocFilename(raw: string): string {
  const base = raw.split("/").pop() ?? raw;
  if (CANONICAL_AGENT_DOCS.has(base)) return base;
  return pickAgentDocFilename(raw);
}

function existingDocument(snapshot: ProjectSnapshot, filename: string) {
  return snapshot.agentDocuments.find((document) => document.filename === filename)?.content ?? `# ${filename}\n`;
}

function appendSection(content: string, heading: string, lines: string[]) {
  const block = `\n## ${heading}\n${lines.map((line) => `- ${line}`).join("\n")}\n`;
  return content.trimEnd() + block;
}

export function buildFallbackDraft(input: TaskSummaryInput, snapshot: ProjectSnapshot): ProposalDraft {
  const normalizedTags = normalizeList([
    ...input.tags.map(normalizeTag),
    input.agent,
    ...input.categories.map(normalizeTag),
  ]);
  const categories = normalizeList(input.categories.length ? input.categories : ["general"]);
  const memories = [
    input.summary,
    ...input.decisions.map((item) => `Decision: ${item}`),
    ...input.gotchas.map((item) => `Gotcha: ${item}`),
  ]
    .filter(Boolean)
    .map((fact, index) => ({
      fact,
      category: categories[index] ?? categories[0] ?? "general",
      tags: normalizedTags.slice(0, 5),
    }));

  const agentDocuments = input.docsImpact.map((item) => {
    const filename = pickAgentDocFilename(item);
    const current = existingDocument(snapshot, filename);
    return {
      filename,
      reason: item,
      content: appendSection(current, "Romem Sync", [item, input.summary, ...input.decisions]),
    };
  });

  const skills = input.skillsImpact.map((item) => ({
    path: skillPathFromReason(item),
    reason: item,
    action: "create" as const,
    content: `# ${item}\n\n## Purpose\n- ${item}\n\n## Usage\n- Trigger when task summaries mention: ${item}\n\n## Notes\n- Derived from task ${input.taskId}\n`,
  }));

  return {
    summary: `Staged updates for ${input.agent} task ${input.taskId}`,
    rationale: "Fallback organizer derived proposal from the normalized task summary because live model output was unavailable.",
    categories,
    tags: normalizedTags,
    memories,
    todos: input.todos,
    agentDocuments,
    skills,
  };
}

export async function buildProposalOperations(
  rootDir: string,
  snapshot: ProjectSnapshot,
  draft: ProposalDraft,
  sourceTaskSummaryId: string,
): Promise<ProposalOperation[]> {
  const operations: ProposalOperation[] = [];

  for (const memory of draft.memories) {
    operations.push({
      id: createId("op"),
      type: "upsert_memory",
      title: `Remember: ${memory.fact.slice(0, 60)}`,
      target: memory.fact,
      category: memory.category,
      tags: memory.tags,
      metadata: { sourceTaskSummaryId },
    });
  }

  for (const todo of draft.todos) {
    operations.push({
      id: createId("op"),
      type: "create_todo",
      title: todo,
      target: todo,
      metadata: { sourceTaskSummaryId },
    });
  }

  const dedupedDocs = new Map<string, { content: string; existed: boolean }>();
  for (const document of draft.agentDocuments) {
    const canonical = canonicaliseAgentDocFilename(document.filename);
    const existing = snapshot.agentDocuments.find((item) => item.filename === canonical);
    const prior = dedupedDocs.get(canonical);
    const mergedContent = prior
      ? `${prior.content.trimEnd()}\n\n${document.content.trimStart()}`
      : document.content;
    dedupedDocs.set(canonical, { content: mergedContent, existed: Boolean(existing) });
  }

  for (const [filename, { content, existed }] of dedupedDocs.entries()) {
    operations.push(
      await buildDocumentOperation(
        rootDir,
        filename,
        `Sync ${filename}`,
        content,
        existed ? "update_agent_document" : "create_agent_document",
      ),
    );
  }

  for (const skill of draft.skills) {
    const existing = snapshot.skills.find((item) => item.path === skill.path);
    if (skill.action === "delete") {
      operations.push({
        id: createId("op"),
        type: "delete_skill",
        title: `Delete skill ${skill.path}`,
        target: skill.path,
        path: skill.path,
        metadata: { reason: skill.reason },
      });
      continue;
    }

    operations.push(
      await buildDocumentOperation(
        rootDir,
        skill.path,
        `${existing ? "Update" : "Create"} skill ${skill.path}`,
        skill.content,
        existing ? "update_skill" : "create_skill",
      ),
    );
  }

  return operations;
}

