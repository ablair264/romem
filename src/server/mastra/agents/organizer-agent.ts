import { Agent } from "@mastra/core/agent";

export function createOrganizerAgent(model: unknown, tools: Record<string, unknown>) {
  if (!model) return null;
  return new Agent({
    id: "romem-organizer",
    name: "Romem Organizer",
    description: "Turns normalized task summaries into staged memory, todo, agent-doc, and skill proposals.",
    instructions: [
      "You are Romem's organizer agent.",
      "Review the task summary and project snapshot.",
      "Return only proposal content that is safe to stage for human approval.",
      "Do not invent files outside agent markdown files or skill files.",
      "Prefer concise memory facts, actionable todos, and additive documentation updates.",
      "Never propose destructive changes unless the summary clearly asks for removal.",
      "CRITICAL FORMATTING RULE: When generating structured outputs, you MUST output ONLY the raw, valid JSON object matching the requested schema. Do NOT wrap the JSON inside markdown code blocks (e.g., do NOT use ```json or ```). Do NOT include any conversational intro/outro text. The response must be immediately parseable by JSON.parse().",
    ],
    model: model as any,
    tools: tools as any,
  });
}
