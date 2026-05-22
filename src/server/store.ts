import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type {
  AgentDocument,
  MemoryEntry,
  ProjectOverview,
  Proposal,
  ProposalOperation,
  SkillRecord,
  TaskSummaryInput,
  TaskSummaryRecord,
  Todo,
} from "../shared/schema.js";
import { createId, nowIso } from "./utils.js";

type SqlValue = string | number | null;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  return JSON.parse(value) as T;
}

export class RomemStore {
  private db: Database.Database;

  constructor(private readonly rootDir: string, filePath = process.env.ROMEM_DB_PATH ?? path.join(rootDir, ".romem", "romem.db")) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(project_id, name)
      );
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(project_id, name)
      );
      CREATE TABLE IF NOT EXISTS task_summaries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        agent TEXT NOT NULL,
        task_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        proposal_id TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memory_entries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        fact TEXT NOT NULL,
        category TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        source_task_summary_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        task_summary_id TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT NOT NULL,
        rationale TEXT NOT NULL,
        categories_json TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS proposal_operations (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        target TEXT NOT NULL,
        path TEXT,
        category TEXT,
        tags_json TEXT,
        content TEXT,
        diff TEXT,
        metadata_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_documents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(project_id, path)
      );
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(project_id, path)
      );
    `);
  }

  ensureProject(projectId: string, name: string) {
    const createdAt = nowIso();
    this.db
      .prepare(
        `INSERT INTO projects (id, name, root_path, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, root_path = excluded.root_path`,
      )
      .run(projectId, name, this.rootDir, createdAt);
  }

  projectExists(projectId: string): boolean {
    const row = this.db.prepare(`SELECT id FROM projects WHERE id = ?`).get(projectId) as { id?: string } | undefined;
    return Boolean(row?.id);
  }

  categoriesCount(projectId: string): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM categories WHERE project_id = ?`).get(projectId) as { count: number };
    return row.count;
  }

  replaceCategories(projectId: string, categories: string[]) {
    const tx = this.db.transaction((values: string[]) => {
      this.db.prepare(`DELETE FROM categories WHERE project_id = ?`).run(projectId);
      const stmt = this.db.prepare(`INSERT INTO categories (id, project_id, name, created_at) VALUES (?, ?, ?, ?)`);
      for (const name of values) {
        stmt.run(createId("cat"), projectId, name, nowIso());
      }
    });
    tx(categories);
  }

  upsertTag(projectId: string, tag: string) {
    this.db
      .prepare(
        `INSERT INTO tags (id, project_id, name, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(project_id, name) DO NOTHING`,
      )
      .run(createId("tag"), projectId, tag, nowIso());
  }

  createTaskSummary(input: TaskSummaryInput): TaskSummaryRecord {
    const id = createId("task");
    const timestamp = nowIso();
    this.db
      .prepare(
        `INSERT INTO task_summaries
         (id, project_id, agent, task_id, payload_json, status, proposal_id, error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      )
      .run(id, input.projectId, input.agent, input.taskId, JSON.stringify(input), "received", timestamp, timestamp);
    return this.getTaskSummary(id)!;
  }

  updateTaskSummaryStatus(id: string, status: TaskSummaryRecord["status"], proposalId: string | null, error: string | null) {
    this.db
      .prepare(`UPDATE task_summaries SET status = ?, proposal_id = ?, error = ?, updated_at = ? WHERE id = ?`)
      .run(status, proposalId, error, nowIso(), id);
  }

  getTaskSummary(id: string): TaskSummaryRecord | null {
    const row = this.db.prepare(`SELECT * FROM task_summaries WHERE id = ?`).get(id) as Record<string, SqlValue> | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      agent: row.agent as TaskSummaryRecord["agent"],
      taskId: String(row.task_id),
      payload: JSON.parse(String(row.payload_json)),
      status: row.status as TaskSummaryRecord["status"],
      proposalId: row.proposal_id ? String(row.proposal_id) : null,
      error: row.error ? String(row.error) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  listTaskSummaries(projectId: string, limit = 20): TaskSummaryRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM task_summaries WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`)
      .all(projectId, limit) as Record<string, SqlValue>[];
    return rows.map((row) => this.getTaskSummary(String(row.id))!).filter(Boolean);
  }

  listMemories(projectId: string): MemoryEntry[] {
    const rows = this.db.prepare(`SELECT * FROM memory_entries WHERE project_id = ? ORDER BY updated_at DESC`).all(projectId) as Record<
      string,
      SqlValue
    >[];
    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      fact: String(row.fact),
      category: String(row.category),
      tags: parseJson(String(row.tags_json), []),
      source: String(row.source),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  }

  addCategory(projectId: string, name: string) {
    this.db
      .prepare(
        `INSERT INTO categories (id, project_id, name, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(project_id, name) DO NOTHING`,
      )
      .run(createId("cat"), projectId, name.toLowerCase().trim(), nowIso());
  }

  upsertMemory(projectId: string, fact: string, category: string, tags: string[], source: string) {
    const existing = this.db
      .prepare(`SELECT id, created_at FROM memory_entries WHERE project_id = ? AND LOWER(fact) = LOWER(?)`)
      .get(projectId, fact) as { id?: string; created_at?: string } | undefined;
    const id = existing?.id ?? createId("mem");
    const createdAt = existing?.created_at ?? nowIso();
    
    // Auto-index category
    this.addCategory(projectId, category);

    this.db
      .prepare(
        `INSERT INTO memory_entries (id, project_id, fact, category, tags_json, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET category = excluded.category, tags_json = excluded.tags_json, source = excluded.source, updated_at = excluded.updated_at`,
      )
      .run(id, projectId, fact, category, JSON.stringify(tags), source, createdAt, nowIso());
  }


  listTodos(projectId: string): Todo[] {
    const rows = this.db.prepare(`SELECT * FROM todos WHERE project_id = ? ORDER BY updated_at DESC`).all(projectId) as Record<string, SqlValue>[];
    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      title: String(row.title),
      status: row.status as Todo["status"],
      sourceTaskSummaryId: row.source_task_summary_id ? String(row.source_task_summary_id) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  }

  createTodo(projectId: string, title: string, sourceTaskSummaryId: string | null) {
    this.db
      .prepare(
        `INSERT INTO todos (id, project_id, title, status, source_task_summary_id, created_at, updated_at)
         VALUES (?, ?, ?, 'open', ?, ?, ?)`,
      )
      .run(createId("todo"), projectId, title, sourceTaskSummaryId, nowIso(), nowIso());
  }

  updateTodo(projectId: string, id: string, title: string, status: "open" | "done") {
    this.db
      .prepare(
        `UPDATE todos 
         SET title = ?, status = ?, updated_at = ? 
         WHERE id = ? AND project_id = ?`
      )
      .run(title, status, nowIso(), id, projectId);
  }

  getTodo(id: string): Todo | undefined {
    const row = this.db.prepare(`SELECT * FROM todos WHERE id = ?`).get(id) as Record<string, any> | undefined;
    if (!row) return undefined;
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      title: String(row.title),
      status: row.status as Todo["status"],
      sourceTaskSummaryId: row.source_task_summary_id ? String(row.source_task_summary_id) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }


  saveProposal(projectId: string, taskSummaryId: string, summary: string, rationale: string, categories: string[], tags: string[], operations: ProposalOperation[]): Proposal {
    const proposalId = createId("proposal");
    const timestamp = nowIso();
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO proposals
           (id, project_id, task_summary_id, status, summary, rationale, categories_json, tags_json, error, created_at, updated_at)
           VALUES (?, ?, ?, 'staged', ?, ?, ?, ?, NULL, ?, ?)`,
        )
        .run(proposalId, projectId, taskSummaryId, summary, rationale, JSON.stringify(categories), JSON.stringify(tags), timestamp, timestamp);
      const stmt = this.db.prepare(
        `INSERT INTO proposal_operations
         (id, proposal_id, type, title, target, path, category, tags_json, content, diff, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const operation of operations) {
        stmt.run(
          operation.id,
          proposalId,
          operation.type,
          operation.title,
          operation.target,
          operation.path ?? null,
          operation.category ?? null,
          JSON.stringify(operation.tags ?? []),
          operation.content ?? null,
          operation.diff ?? null,
          JSON.stringify(operation.metadata ?? {}),
        );
      }
    });
    tx();
    this.updateTaskSummaryStatus(taskSummaryId, "staged", proposalId, null);
    return this.getProposal(proposalId)!;
  }

  setProposalStatus(proposalId: string, status: Proposal["status"], error: string | null = null) {
    this.db.prepare(`UPDATE proposals SET status = ?, error = ?, updated_at = ? WHERE id = ?`).run(status, error, nowIso(), proposalId);
  }

  getProposal(id: string): Proposal | null {
    const row = this.db.prepare(`SELECT * FROM proposals WHERE id = ?`).get(id) as Record<string, SqlValue> | undefined;
    if (!row) return null;
    const operations = this.db
      .prepare(`SELECT * FROM proposal_operations WHERE proposal_id = ?`)
      .all(id) as Record<string, SqlValue>[];
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      taskSummaryId: String(row.task_summary_id),
      status: row.status as Proposal["status"],
      summary: String(row.summary),
      rationale: String(row.rationale),
      categories: parseJson(String(row.categories_json), []),
      tags: parseJson(String(row.tags_json), []),
      operations: operations.map((operation) => ({
        id: String(operation.id),
        type: operation.type as ProposalOperation["type"],
        title: String(operation.title),
        target: String(operation.target),
        path: operation.path ? String(operation.path) : undefined,
        category: operation.category ? String(operation.category) : undefined,
        tags: parseJson(operation.tags_json ? String(operation.tags_json) : null, []),
        content: operation.content ? String(operation.content) : undefined,
        diff: operation.diff ? String(operation.diff) : undefined,
        metadata: parseJson(operation.metadata_json ? String(operation.metadata_json) : null, {}),
      })),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      error: row.error ? String(row.error) : null,
    };
  }

  listProposals(projectId: string): Proposal[] {
    const rows = this.db.prepare(`SELECT id FROM proposals WHERE project_id = ? ORDER BY updated_at DESC`).all(projectId) as { id: string }[];
    return rows.map((row) => this.getProposal(row.id)!).filter(Boolean);
  }

  upsertAgentDocument(projectId: string, filename: string, filePath: string, content: string) {
    const existing = this.db.prepare(`SELECT id FROM agent_documents WHERE project_id = ? AND path = ?`).get(projectId, filePath) as { id?: string } | undefined;
    this.db
      .prepare(
        `INSERT INTO agent_documents (id, project_id, filename, path, content, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, path) DO UPDATE SET filename = excluded.filename, content = excluded.content, updated_at = excluded.updated_at`,
      )
      .run(existing?.id ?? createId("doc"), projectId, filename, filePath, content, nowIso());
  }

  listAgentDocuments(projectId: string): AgentDocument[] {
    const rows = this.db.prepare(`SELECT * FROM agent_documents WHERE project_id = ? ORDER BY filename ASC`).all(projectId) as Record<string, SqlValue>[];
    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      filename: String(row.filename),
      path: String(row.path),
      content: String(row.content),
      updatedAt: String(row.updated_at),
    }));
  }

  upsertSkill(projectId: string, skillPath: string, title: string, content: string) {
    const existing = this.db.prepare(`SELECT id FROM skills WHERE project_id = ? AND path = ?`).get(projectId, skillPath) as { id?: string } | undefined;
    this.db
      .prepare(
        `INSERT INTO skills (id, project_id, path, title, content, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, path) DO UPDATE SET title = excluded.title, content = excluded.content, updated_at = excluded.updated_at`,
      )
      .run(existing?.id ?? createId("skill"), projectId, skillPath, title, content, nowIso());
  }

  deleteSkill(projectId: string, skillPath: string) {
    this.db.prepare(`DELETE FROM skills WHERE project_id = ? AND path = ?`).run(projectId, skillPath);
  }

  listSkills(projectId: string): SkillRecord[] {
    const rows = this.db.prepare(`SELECT * FROM skills WHERE project_id = ? ORDER BY path ASC`).all(projectId) as Record<string, SqlValue>[];
    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      path: String(row.path),
      title: String(row.title),
      content: String(row.content),
      updatedAt: String(row.updated_at),
    }));
  }

  updateMemory(projectId: string, id: string, fact: string, category: string, tags: string[], source: string) {
    this.addCategory(projectId, category);
    this.db
      .prepare(
        `UPDATE memory_entries 
         SET fact = ?, category = ?, tags_json = ?, source = ?, updated_at = ? 
         WHERE id = ? AND project_id = ?`
      )
      .run(fact, category, JSON.stringify(tags), source, nowIso(), id, projectId);
  }

  deleteMemory(projectId: string, id: string) {
    this.db.prepare(`DELETE FROM memory_entries WHERE project_id = ? AND id = ?`).run(projectId, id);
  }

  deleteCategory(projectId: string, name: string) {
    this.db.transaction(() => {
      this.db.prepare(`DELETE FROM categories WHERE project_id = ? AND name = ?`).run(projectId, name);
      this.db.prepare(`DELETE FROM memory_entries WHERE project_id = ? AND category = ?`).run(projectId, name);
    })();
  }


  getAgentDocument(id: string): AgentDocument | undefined {
    const row = this.db.prepare(`SELECT * FROM agent_documents WHERE id = ?`).get(id) as Record<string, any> | undefined;
    if (!row) return undefined;
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      filename: String(row.filename),
      path: String(row.path),
      content: String(row.content),
      updatedAt: String(row.updated_at),
    };
  }

  getSkill(id: string): SkillRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM skills WHERE id = ?`).get(id) as Record<string, any> | undefined;
    if (!row) return undefined;
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      path: String(row.path),
      title: String(row.title),
      content: String(row.content),
      updatedAt: String(row.updated_at),
    };
  }

  getOverview(projectId: string): ProjectOverview {
    const project = this.db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as Record<string, SqlValue>;
    const stats = {
      memories: this.listMemories(projectId).length,
      proposals: this.listProposals(projectId).length,
      todos: this.listTodos(projectId).length,
      agentDocuments: this.listAgentDocuments(projectId).length,
      skills: this.listSkills(projectId).length,
      pendingApprovals: this.db.prepare(`SELECT COUNT(*) as count FROM proposals WHERE project_id = ? AND status = 'staged'`).get(projectId) as {
        count: number;
      },
    };
    const categories = this.db.prepare(`SELECT name FROM categories WHERE project_id = ? ORDER BY name ASC`).all(projectId) as { name: string }[];
    return {
      id: String(project.id),
      name: String(project.name),
      rootPath: String(project.root_path),
      categories: categories.map((row) => row.name),
      stats: {
        ...stats,
        pendingApprovals: stats.pendingApprovals.count,
      },
      recentTasks: this.listTaskSummaries(projectId, 8),
    };
  }
}
