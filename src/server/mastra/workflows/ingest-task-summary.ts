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
            "You are to review the following task summary and project snapshot, then generate a detailed proposal draft.",
            "",
            "CRITICAL INSTRUCTIONS FOR YOUR OUTPUT:",
            "1. 'summary': Write a concise, high-level summary of the proposed changes.",
            "2. 'rationale': You MUST provide a clear, detailed rationale explaining why these memories, todos, and document/skill updates are proposed and how they benefit the project. Do NOT leave this field empty.",
            "3. 'memories': Add important facts, architecture decisions, or gotchas learned from the task summary. Keep them clear and factual.",
            "4. 'todos': Extract any pending action items or todos mentioned in the task summary.",
            "5. 'agentDocuments': Propose updates to agent documentation (like CLAUDE.md or AGENTS.md) if there are documentation impacts.",
            "6. 'skills': Propose additions or modifications to skills if there are skills impacts.",
            "",
            "CRITICAL FORMATTING REQUIREMENT:",
            "Your output must conform EXACTLY to the following JSON schema. You MUST output ONLY the raw, valid JSON object conforming exactly to this structure. DO NOT wrap the output in markdown code blocks like ```json ... ```. DO NOT include any introductory or concluding conversational text.",
            "",
            JSON.stringify({
              summary: "string (required)",
              rationale: "string (required)",
              categories: "string[]",
              tags: "string[]",
              memories: "Array of { fact: string, category: string, tags: string[] }",
              todos: "string[]",
              agentDocuments: "Array of { filename: string, reason: string, content: string }",
              skills: "Array of { path: string, reason: string, content: string, action: 'create'|'update'|'delete' }",
            }, null, 2),
            "",
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
          },
        );

        let draft = fallbackDraft;
        let usedFallback = true;

        if (response.text) {
          try {
            const jsonStart = response.text.indexOf("{");
            const jsonEnd = response.text.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1) {
              const jsonStr = response.text.substring(jsonStart, jsonEnd + 1);
              const parsed = JSON.parse(jsonStr);
              if (parsed && typeof parsed === "object") {
                draft = {
                  summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary : fallbackDraft.summary,
                  rationale: typeof parsed.rationale === "string" && parsed.rationale.trim() ? parsed.rationale : "Proposal generated based on the task summary changes.",
                  categories: Array.isArray(parsed.categories) ? parsed.categories : fallbackDraft.categories,
                  tags: Array.isArray(parsed.tags) ? parsed.tags : fallbackDraft.tags,
                  memories: Array.isArray(parsed.memories) ? parsed.memories : fallbackDraft.memories,
                  todos: Array.isArray(parsed.todos) ? parsed.todos : fallbackDraft.todos,
                  agentDocuments: Array.isArray(parsed.agentDocuments) ? parsed.agentDocuments : fallbackDraft.agentDocuments,
                  skills: Array.isArray(parsed.skills) ? parsed.skills : fallbackDraft.skills,
                };
                usedFallback = false;
              }
            }
          } catch (e) {
            console.warn("Failed to parse agent text response as JSON", e);
          }
        }

        return {
          ...inputData,
          draft,
          usedFallback,
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
        inputData.draft.rationale.trim() || "Proposal generated based on the task summary changes.",
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

