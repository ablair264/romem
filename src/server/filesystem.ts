import fs from "node:fs/promises";
import path from "node:path";
import { createPatch } from "diff";
import type { AgentDocument, ProposalOperation, SkillRecord } from "../shared/schema.js";
import { createId, relativeFromRoot, slugify } from "./utils.js";

const AGENT_DOCS = ["CLAUDE.md", "AGENTS.md", "GEMINI.md"];
const SKILL_DIR_CANDIDATES = ["skills", ".claude/skills", ".codex/skills", ".agents/skills"];

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readAgentDocuments(rootDir: string): Promise<Array<Omit<AgentDocument, "id" | "projectId" | "updatedAt">>> {
  const results: Array<Omit<AgentDocument, "id" | "projectId" | "updatedAt">> = [];
  for (const filename of AGENT_DOCS) {
    const absolutePath = path.join(rootDir, filename);
    if (!(await exists(absolutePath))) continue;
    const content = await fs.readFile(absolutePath, "utf8");
    results.push({ filename, path: filename, content });
  }
  return results;
}

export async function readSkills(rootDir: string): Promise<Array<Omit<SkillRecord, "id" | "projectId" | "updatedAt">>> {
  const results: Array<Omit<SkillRecord, "id" | "projectId" | "updatedAt">> = [];
  for (const dirCandidate of SKILL_DIR_CANDIDATES) {
    const absoluteDir = path.join(rootDir, dirCandidate);
    if (!(await exists(absoluteDir))) continue;
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = path.join(absoluteDir, entry.name, "SKILL.md");
      if (!(await exists(skillPath))) continue;
      const content = await fs.readFile(skillPath, "utf8");
      results.push({
        path: relativeFromRoot(rootDir, skillPath),
        title: entry.name,
        content,
      });
    }
  }
  return results;
}

export async function applyOperation(rootDir: string, operation: ProposalOperation) {
  if (!operation.path) return;
  const absolutePath = path.join(rootDir, operation.path);

  if (operation.type === "delete_skill") {
    if (await exists(absolutePath)) {
      await fs.unlink(absolutePath);
    }
    return;
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, operation.content ?? "", "utf8");
}

export async function buildDocumentOperation(
  rootDir: string,
  targetPath: string,
  title: string,
  nextContent: string,
  type: "update_agent_document" | "create_agent_document" | "update_skill" | "create_skill",
): Promise<ProposalOperation> {
  const absolutePath = path.join(rootDir, targetPath);
  const before = (await exists(absolutePath)) ? await fs.readFile(absolutePath, "utf8") : "";
  return {
    id: createId("op"),
    type,
    title,
    target: targetPath,
    path: targetPath,
    content: nextContent,
    diff: createPatch(targetPath, before, nextContent),
    metadata: {},
  };
}

export function skillPathFromReason(reason: string) {
  const slug = slugify(reason.split(/\s+/).slice(0, 5).join(" "));
  return `skills/generated/${slug}/SKILL.md`;
}

