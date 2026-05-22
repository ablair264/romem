import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { ProposalDraftSchema, TaskSummaryInputSchema } from "../../../shared/schema.js";
import type { ProposalDraft, TaskSummaryInput } from "../../../shared/schema.js";
import type { RomemStore } from "../../store.js";
import type { ProjectSnapshot } from "../../project-snapshot.js";
import { collectProjectSnapshot } from "../../project-snapshot.js";
import { buildFallbackDraft, buildProposalOperations } from "../../proposal-builder.js";
import { createOrganizerTools } from "../tools.js";
import { getOrganizerModel } from "../model.js";
import { createOrganizerAgent } from "../agents/organizer-agent.js";

const snapshotSchema = z.object({
  categories: z.array(z.string()),
  memories: z.array(
    z.object({
      fact: z.string(),
      category: z.string(),
      tags: z.array(z.string()),
    }),
  ),
  agentDocuments: z.array(
    z.object({
      filename: z.string(),
      path: z.string(),
      content: z.string(),
    }),
  ),
  skills: z.array(
    z.object({
      path: z.string(),
      title: z.string(),
      content: z.string(),
    }),
  ),
});

export function createIngestTaskSummaryWorkflow(
  store: RomemStore,
  rootDir: string,
  tools: ReturnType<typeof createOrganizerTools>,
) {
  const captureSummary = createStep({
    id: "capture-summary",
    inputSchema: TaskSummaryInputSchema,
    outputSchema: z.object({
      taskSummaryRecordId: z.string(),
      taskSummary: TaskSummaryInputSchema,
    }),
    execute: async ({ inputData }) => {
      const record = store.createTaskSummary(inputData);
      return {
        taskSummaryRecordId: record.id,
        taskSummary: inputData,
      };
    },
  });

  const inspectState = createStep({
    id: "inspect-state",
    inputSchema: z.object({
      taskSummaryRecordId: z.string(),
      taskSummary: TaskSummaryInputSchema,
    }),
    outputSchema: z.object({
      taskSummaryRecordId: z.string(),
      taskSummary: TaskSummaryInputSchema,
      snapshot: snapshotSchema,
    }),
    execute: async ({ inputData }) => {
      const snapshot = collectProjectSnapshot(store, inputData.taskSummary.projectId);
      return { ...inputData, snapshot };
    },
  });

  const draftProposal = createStep({
    id: "draft-proposal",
    inputSchema: z.object({
      taskSummaryRecordId: z.string(),
      taskSummary: TaskSummaryInputSchema,
      snapshot: snapshotSchema,
    }),
    outputSchema: z.object({
      taskSummaryRecordId: z.string(),
      taskSummary: TaskSummaryInputSchema,
      snapshot: snapshotSchema,
      draft: ProposalDraftSchema,
      usedFallback: z.boolean(),
    }),
    execute: async ({ inputData }) => {
      const fallbackDraft = buildFallbackDraft(inputData.taskSummary, inputData.snapshot as ProjectSnapshot);

      const model = getOrganizerModel({
        baseURL: store.getSetting('ollama_base_url'),
        model: store.getSetting('ollama_model'),
        apiKey: store.getSetting('ollama_api_key'),
      });
      const agent = model ? createOrganizerAgent(model, tools) : null;

      if (!agent) {
        return { ...inputData, draft: fallbackDraft, usedFallback: true };
      }

      try {
        const response = await agent.generate(
          [
            "Task summary:",
            JSON.stringify(inputData.taskSummary, null, 2),
            "",
            "Project snapshot:",
            JSON.stringify(
              {
                categories: inputData.snapshot.categories,
                memories: inputData.snapshot.memories.slice(0, 15),
                agentDocuments: inputData.snapshot.agentDocuments.map((entry) => entry.filename),
                skills: inputData.snapshot.skills.map((entry) => entry.path),
              },
              null,
              2,
            ),
          ].join("\n"),
          {
            activeTools: [],
            maxSteps: 2,
            structuredOutput: {
              schema: ProposalDraftSchema,
              jsonPromptInjection: true,
            },
          },
        );

        return {
          ...inputData,
          draft: response.object ?? fallbackDraft,
          usedFallback: !response.object,
        };
      } catch {
        return { ...inputData, draft: fallbackDraft, usedFallback: true };
      }
    },
  });

  const persistProposal = createStep({
    id: "persist-proposal",
    inputSchema: z.object({
      taskSummaryRecordId: z.string(),
      taskSummary: TaskSummaryInputSchema,
      snapshot: snapshotSchema,
      draft: ProposalDraftSchema,
      usedFallback: z.boolean(),
    }),
    outputSchema: z.object({
      proposalId: z.string(),
      taskSummaryRecordId: z.string(),
      usedFallback: z.boolean(),
    }),
    execute: async ({ inputData }) => {
      const operations = await buildProposalOperations(rootDir, inputData.snapshot as ProjectSnapshot, inputData.draft, inputData.taskSummaryRecordId);
      const proposal = store.saveProposal(
        inputData.taskSummary.projectId,
        inputData.taskSummaryRecordId,
        inputData.draft.summary,
        inputData.draft.rationale,
        inputData.draft.categories,
        inputData.draft.tags,
        operations,
      );
      return {
        proposalId: proposal.id,
        taskSummaryRecordId: inputData.taskSummaryRecordId,
        usedFallback: inputData.usedFallback,
      };
    },
  });

  return createWorkflow({
    id: "ingest-task-summary",
    inputSchema: TaskSummaryInputSchema,
    outputSchema: z.object({
      proposalId: z.string(),
      taskSummaryRecordId: z.string(),
      usedFallback: z.boolean(),
    }),
  })
    .then(captureSummary)
    .then(inspectState)
    .then(draftProposal)
    .then(persistProposal)
    .commit();
}

