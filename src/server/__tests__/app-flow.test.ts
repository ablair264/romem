import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createRomemApp } from "../app.js";

describe("romem app flow", () => {
  it("stages and applies proposals using fallback organizer", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "romem-app-"));
    const packageJson = path.join(rootDir, "package.json");
    await fs.writeFile(packageJson, JSON.stringify({ name: "romem-test", type: "module" }), "utf8");

    const { app, store } = await createRomemApp(rootDir);

    const createResponse = await request(app)
      .post("/api/projects/romem/task-summaries")
      .send({
        agent: "codex",
        taskId: "task-123",
        summary: "Add approval workflow",
        changes: ["Created apply service"],
        decisions: ["Use fallback organizer"],
        gotchas: ["No live Ollama in test"],
        todos: ["Wire retries"],
        docsImpact: ["Update AGENTS.md with approval workflow notes"],
        skillsImpact: ["approval workflow review"],
        categories: ["architecture"],
        tags: ["approval", "workflow"],
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.proposal.status).toBe("staged");

    const proposalId = createResponse.body.proposal.id as string;
    const approveResponse = await request(app).post(`/api/proposals/${proposalId}/approve`).send({});

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.status).toBe("applied");
    expect(store.listMemories("romem").length).toBeGreaterThan(0);
    expect(store.listTodos("romem").some((todo) => todo.title === "Wire retries")).toBe(true);
  });
});
