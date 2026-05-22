import { Mastra } from "@mastra/core";
import type { RomemStore } from "../store.js";
import { createOrganizerTools } from "./tools.js";
import { getOrganizerModel } from "./model.js";
import { createOrganizerAgent } from "./agents/organizer-agent.js";
import { createIngestTaskSummaryWorkflow } from "./workflows/ingest-task-summary.js";

export function createMastraRuntime(store: RomemStore, rootDir: string) {
  const tools = createOrganizerTools(store);
  const organizerAgent = createOrganizerAgent(getOrganizerModel(), tools);
  const ingestTaskSummaryWorkflow = createIngestTaskSummaryWorkflow(store, rootDir, organizerAgent);

  const mastra = new Mastra({
    agents: organizerAgent ? { organizerAgent } : undefined,
    workflows: { ingestTaskSummaryWorkflow },
  });

  return { mastra, organizerAgent, ingestTaskSummaryWorkflow, tools };
}
