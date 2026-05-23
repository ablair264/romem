import { Mastra } from "@mastra/core";
import type { RomemStore } from "../store.js";
import { createOrganizerTools } from "./tools.js";
import { createIngestTaskSummaryWorkflow } from "./workflows/ingest-task-summary.js";
import { createConsolidateMemoriesWorkflow } from "./workflows/consolidate-memories.js";

export function createMastraRuntime(store: RomemStore, rootDir: string) {
  const tools = createOrganizerTools(store);
  const ingestTaskSummaryWorkflow = createIngestTaskSummaryWorkflow(store, rootDir, tools);
  const consolidateMemoriesWorkflow = createConsolidateMemoriesWorkflow(store, tools);
  const mastra = new Mastra({
    workflows: { ingestTaskSummaryWorkflow, consolidateMemoriesWorkflow },
  });
  return { mastra, ingestTaskSummaryWorkflow, consolidateMemoriesWorkflow, tools };
}
