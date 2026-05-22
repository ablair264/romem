# Use Romem

## Purpose

Submit a structured task summary to Romem at the end of every coding session so that memories, TODOs, and decisions are persisted for future agents.

## When to trigger

- After completing any coding task or session
- When the user says "done", "wrap up", or "commit"
- Automatically via a Stop hook (Claude Code) or post-exec hook (Codex/Gemini)

## Usage

At the end of each task, POST a summary payload to the Romem server. Replace `<SERVER_URL>` and `<PROJECT_ID>` with the values from the Romem Connect page.

```bash
curl -sf -X POST '<SERVER_URL>/api/projects/<PROJECT_ID>/task-summaries' \
  -H 'Content-Type: application/json' \
  -d '{
    "agent": "claude",
    "taskId": "<session-id-or-unique-id>",
    "summary": "<one or two sentences describing what was accomplished>",
    "changes": ["<list of files or components changed>"],
    "decisions": ["<architectural or design decisions made>"],
    "gotchas": ["<edge cases, bugs found, or non-obvious constraints discovered>"],
    "todos": ["<work left to do or follow-up items>"],
    "docsImpact": ["<docs files that were created or should be updated>"],
    "skillsImpact": ["<skill files that were created or should be updated>"],
    "categories": ["<memory category tags, e.g. architecture, style-guide, database>"],
    "tags": ["<optional keyword tags>"]
  }'
```

## Payload field guide

| Field | Required | Description |
|-------|----------|-------------|
| `agent` | Yes | Which agent submitted: `claude`, `codex`, or `gemini` |
| `taskId` | Yes | Unique identifier for this task/session |
| `summary` | Yes | 1-2 sentences describing what was done |
| `changes` | No | Files, modules, or components that were modified |
| `decisions` | No | Key decisions made during the session |
| `gotchas` | No | Non-obvious issues, edge cases, or pitfalls discovered |
| `todos` | No | Remaining work or follow-up items |
| `docsImpact` | No | Documentation files that were affected |
| `skillsImpact` | No | Skill files that were created or updated |
| `categories` | No | Memory category buckets (defaults to `["general"]`) |
| `tags` | No | Keyword tags for future retrieval |

## What happens after submission

1. Romem stores the raw task summary in the activity log
2. The organizer model (Ollama, if configured) analyses the payload against existing project memories
3. A **proposal** is staged — a diff of memory additions, updates, and TODOs to apply
4. Open the Romem UI → Proposals tab to review and approve or reject the proposal
5. Approved proposals write new memory facts and update the project knowledge base

## Checking the Romem UI

The Romem dashboard is available at the `<SERVER_URL>` set in Settings. Key views:

- **Overview** — summary stats and recent activity
- **Memories** — browsable category folders of persisted facts
- **Proposals** — staged diffs awaiting your approval
- **TODOs** — open action items extracted from task summaries
- **Activity** — full history of submitted task summaries
- **Connect** — ready-to-paste hook snippets for each agent
- **Settings** — configure the server URL and Ollama model

## Claude Code Stop hook (automatic)

To submit automatically on every session end, add this to `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 -c \"import json,sys,subprocess; d=json.load(sys.stdin); subprocess.Popen(['curl','-sf','-X','POST','<SERVER_URL>/api/projects/<PROJECT_ID>/task-summaries','-H','Content-Type: application/json','-d',json.dumps({'agent':'claude','taskId':d.get('session_id','unknown'),'summary':'Claude Code session completed','changes':[],'decisions':[],'gotchas':[],'todos':[],'docsImpact':[],'skillsImpact':[],'categories':['general'],'tags':[]})],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

## Notes

- The `taskId` should be unique per session; use the session ID if available, otherwise a timestamp
- Romem is non-blocking — a failed submission will not break the agent workflow
- Proposals must be manually approved in the UI; nothing is written automatically
- The organizer model is optional; without it, Romem uses a rule-based fallback to generate proposals
