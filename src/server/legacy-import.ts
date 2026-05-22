import fs from "node:fs/promises";
import path from "node:path";
import type { RomemStore } from "./store.js";
import { readAgentDocuments, readSkills } from "./filesystem.js";

type LegacyMemoryDb = {
  project_context?: {
    categories?: string[];
  };
  memories?: Array<{
    fact: string;
    category: string;
    tags?: string[];
    created_at?: string;
    updated_at?: string;
  }>;
};

export async function importLegacyProjectMemory(rootDir: string, projectId: string, store: RomemStore) {
  const legacyPath = path.join(rootDir, ".mcp-memory", "project-memory.json");
  try {
    const raw = await fs.readFile(legacyPath, "utf8");
    const data = JSON.parse(raw) as LegacyMemoryDb;
    const categories = data.project_context?.categories?.length
      ? [...new Set(data.project_context.categories.map((item) => item.toLowerCase().trim()).filter(Boolean))]
      : ["general", "style-guide", "architecture", "todo", "database"];
    store.replaceCategories(projectId, categories);

    for (const memory of data.memories ?? []) {
      store.upsertMemory(projectId, memory.fact, memory.category, memory.tags ?? [], "legacy-import");
      for (const tag of memory.tags ?? []) {
        store.upsertTag(projectId, tag);
      }
    }
  } catch {
    store.replaceCategories(projectId, ["general", "style-guide", "architecture", "todo", "database"]);
  }

  const agentDocuments = await readAgentDocuments(rootDir);
  for (const document of agentDocuments) {
    store.upsertAgentDocument(projectId, document.filename, document.path, document.content);
  }

  const skills = await readSkills(rootDir);
  for (const skill of skills) {
    store.upsertSkill(projectId, skill.path, skill.title, skill.content);
  }
}
