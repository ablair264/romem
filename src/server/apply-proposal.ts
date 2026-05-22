import path from "node:path";
import type { Proposal } from "../shared/schema.js";
import type { RomemStore } from "./store.js";
import { applyOperation } from "./filesystem.js";

export async function applyProposal(rootDir: string, store: RomemStore, proposal: Proposal) {
  for (const operation of proposal.operations) {
    switch (operation.type) {
      case "upsert_memory":
        store.upsertMemory(
          proposal.projectId,
          operation.target,
          operation.category ?? "general",
          operation.tags ?? [],
          `proposal:${proposal.id}`,
        );
        break;
      case "create_todo":
        store.createTodo(proposal.projectId, operation.target, proposal.taskSummaryId);
        break;
      case "update_agent_document":
      case "create_agent_document":
        await applyOperation(rootDir, operation);
        store.upsertAgentDocument(proposal.projectId, path.basename(operation.path!), operation.path!, operation.content ?? "");
        break;
      case "update_skill":
      case "create_skill":
        await applyOperation(rootDir, operation);
        store.upsertSkill(proposal.projectId, operation.path!, path.basename(path.dirname(operation.path!)), operation.content ?? "");
        break;
      case "delete_skill":
        await applyOperation(rootDir, operation);
        store.deleteSkill(proposal.projectId, operation.path!);
        break;
      default:
        break;
    }
  }
}
