# Project-Scoped Model Context Protocol (MCP) Memory Server

A high-performance, local-first Model Context Protocol (MCP) server that provides **isolated, project-scoped, persistent memory** for AI development assistants including **Claude Code**, **Gemini**, and **Codex/Antigravity**.

By automatically leveraging the **Current Working Directory (CWD)** from which your AI assistant is launched, the server guarantees that all project memories, tech stacks, architectural guidelines, and rules remain strictly isolated to the project codebase itself. No manual configuration per-project is needed!

---

## 🚀 Key Features

*   **Zero-Config Scoping**: Automatically detects the active project using the current working directory of the calling AI client.
*   **Highly Inspectable**: Stores all memories locally in `.mcp-memory/project-memory.json` inside your project root. It's clean, human-readable JSON.
*   **Version Control Friendly**: Easily commit `.mcp-memory/project-memory.json` to Git to share coding conventions, stacks, and guidelines across your development team, or add it to `.gitignore` to keep it private.
*   **Atomic Safe Storage**: Implements temporary-file write operations followed by atomic renames (`fs.rename`), completely eliminating the risk of database corruption during concurrent operations.
*   **Comprehensive Tools**: Dedicated tools for atomic memory creation, phrase/tag search, updates, deletion, and high-level project summary templates.

---

## 🛠️ Quick Start

### 1. Initialize and Setup
You can set up the server globally in your user configuration directories with a single automated command:

```bash
# Register the server globally in Claude Code (~/.claude.json) and Gemini (~/.gemini/settings.json)
node setup.js
```

### 2. Verify Server Installation
Run our comprehensive integration test suite to verify that the server connects over standard JSON-RPC, parses schema tools, and successfully manages isolated databases:

```bash
npm test
```

### 3. Launch the Premium Web GUI Dashboard
Browse, search, edit, and organize all project-scoped memories and high-level context guidelines inside a beautiful, local glassmorphic web dashboard:

```bash
# Start the zero-dependency web interface
npm run gui
```

Once booted, open the dashboard at the logged URL (usually **`http://localhost:3000`**). The server automatically scans for available ports if `3000` is occupied, ensuring a smooth start.

---

## 🧰 Provided MCP Tools

Once connected, your AI clients will have access to the following premium, atomic tools:

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| **`add_memory`** | `fact` (str, req), `category` (str), `tags` (array) | Adds a persistent fact, preferences, or guideline to the active project database. |
| **`search_memories`** | `query` (str, req), `category` (str) | Searches memories, categories, and tags using keyword matching. |
| **`list_memories`** | `category` (str) | Lists all memories stored for the active project, with optional category filtering. |
| **`update_memory`** | `id` (str, req), `fact` (str, req), `category` (str), `tags` (array) | Updates an existing memory item by its unique ID. |
| **`delete_memory`** | `id` (str, req) | Permanently deletes a memory item by ID. |
| **`get_project_context`** | None | Retrieves the high-level project summary context (Tech stack, standards, rules). |
| **`update_project_context`**| `tech_stack` (array), `key_rules` (array), `architecture_notes` (array) | Updates the core technical summary context for the active project. |

---

## 🖥️ Client Configuration Reference

If you prefer manual configuration, or want to understand what configurations are created, refer to the guides below:

### 1. Claude Code (CLI)
Claude Code loads its configurations globally from `~/.claude.json` or locally from a project's `.mcp.json`.

**Global User Settings (`~/.claude.json`)**:
```json
{
  "mcpServers": {
    "project-memory": {
      "command": "node",
      "args": ["/home/alastair/Romem/index.js"]
    }
  }
}
```

### 2. Gemini (Code Assist & CLI)
Gemini tools look for MCP server configurations in `~/.gemini/settings.json` (global) or `.gemini/settings.json` (project root).

**Global User Settings (`~/.gemini/settings.json`)**:
```json
{
  "mcpServers": {
    "project-memory": {
      "command": "node",
      "args": ["/home/alastair/Romem/index.js"]
    }
  }
}
```

### 3. Codex & Antigravity
For Codex, the server is launched in `stdio` mode using standard Node execution. When configuring custom tools or adding MCP servers in Codex:
- **Server Command**: `node`
- **Arguments**: `/home/alastair/Romem/index.js`

---

## 🧠 Workflows & Prompt Engineering Patterns

To maximize the benefits of project-scoped memory, adopt these standard practices:

### A. Proactive Context Retrieval (CWD initialization)
Create a `CLAUDE.md` or `DEVELOPER.md` file in the root of your project instructing the AI agent to search memory on startup:

```markdown
# Developer Guidelines

At the start of every session:
1. Call `get_project_context` to understand the tech stack, key rules, and architecture of this codebase.
2. Call `list_memories` or `search_memories` with relevant terms to see past decisions and debugging guidelines.
3. Whenever you make an architectural decision or fix a critical bug, use `add_memory` to capture the insight.
```

### B. Suggested Prompt Commands to Give Your Assistant

*   *Stack Definition*: `"We are using Fastify and Neon PostgreSQL. Update our project context to reflect this so you don't forget."*
*   *Adding preferences*: `"Remember that for this project, all utility functions must go inside src/utils and be fully tested."*
*   *Memory Recall*: `"Search memories for any guidelines on how we handle user authentications or schemas."*
*   *Removing Stale Info*: `"Delete memory with ID mem_xxxxxxx because we refactored that service."*

---

## 📂 Storage Structure
Within each project folder you work in, the database will be created in:
```
<your-project-root>/
├── .mcp-memory/
│   └── project-memory.json   <-- The isolated project database
```

**Database Schema Format (`project-memory.json`)**:
```json
{
  "project_context": {
    "tech_stack": [
      "Node.js",
      "ESM",
      "PostgreSQL"
    ],
    "key_rules": [
      "Always write modular ES6 module imports",
      "Keep functions pure and fully documented"
    ],
    "architecture_notes": [
      "The main server entry point is index.js"
    ]
  },
  "memories": [
    {
      "id": "mem_1716298374829",
      "fact": "We use atomic writes to prevent project-memory.json corruption.",
      "category": "architecture",
      "tags": [
        "fs",
        "io",
        "concurrency"
      ],
      "created_at": "2026-05-20T14:00:00.000Z",
      "updated_at": "2026-05-20T14:00:00.000Z"
    }
  ]
}
```
# romem
