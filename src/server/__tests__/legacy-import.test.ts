import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { importLegacyProjectMemory } from "../legacy-import.js";
import { RomemStore } from "../store.js";

describe("importLegacyProjectMemory", () => {
  it("imports legacy categories and memories", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "romem-import-"));
    await fs.mkdir(path.join(rootDir, ".mcp-memory"), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, ".mcp-memory", "project-memory.json"),
      JSON.stringify({
        project_context: { categories: ["general", "architecture"] },
        memories: [{ fact: "Use Mastra", category: "architecture", tags: ["mastra"] }],
      }),
      "utf8",
    );

    const store = new RomemStore(rootDir, path.join(rootDir, ".romem", "test.db"));
    store.ensureProject("romem", "romem");
    await importLegacyProjectMemory(rootDir, "romem", store);

    expect(store.getOverview("romem").categories).toEqual(["architecture", "general"]);
    expect(store.listMemories("romem")[0]?.fact).toBe("Use Mastra");
  });
});

