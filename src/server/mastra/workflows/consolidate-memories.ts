import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import type { RomemStore } from "../../store.js";
import { getOrganizerModel } from "../model.js";
import { createOrganizerAgent } from "../agents/organizer-agent.js";
import { createId } from "../../utils.js";

const inputSchema = z.object({ projectId: z.string().min(1) });

const ConsolidationDraftSchema = z.object({
  summary: z.string(),
  rationale: z.string(),
  deletes: z
    .array(z.object({ id: z.string(), reason: z.string() }))
    .default([]),
  merges: z
    .array(
      z.object({
        deleteIds: z.array(z.string()),
        newFact: z.string(),
        category: z.string(),
        tags: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

export function createConsolidateMemoriesWorkflow(
  store: RomemStore,
  tools: Record<string, unknown>,
) {
  const analyseMemories = createStep({
    id: "analyse-memories",
    inputSchema,
    outputSchema: z.object({
      projectId: z.string(),
      draft: ConsolidationDraftSchema.nullable(),
      skipped: z.boolean(),
    }),
    execute: async ({ inputData }) => {
      const { projectId } = inputData;
      const memories = store.listMemories(projectId);

      if (memories.length < 3) {
        return { projectId, draft: null, skipped: true };
      }

      const model = getOrganizerModel({
        baseURL: store.getSetting("ollama_base_url"),
        model: store.getSetting("ollama_model"),
        apiKey: store.getSetting("ollama_api_key"),
      });

      if (!model) {
        return { projectId, draft: null, skipped: true };
      }

      const agent = createOrganizerAgent(model, tools);
      if (!agent) return { projectId, draft: null, skipped: true };

      const memoryList = memories
        .map((m) => `[${m.id}] (${m.category}) ${m.fact}`)
        .join("\n");

      try {
        const response = await agent.generate(
          [
            `You are a memory consolidation agent for a software project.`,
            ``,
            `Below are all ${memories.length} memory facts for this project. Your job is to:`,
            `1. Identify near-duplicate or redundant facts — keep the best, delete the rest`,
            `2. Identify facts that are clearly outdated or contradicted by newer facts`,
            `3. Identify facts that can be merged into one cleaner, more precise fact`,
            ``,
            `Rules:`,
            `- Only propose deletions you are highly confident about`,
            `- When merging, the newFact must be more informative than any single source fact`,
            `- If no changes are needed, return empty arrays — that is perfectly valid`,
            `- Never delete the last fact in a category`,
            ``,
            `Memory list:`,
            memoryList,
          ].join("\n"),
          {
            activeTools: [],
            maxSteps: 2,
            structuredOutput: {
              schema: ConsolidationDraftSchema,
              jsonPromptInjection: true,
            },
          },
        );

        return {
          projectId,
          draft: response.object ?? null,
          skipped: !response.object,
        };
      } catch {
        return { projectId, draft: null, skipped: true };
      }
    },
  });

  const persistConsolidation = createStep({
    id: "persist-consolidation",
    inputSchema: z.object({
      projectId: z.string(),
      draft: ConsolidationDraftSchema.nullable(),
      skipped: z.boolean(),
    }),
    outputSchema: z.object({
      proposalId: z.string().nullable(),
      deletedCount: z.number(),
      mergedCount: z.number(),
      skipped: z.boolean(),
    }),
    execute: async ({ inputData }) => {
      const { projectId, draft, skipped } = inputData;

      if (skipped || !draft) {
        return { proposalId: null, deletedCount: 0, mergedCount: 0, skipped: true };
      }

      const totalDeletes = draft.deletes.length + draft.merges.reduce((s, m) => s + m.deleteIds.length, 0);
      const totalMerges = draft.merges.length;

      if (totalDeletes === 0 && totalMerges === 0) {
        return { proposalId: null, deletedCount: 0, mergedCount: 0, skipped: true };
      }

      const operations = [];

      for (const del of draft.deletes) {
        operations.push({
          id: createId("op"),
          type: "delete_memory" as const,
          title: `Remove: ${del.reason.slice(0, 60)}`,
          target: del.id,
          metadata: { reason: del.reason, source: "consolidation" },
        });
      }

      for (const merge of draft.merges) {
        for (const delId of merge.deleteIds) {
          operations.push({
            id: createId("op"),
            type: "delete_memory" as const,
            title: `Merge-delete duplicate`,
            target: delId,
            metadata: { mergedInto: merge.newFact, source: "consolidation" },
          });
        }
        operations.push({
          id: createId("op"),
          type: "upsert_memory" as const,
          title: `Remember (merged): ${merge.newFact.slice(0, 60)}`,
          target: merge.newFact,
          category: merge.category,
          tags: merge.tags,
          metadata: { source: "consolidation" },
        });
      }

      const sentinelTaskId = createId("consolidation");
      const taskRecord = store.createTaskSummary({
        projectId,
        agent: "claude",
        taskId: sentinelTaskId,
        summary: draft.summary,
        changes: [],
        decisions: [],
        gotchas: [],
        todos: [],
        docsImpact: [],
        skillsImpact: [],
        categories: [],
        tags: ["consolidation"],
      });

      const proposal = store.saveProposal(
        projectId,
        taskRecord.id,
        draft.summary,
        draft.rationale,
        ["consolidation"],
        ["consolidation"],
        operations,
      );

      return {
        proposalId: proposal.id,
        deletedCount: totalDeletes,
        mergedCount: totalMerges,
        skipped: false,
      };
    },
  });

  return createWorkflow({
    id: "consolidate-memories",
    inputSchema,
    outputSchema: z.object({
      proposalId: z.string().nullable(),
      deletedCount: z.number(),
      mergedCount: z.number(),
      skipped: z.boolean(),
    }),
  })
    .then(analyseMemories)
    .then(persistConsolidation)
    .commit();
}
