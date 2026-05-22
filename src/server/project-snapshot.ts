import type { AgentDocument, MemoryEntry, SkillRecord } from "../shared/schema.js";
import type { RomemStore } from "./store.js";

export type ProjectSnapshot = {
  categories: string[];
  memories: MemoryEntry[];
  agentDocuments: AgentDocument[];
  skills: SkillRecord[];
};

export function collectProjectSnapshot(store: RomemStore, projectId: string): ProjectSnapshot {
  const overview = store.getOverview(projectId);
  return {
    categories: overview?.categories ?? [],
    memories: store.listMemories(projectId),
    agentDocuments: store.listAgentDocuments(projectId),
    skills: store.listSkills(projectId),
  };
}

