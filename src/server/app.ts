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

  const { mastra, ingestTaskSummaryWorkflow, consolidateMemoriesWorkflow } = createMastraRuntime(store, rootDir);

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

  app.post("/api/projects", (req, res) => {
    const { id, name } = req.body;
    if (!id || typeof id !== "string" || !id.trim()) {
      res.status(400).json({ error: "Project ID is required." });
      return;
    }
    const projectId = id.trim().toLowerCase().replace(/\s+/g, "-");
    const projectName = typeof name === "string" && name.trim() ? name.trim() : projectId;
    store.ensureProject(projectId, projectName);
    const projects = store.listProjects();
    const project = projects.find((p) => p.id === projectId);
    res.status(201).json(project);
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

  app.get("/api/projects/:id/digest.md", (req, res) => {
    const pid = req.params.id;
    const overview = store.getOverview(pid);
    if (!overview) {
      res.status(404).type("text/plain").send("Project not found\n");
      return;
    }
    const memories = store.listMemories(pid);
    const openTodos = store.listTodos(pid).filter((t) => t.status === "open");
    const serverUrl = store.getSetting("server_url") ?? process.env.ROMEM_SERVER_URL ?? "";
    const byCategory = new Map<string, number>();
    for (const m of memories) byCategory.set(m.category || "general", (byCategory.get(m.category || "general") ?? 0) + 1);
    const lines: string[] = [
      `# ${overview.name} — Memory Index`,
      ``,
      `${memories.length} facts across ${byCategory.size} categories. ${openTodos.length} open TODO${openTodos.length !== 1 ? "s" : ""}.`,
      ``,
      `## Categories`,
    ];
    for (const [cat, count] of [...byCategory.entries()].sort()) {
      lines.push(`- **${cat}** — ${count} fact${count !== 1 ? "s" : ""}`);
    }
    if (openTodos.length > 0) {
      lines.push(``, `## Open TODOs`);
      for (const t of openTodos.slice(0, 15)) lines.push(`- [ ] ${t.title}`);
      if (openTodos.length > 15) lines.push(`- … and ${openTodos.length - 15} more`);
    }
    lines.push(``, `---`, `Load facts: \`GET ${serverUrl}/api/projects/${pid}/context.md?category=<name>\``);
    lines.push(`Search: \`GET ${serverUrl}/api/projects/${pid}/context.md?q=<keyword>\``);
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(lines.join("\n"));
  });

  app.get("/api/projects/:id/context.md", (req, res) => {
    const pid = req.params.id;
    const overview = store.getOverview(pid);
    if (!overview) {
      res.status(404).type("text/plain").send("Project not found\n");
      return;
    }
    const q = String(req.query.q ?? "").toLowerCase().trim();
    const category = String(req.query.category ?? "").toLowerCase().trim();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "30"), 10) || 30, 1), 200);
    let memories = store.listMemories(pid);
    if (category) memories = memories.filter((m) => m.category.toLowerCase() === category);
    if (q) memories = memories.filter((m) => `${m.fact} ${m.tags.join(" ")}`.toLowerCase().includes(q));
    memories = memories.slice(0, limit);
    const openTodos = !category && !q ? store.listTodos(pid).filter((t) => t.status === "open") : [];
    const byCategory = new Map<string, typeof memories>();
    for (const m of memories) {
      const cat = m.category || "general";
      const list = byCategory.get(cat) ?? [];
      list.push(m);
      byCategory.set(cat, list);
    }
    const lines: string[] = [`# ${overview.name} — Context`];
    if (category || q) {
      const filters = [category && `category:${category}`, q && `q:"${q}"`].filter(Boolean).join(", ");
      lines.push(``, `> ${memories.length} result${memories.length !== 1 ? "s" : ""} (${filters})`);
    } else {
      lines.push(``, `> ${memories.length} of ${store.listMemories(pid).length} facts (limit ${limit}) — use ?category= or ?q= to focus`);
    }
    lines.push(``);
    for (const [cat, items] of [...byCategory.entries()].sort()) {
      lines.push(`## ${cat}`);
      for (const m of items) {
        const tagStr = m.tags.length > 0 ? ` *(${m.tags.join(", ")})*` : "";
        lines.push(`- ${m.fact}${tagStr}`);
      }
      lines.push(``);
    }
    if (openTodos.length > 0) {
      lines.push(`## Open TODOs`);
      for (const t of openTodos.slice(0, 10)) lines.push(`- [ ] ${t.title}`);
      if (openTodos.length > 10) lines.push(`- … and ${openTodos.length - 10} more`);
      lines.push(``);
    }
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(lines.join("\n"));
  });

  app.post("/api/projects/:id/consolidate", async (req, res) => {
    const pid = req.params.id;
    if (!store.projectExists(pid)) {
      return res.status(404).json({ error: "Project not found." });
    }
    try {
      const run = await consolidateMemoriesWorkflow.createRun({ resourceId: pid });
      const result = await run.start({ inputData: { projectId: pid } });
      if (result.status !== "success") {
        return res.status(500).json({ error: "Consolidation workflow did not complete.", result });
      }
      return res.json(result.result);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "Consolidation failed." });
    }
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

      const hasMemoryOps = proposal.operations.some((op) => op.type === "upsert_memory");
      const isConsolidation = proposal.tags?.includes("consolidation");
      if (hasMemoryOps && !isConsolidation) {
        consolidateMemoriesWorkflow
          .createRun({ resourceId: proposal.projectId })
          .then((run) => run.start({ inputData: { projectId: proposal.projectId } }))
          .catch(() => {});
      }

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

    const digestUrl = `${serverUrl}/api/projects/${pid}/digest.md`;
    const contextUrl = `${serverUrl}/api/projects/${pid}/context.md`;

    const contextLoadSnippet = `# Romem Context Loading — Token-Efficient Pattern

## Step 1: Always load at session start (tiny — ~20 lines)
\`\`\`bash
curl -sf '${digestUrl}'
\`\`\`
Returns: category names + memory counts + open TODOs. Use this to know what exists.

## Step 2: Load specific facts only when relevant
By category:
\`\`\`bash
curl -sf '${contextUrl}?category=architecture'
curl -sf '${contextUrl}?category=style-guide'
\`\`\`

By keyword (searches fact text and tags):
\`\`\`bash
curl -sf '${contextUrl}?q=authentication'
curl -sf '${contextUrl}?q=database'
\`\`\`

With a result limit (default 30, max 200):
\`\`\`bash
curl -sf '${contextUrl}?category=general&limit=10'
\`\`\`

## Add to CLAUDE.md / AGENTS.md / GEMINI.md

\`\`\`markdown
## Romem Memory

At the start of each session, load the project memory index:
\`\`\`bash
curl -sf '${digestUrl}'
\`\`\`
Then fetch specific categories or search for facts relevant to the current task:
\`\`\`bash
curl -sf '${contextUrl}?category=<name>'
curl -sf '${contextUrl}?q=<keyword>'
\`\`\`
\`\`\``;

    const claudeMdSnippet = `## Romem Memory

At the start of each session, load the project memory index (lightweight):
\`\`\`bash
curl -sf '${digestUrl}'
\`\`\`
This returns a map of available memory categories and open TODOs — not the facts themselves.

When working on a specific area, load the relevant category:
\`\`\`bash
curl -sf '${contextUrl}?category=<category-name>'
\`\`\`

Or search by keyword:
\`\`\`bash
curl -sf '${contextUrl}?q=<keyword>'
\`\`\`

---

## Romem Memory Hook (Session End)

At the end of each coding task, record the session summary:

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
      contextUrl,
      digestUrl,
      snippets: {
        context_load: contextLoadSnippet,
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
