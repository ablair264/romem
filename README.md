# Romem

Romem is a Mastra-backed project memory workspace for Codex, Claude, and Gemini. It ingests structured task summaries, stages memory and documentation updates as proposals, and requires explicit approval before touching agent files or skills.

## Runtime

- Backend: Mastra + Express
- Frontend: React + Vite
- Storage: SQLite at `.romem/romem.db`
- Model backend: Ollama over its OpenAI-compatible `/v1` API
- Deployment target: Railway for the app, VPS-hosted Ollama for the organizer model

## Core Flow

1. An agent hook submits a `task-summary` payload to Romem.
2. Mastra runs `ingest -> inspect -> classify -> stage proposal`.
3. Romem stores the task summary, memory entries, todos, and a staged proposal.
4. You review the diff in the UI.
5. Approval applies the staged operations to memory, `AGENTS.md`/`CLAUDE.md`/`GEMINI.md`, and project skills.

## Task Summary Contract

```json
{
  "projectId": "string",
  "agent": "codex|claude|gemini",
  "taskId": "string",
  "summary": "string",
  "changes": ["string"],
  "decisions": ["string"],
  "gotchas": ["string"],
  "todos": ["string"],
  "docsImpact": ["string"],
  "skillsImpact": ["string"],
  "categories": ["string"],
  "tags": ["string"]
}
```

## API

- `GET /api/health`
- `GET /api/projects/:id/overview`
- `GET /api/projects/:id/memories`
- `GET /api/projects/:id/proposals`
- `GET /api/projects/:id/todos`
- `GET /api/projects/:id/task-summaries`
- `GET /api/projects/:id/agent-files`
- `GET /api/projects/:id/skills`
- `POST /api/projects/:id/task-summaries`
- `POST /api/proposals/:id/approve`
- `POST /api/proposals/:id/reject`

## Development

Install dependencies:

```bash
npm install
```

Run the backend and frontend:

```bash
npm run dev
```

- UI: `http://localhost:5173`
- API: `http://localhost:4111`

Run tests:

```bash
npm test
```

Build production assets:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Environment

See [.env.example](/Users/blair/Desktop/Development/Romem/.env.example).

Key variables:

- `PORT`: Railway will inject this
- `ROMEM_PROJECT_ID`: logical project key, defaults to `romem`
- `ROMEM_ROOT_DIR`: optional explicit repo root
- `ROMEM_DB_PATH`: optional SQLite path override
- `OLLAMA_BASE_URL`: e.g. `http://your-vps:11434`
- `OLLAMA_MODEL`: e.g. `llama3.1:8b`
- `OLLAMA_API_KEY`: optional, defaults to `ollama`
- `ROMEM_SERVER_URL`: used by the Codex hook when posting summaries

## Railway Deployment Guide

Railway is the recommended host for Romem due to its seamless support for monorepo-like builds, automatic database creation, and excellent environment variable injection.

### Practical Architecture

To keep operations performant and highly available:
- **Romem Application (Railway)**: Hosts the Next.js React frontend, Express API endpoints, and the lightweight SQLite metadata store (`.romem/romem.db`).
- **LLM Model backend (VPS/Ollama)**: Ollama runs on your VPS or local machine, handling the resource-intensive organizer model inference. Railway communicates securely with Ollama via HTTPS/HTTP.

---

### Step 1: Secure & Configure Ollama on your VPS

1. Make sure Ollama is installed and running on your VPS:
   ```bash
   ollama run llama3.1:8b
   ```
2. By default, Ollama only listens on `127.0.0.1`. Update it to listen on `0.0.0.0` (all interfaces) or set up a reverse proxy (e.g. Nginx or Caddy) to expose port `11434` with basic auth/token security.

---

### Step 2: Set Up Environment Variables on Railway

Create a new service on Railway from your Romem Git repository, and define the following variables under **Variables**:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `ROMEM_PROJECT_ID` | Logical project namespace (e.g., `romem` or project slug) | `romem` |
| `OLLAMA_BASE_URL` | Endpoint of your VPS Ollama instance | `https://ollama.yourvps.com` or `http://192.168.1.100:11434` |
| `OLLAMA_MODEL` | The LLM model to use for proposal drafting | `llama3.1:8b` |
| `OLLAMA_API_KEY` | (Optional) API key for authenticated Ollama reverse proxies | `your-secure-token` |
| `ROMEM_SERVER_URL` | Public production URL of your Romem console on Railway | `https://romem.up.railway.app` |
| `ROMEM_DB_PATH` | Path to persistent SQLite file on a mounted volume | `/db/romem.db` |

*Note: Railway automatically injects the standard `PORT` variable. Romem's Express backend automatically listens on `process.env.PORT`.*

---

### Step 2.5: Configure Persistent SQLite Storage

Because SQLite writes to a local file, any data saved will be **wiped on redeployment** unless stored on a persistent volume:

1. In the Railway dashboard, click **+ New** at the top right and select **Volume**.
2. Mount the volume to your Romem service and set the **Mount Path** to `/db`.
3. In your Romem service's **Variables** tab, add `ROMEM_DB_PATH` set to `/db/romem.db` (as shown in Step 2 above).
4. Trigger a redeployment. Your data will now reside on the persistent volume and survive all restarts and updates!

---

### Step 3: Triggering Deployments

Railway will automatically detect your `package.json` and the `railway.json` configuration file, run:
```bash
npm run build
```
(which compiles both the Express server to `dist/server` and Next.js static client to `dist/client`), and then boot the server using:
```bash
npm start
```

---

### Step 4: Connecting your AI Assistants (Codex / Claude / Gemini)

To feed task summaries automatically to Romem from your terminal or IDE sessions, update your agent hooks (e.g., in `.codex/hooks.json` or pre-commit hooks) to point to your new Railway server URL:

```json
{
  "ROMEM_SERVER_URL": "https://romem.up.railway.app"
}
```

When a task completes, the agent will send a POST request with the `task-summary` payload to your Railway endpoint. You can then review the staged memory proposals and code diffs instantly in your live console!


## Legacy Import

On first boot, if the new store is empty, Romem imports `.mcp-memory/project-memory.json` into SQLite and scans known agent docs and skill files into the new store.

## Status

The old `index.js` MCP server and `gui.js` remain in the repo as legacy commands:

- `npm run legacy:mcp`
- `npm run legacy:gui`

They are no longer the primary runtime.
