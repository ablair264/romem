import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import type { RomemStore } from "../store.js";
import { collectProjectSnapshot } from "../project-snapshot.js";
import { createPatch } from "diff";

export function createOrganizerTools(store: RomemStore) {
  const inspectProjectStateTool = createTool({
    id: "inspect-project-state",
    description: "Inspect current project memories, agent files, skills, and categories.",
    inputSchema: z.object({ projectId: z.string() }),
    outputSchema: z.object({
      categories: z.array(z.string()),
      memoryFacts: z.array(z.string()),
      agentDocuments: z.array(z.string()),
      skills: z.array(z.string()),
    }),
    execute: async ({ projectId }) => {
      const snapshot = collectProjectSnapshot(store, projectId);
      return {
        categories: snapshot.categories,
        memoryFacts: snapshot.memories.slice(0, 25).map((entry) => entry.fact),
        agentDocuments: snapshot.agentDocuments.map((entry) => entry.filename),
        skills: snapshot.skills.map((entry) => entry.path),
      };
    },
  });

  const readAgentDocumentTool = createTool({
    id: "read-agent-document",
    description: "Read an agent-specific markdown document like CLAUDE.md or GEMINI.md.",
    inputSchema: z.object({ projectId: z.string(), filename: z.string() }),
    outputSchema: z.object({ content: z.string() }),
    execute: async ({ projectId, filename }) => {
      const document = store.listAgentDocuments(projectId).find((entry) => entry.filename === filename);
      return { content: document?.content ?? "" };
    },
  });

  const readSkillTool = createTool({
    id: "read-skill",
    description: "Read a project skill file.",
    inputSchema: z.object({ projectId: z.string(), skillPath: z.string() }),
    outputSchema: z.object({ content: z.string() }),
    execute: async ({ projectId, skillPath }) => {
      const skill = store.listSkills(projectId).find((entry) => entry.path === skillPath);
      return { content: skill?.content ?? "" };
    },
  });

  const previewDiffTool = createTool({
    id: "preview-diff",
    description: "Create a unified diff between current and proposed content.",
    inputSchema: z.object({
      targetPath: z.string(),
      currentContent: z.string(),
      nextContent: z.string(),
    }),
    outputSchema: z.object({ diff: z.string() }),
    execute: async ({ targetPath, currentContent, nextContent }) => ({
      diff: createPatch(targetPath, currentContent, nextContent),
    }),
  });

  return { inspectProjectStateTool, readAgentDocumentTool, readSkillTool, previewDiffTool };
}

