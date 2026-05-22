import { normalizeHookSummary } from "../hook-summary.js";

describe("normalizeHookSummary", () => {
  it("parses embedded json summaries", () => {
    const result = normalizeHookSummary(
      {
        finalResponse: `ROMEM_TASK_SUMMARY: {"projectId":"romem","agent":"codex","taskId":"task-1","summary":"Did the thing","changes":["Updated API"],"decisions":[],"gotchas":[],"todos":[],"docsImpact":[],"skillsImpact":[],"categories":["architecture"],"tags":["api"]}`,
      },
      "romem",
      "codex",
    );

    expect(result?.taskId).toBe("task-1");
    expect(result?.changes).toEqual(["Updated API"]);
  });

  it("builds heuristic summaries from plain text", () => {
    const result = normalizeHookSummary(
      {
        output: `Updated approval route\nChanges:\n- Added apply endpoint\nDecisions:\n- Use SQLite\nTodos:\n- Add retry path\n#backend #approval`,
      },
      "romem",
      "codex",
    );

    expect(result?.summary).toContain("Updated approval route");
    expect(result?.changes).toEqual(["Added apply endpoint"]);
    expect(result?.decisions).toEqual(["Use SQLite"]);
    expect(result?.todos).toEqual(["Add retry path"]);
    expect(result?.tags).toEqual(["backend", "approval"]);
  });
});

