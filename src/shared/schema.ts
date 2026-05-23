import { z } from "zod";

export const AgentKindSchema = z.enum(["codex", "claude", "gemini"]);
export type AgentKind = z.infer<typeof AgentKindSchema>;

export const TaskSummaryInputSchema = z.object({
  projectId: z.string().min(1),
  agent: AgentKindSchema,
  taskId: z.string().min(1),
  summary: z.string().min(1),
  changes: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
  gotchas: z.array(z.string()).default([]),
  todos: z.array(z.string()).default([]),
  docsImpact: z.array(z.string()).default([]),
  skillsImpact: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});
export type TaskSummaryInput = z.infer<typeof TaskSummaryInputSchema>;

export const ProposalOperationTypeSchema = z.enum([
  "upsert_memory",
  "delete_memory",
  "create_todo",
  "update_agent_document",
  "create_agent_document",
  "update_skill",
  "create_skill",
  "delete_skill",
]);
export type ProposalOperationType = z.infer<typeof ProposalOperationTypeSchema>;

export const ProposalOperationSchema = z.object({
  id: z.string().min(1),
  type: ProposalOperationTypeSchema,
  title: z.string().min(1),
  target: z.string().min(1),
  path: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  content: z.string().optional(),
  diff: z.string().optional(),
  metadata: z.record(z.any()).default({}),
});
export type ProposalOperation = z.infer<typeof ProposalOperationSchema>;

export const ProposalDraftSchema = z.object({
  summary: z.string().min(1),
  rationale: z.string().min(1),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  memories: z
    .array(
      z.object({
        fact: z.string().min(1),
        category: z.string().min(1),
        tags: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  todos: z.array(z.string()).default([]),
  agentDocuments: z
    .array(
      z.object({
        filename: z.string().min(1),
        reason: z.string().min(1),
        content: z.string().min(1),
      }),
    )
    .default([]),
  skills: z
    .array(
      z.object({
        path: z.string().min(1),
        reason: z.string().min(1),
        content: z.string().min(1),
        action: z.enum(["create", "update", "delete"]).default("update"),
      }),
    )
    .default([]),
});
export type ProposalDraft = z.infer<typeof ProposalDraftSchema>;

export const MemoryEntrySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  fact: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  source: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

export const TodoSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  status: z.enum(["open", "done"]),
  sourceTaskSummaryId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Todo = z.infer<typeof TodoSchema>;

export const ProposalSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskSummaryId: z.string(),
  status: z.enum(["staged", "applied", "rejected", "failed", "queued"]),
  summary: z.string(),
  rationale: z.string(),
  categories: z.array(z.string()),
  tags: z.array(z.string()),
  operations: z.array(ProposalOperationSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  error: z.string().nullable(),
});
export type Proposal = z.infer<typeof ProposalSchema>;

export const TaskSummaryRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  agent: AgentKindSchema,
  taskId: z.string(),
  payload: TaskSummaryInputSchema,
  status: z.enum(["received", "queued", "staged", "applied", "rejected", "failed"]),
  proposalId: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskSummaryRecord = z.infer<typeof TaskSummaryRecordSchema>;

export const AgentDocumentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  filename: z.string(),
  path: z.string(),
  content: z.string(),
  updatedAt: z.string(),
});
export type AgentDocument = z.infer<typeof AgentDocumentSchema>;

export const SkillRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  path: z.string(),
  title: z.string(),
  content: z.string(),
  updatedAt: z.string(),
});
export type SkillRecord = z.infer<typeof SkillRecordSchema>;

export const ProjectOverviewSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootPath: z.string(),
  categories: z.array(z.string()),
  stats: z.object({
    memories: z.number(),
    proposals: z.number(),
    todos: z.number(),
    agentDocuments: z.number(),
    skills: z.number(),
    pendingApprovals: z.number(),
  }),
  recentTasks: z.array(TaskSummaryRecordSchema),
});
export type ProjectOverview = z.infer<typeof ProjectOverviewSchema>;
