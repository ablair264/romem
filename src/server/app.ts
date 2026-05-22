import express from "express";
import path from "node:path";
import fs from "node:fs";
import { MastraServer } from "@mastra/express";
import { TaskSummaryInputSchema } from "../shared/schema.js";
import { importLegacyProjectMemory } from "./legacy-import.js";
import { createMastraRuntime } from "./mastra/index.js";
import { RomemStore } from "./store.js";
import { applyProposal } from "./apply-proposal.js";

export async function createRomemApp(rootDir: string) {
  const projectId = process.env.ROMEM_PROJECT_ID || "romem";
  const store = new RomemStore(rootDir);
  store.ensureProject(projectId, path.basename(rootDir));
  if (store.categoriesCount(projectId) === 0) {
    await importLegacyProjectMemory(rootDir, projectId, store);
  }

  const { mastra, ingestTaskSummaryWorkflow } = createMastraRuntime(store, rootDir);

  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const mastraServer = new MastraServer({ app, mastra });
  await mastraServer.init();

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      projectId,
      hasOllama: Boolean(process.env.OLLAMA_BASE_URL),
      runtime: "mastra-express",
    });
  });

  app.get("/api/projects", (_req, res) => {
    res.json(store.listProjects());
  });

  app.get("/api/settings", (_req, res) => {
    const dbSettings = store.getAllSettings();
    res.json({
      server_url: dbSettings.server_url ?? process.env.ROMEM_SERVER_URL ?? "",
      ollama_base_url: dbSettings.ollama_base_url ?? process.env.OLLAMA_BASE_URL ?? "",
      ollama_model: dbSettings.ollama_model ?? process.env.OLLAMA_MODEL ?? "llama3.1:8b",
      ollama_api_key: dbSettings.ollama_api_key ?? process.env.OLLAMA_API_KEY ?? "ollama",
    });
  });

  app.put("/api/settings", (req, res) => {
    const keys = ["server_url", "ollama_base_url", "ollama_model", "ollama_api_key"] as const;
    for (const key of keys) {
      if (typeof req.body[key] === "string") {
        store.setSetting(key, req.body[key]);
      }
    }
    res.json(store.getAllSettings());
  });

  app.get("/api/projects/:id/overview", (req, res) => {
    const overview = store.getOverview(req.params.id);
    if (!overview) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json(overview);
  });

  app.get("/api/projects/:id/memories", (req, res) => {
    const search = String(req.query.search || "").toLowerCase();
    const category = String(req.query.category || "").toLowerCase();
    const tag = String(req.query.tag || "").toLowerCase();
    const memories = store.listMemories(req.params.id).filter((memory) => {
      if (search && !`${memory.fact} ${memory.tags.join(" ")}`.toLowerCase().includes(search)) return false;
      if (category && memory.category.toLowerCase() !== category) return false;
      if (tag && !memory.tags.includes(tag)) return false;
      return true;
    });
    res.json(memories);
  });

  app.post("/api/projects/:id/categories", (req, res) => {
    const { category } = req.body;
    if (!category || typeof category !== "string") {
      res.status(400).json({ error: "Category name is required." });
      return;
    }
    const normalized = category.toLowerCase().trim();
    if (!normalized) {
      res.status(400).json({ error: "Category name cannot be empty." });
      return;
    }
    try {
      store.addCategory(req.params.id, normalized);
      res.status(201).json({ category: normalized });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.delete("/api/projects/:id/categories/:categoryName", (req, res) => {
    try {
      const categoryName = req.params.categoryName.toLowerCase().trim();
      store.deleteCategory(req.params.id, categoryName);
      res.json({ success: true, category: categoryName });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });


  app.get("/api/projects/:id/proposals", (req, res) => {
    res.json(store.listProposals(req.params.id));
  });

  app.get("/api/projects/:id/agent-files", (req, res) => {
    res.json(store.listAgentDocuments(req.params.id));
  });

  app.get("/api/projects/:id/skills", (req, res) => {
    res.json(store.listSkills(req.params.id));
  });

  app.put("/api/projects/:id/memories/:memoryId", (req, res) => {
    const { fact, category, tags, source } = req.body;
    if (!fact || typeof fact !== "string") {
      res.status(400).json({ error: "Memory fact content is required." });
      return;
    }
    if (!category || typeof category !== "string") {
      res.status(400).json({ error: "Category is required." });
      return;
    }
    if (!Array.isArray(tags)) {
      res.status(400).json({ error: "Tags must be an array of strings." });
      return;
    }
    try {
      store.updateMemory(req.params.id, req.params.memoryId, fact, category, tags, source || "manual");
      const updated = store.listMemories(req.params.id).find((m) => m.id === req.params.memoryId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.delete("/api/projects/:id/memories/:memoryId", (req, res) => {
    try {
      store.deleteMemory(req.params.id, req.params.memoryId);
      res.json({ success: true, memoryId: req.params.memoryId });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.put("/api/projects/:id/agent-files/:fileId", async (req, res) => {
    const { content } = req.body;
    if (typeof content !== "string") {
      res.status(400).json({ error: "File content must be a string." });
      return;
    }
    try {
      const doc = store.getAgentDocument(req.params.fileId);
      if (!doc) {
        res.status(404).json({ error: "Agent file not found." });
        return;
      }
      store.upsertAgentDocument(req.params.id, doc.filename, doc.path, content);
      const absolutePath = path.join(rootDir, doc.path);
      await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.promises.writeFile(absolutePath, content, "utf8");
      
      const updated = store.getAgentDocument(req.params.fileId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.put("/api/projects/:id/skills/:skillId", async (req, res) => {
    const { content } = req.body;
    if (typeof content !== "string") {
      res.status(400).json({ error: "Skill content must be a string." });
      return;
    }
    try {
      const skill = store.getSkill(req.params.skillId);
      if (!skill) {
        res.status(404).json({ error: "Skill not found." });
        return;
      }
      store.upsertSkill(req.params.id, skill.path, skill.title, content);
      const absolutePath = path.join(rootDir, skill.path);
      await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.promises.writeFile(absolutePath, content, "utf8");
      
      const updated = store.getSkill(req.params.skillId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.put("/api/projects/:id/todos/:todoId", (req, res) => {
    const { title, status } = req.body;
    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "Todo title is required." });
      return;
    }
    if (status !== "open" && status !== "done") {
      res.status(400).json({ error: "Status must be either 'open' or 'done'." });
      return;
    }
    try {
      store.updateTodo(req.params.id, req.params.todoId, title, status);
      const updated = store.getTodo(req.params.todoId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/projects/:id/todos", (req, res) => {
    res.json(store.listTodos(req.params.id));
  });

  app.get("/api/projects/:id/task-summaries", (req, res) => {
    res.json(store.listTaskSummaries(req.params.id));
  });

  app.post("/api/projects/:id/task-summaries", async (req, res) => {
    const parseResult = TaskSummaryInputSchema.safeParse({
      ...req.body,
      projectId: req.params.id,
    });
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.flatten() });
    }

    store.ensureProject(req.params.id, req.params.id);
    const run = await ingestTaskSummaryWorkflow.createRun({ resourceId: req.params.id });
    const result = await run.start({ inputData: parseResult.data });
    if (result.status !== "success") {
      return res.status(500).json({ error: "Workflow did not complete successfully.", result });
    }

    const proposal = store.getProposal(result.result.proposalId);
    const taskSummary = store.getTaskSummary(result.result.taskSummaryRecordId);
    return res.status(201).json({ proposal, taskSummary, usedFallback: result.result.usedFallback });
  });

  app.post("/api/proposals/:id/approve", async (req, res) => {
    const proposal = store.getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: "Proposal not found." });
    if (proposal.status !== "staged") return res.status(409).json({ error: "Proposal is not awaiting approval." });

    try {
      await applyProposal(rootDir, store, proposal);
      store.setProposalStatus(proposal.id, "applied");
      store.updateTaskSummaryStatus(proposal.taskSummaryId, "applied", proposal.id, null);
      return res.json(store.getProposal(proposal.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown apply error";
      store.setProposalStatus(proposal.id, "failed", message);
      store.updateTaskSummaryStatus(proposal.taskSummaryId, "failed", proposal.id, message);
      return res.status(500).json({ error: message });
    }
  });

  app.post("/api/proposals/:id/reject", (req, res) => {
    const proposal = store.getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: "Proposal not found." });
    const reason = typeof req.body?.reason === "string" ? req.body.reason : null;
    store.setProposalStatus(proposal.id, "rejected", reason);
    store.updateTaskSummaryStatus(proposal.taskSummaryId, "rejected", proposal.id, reason);
    return res.json(store.getProposal(proposal.id));
  });

  app.get("/api/projects/:id/connect", (req, res) => {
    const pid = req.params.id;
    const serverUrl = store.getSetting('server_url') ?? process.env.ROMEM_SERVER_URL ?? "";
    const endpoint = `${serverUrl}/api/projects/${pid}/task-summaries`;

    const curlSnippet = `curl -sf -X POST '${endpoint}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "agent": "claude",
    "taskId": "my-task-id",
    "summary": "Describe what was done",
    "changes": [],
    "decisions": [],
    "gotchas": [],
    "todos": [],
    "docsImpact": [],
    "skillsImpact": [],
    "categories": ["general"],
    "tags": []
  }'`;

    const claudeMdSnippet = `## Romem Memory Hook

At the end of each coding task, run the following curl command to record the task summary into Romem:

\`\`\`bash
curl -sf -X POST '${endpoint}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "agent": "claude",
    "taskId": "<session or task id>",
    "summary": "<what was done>",
    "changes": [],
    "decisions": [],
    "gotchas": [],
    "todos": [],
    "docsImpact": [],
    "skillsImpact": [],
    "categories": ["general"],
    "tags": []
  }'
\`\`\`

Change the \`agent\` field to match your agent: \`claude\`, \`codex\`, or \`gemini\`.`;

    const claudeCodeHookSnippet = JSON.stringify({
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command: `python3 -c "import json,sys,subprocess; d=json.load(sys.stdin); subprocess.Popen(['curl','-sf','-X','POST','${endpoint}','-H','Content-Type: application/json','-d',json.dumps({'agent':'claude','taskId':d.get('session_id','unknown'),'summary':'Claude Code session completed','changes':[],'decisions':[],'gotchas':[],'todos':[],'docsImpact':[],'skillsImpact':[],'categories':['general'],'tags':[]})],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)" 2>/dev/null || true`,
              },
            ],
          },
        ],
      },
    }, null, 2);

    const codexHookSnippet = JSON.stringify({
      hooks: {
        "post-exec": [
          {
            command: `curl -sf -X POST '${endpoint}' -H 'Content-Type: application/json' -d '{"agent":"codex","taskId":"unknown","summary":"Codex task completed","changes":[],"decisions":[],"gotchas":[],"todos":[],"docsImpact":[],"skillsImpact":[],"categories":["general"],"tags":[]}' > /dev/null 2>&1 || true`,
          },
        ],
      },
    }, null, 2);

    const geminiHookSnippet = JSON.stringify({
      hooks: {
        afterTask: [
          {
            command: `curl -sf -X POST '${endpoint}' -H 'Content-Type: application/json' -d '{"agent":"gemini","taskId":"unknown","summary":"Gemini task completed","changes":[],"decisions":[],"gotchas":[],"todos":[],"docsImpact":[],"skillsImpact":[],"categories":["general"],"tags":[]}' > /dev/null 2>&1 || true`,
          },
        ],
      },
    }, null, 2);

    res.json({
      projectId: pid,
      serverUrl,
      endpoint,
      snippets: {
        curl: curlSnippet,
        claude_md: claudeMdSnippet,
        claude_code_hook: claudeCodeHookSnippet,
        codex_hook: codexHookSnippet,
        gemini_hook: geminiHookSnippet,
      },
    });
  });

  const clientDir = path.join(rootDir, "dist", "client");
  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDir, "index.html"));
    });
  }

  return { app, store };
}
