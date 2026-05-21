#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_CATEGORIES = ['general', 'style-guide', 'architecture', 'todo', 'database'];
const CATEGORY_ALIASES = new Map([
  ['arch', 'architecture'],
  ['db', 'database'],
  ['style', 'style-guide'],
  ['ux', 'style-guide'],
  ['task', 'todo'],
]);

function readInput() {
  return new Promise((resolve) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { input += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(input.trim() ? JSON.parse(input) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function findProjectDir(data) {
  const candidates = [
    data.cwd,
    data.workspace,
    data.workspaceRoot,
    data.project_path,
    process.env.CODEX_WORKSPACE,
    process.env.PWD,
    process.cwd(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(path.join(resolved, 'package.json')) || fs.existsSync(path.join(resolved, '.mcp-memory'))) {
      return resolved;
    }
  }

  return process.cwd();
}

function ensureDb(projectDir) {
  const memoryDir = path.join(projectDir, '.mcp-memory');
  const memoryFile = path.join(memoryDir, 'project-memory.json');
  fs.mkdirSync(memoryDir, { recursive: true });

  let db = {};
  try {
    db = JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
  } catch {
    db = {};
  }

  db.project_context = db.project_context || {};
  db.project_context.tech_stack = Array.isArray(db.project_context.tech_stack) ? db.project_context.tech_stack : [];
  db.project_context.key_rules = Array.isArray(db.project_context.key_rules) ? db.project_context.key_rules : [];
  db.project_context.architecture_notes = Array.isArray(db.project_context.architecture_notes) ? db.project_context.architecture_notes : [];
  db.project_context.categories = Array.isArray(db.project_context.categories) && db.project_context.categories.length
    ? db.project_context.categories.map((category) => String(category).toLowerCase().trim()).filter(Boolean)
    : DEFAULT_CATEGORIES;
  db.memories = Array.isArray(db.memories) ? db.memories : [];

  return { db, memoryFile };
}

function saveDb(memoryFile, db) {
  const tmp = `${memoryFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, memoryFile);
}

function normalizeTags(tags) {
  return [...new Set(tags
    .map((tag) => tag.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean))]
    .slice(0, 5);
}

function inferCategory(text, categories) {
  const lower = text.toLowerCase();
  const categoryMatch = lower.match(/\b(?:category|cat):\s*([a-z0-9-]+)/);
  if (categoryMatch) {
    const requested = CATEGORY_ALIASES.get(categoryMatch[1]) || categoryMatch[1];
    if (categories.includes(requested)) return requested;
  }

  if (/\b(table|schema|column|index|migration|sql|neon|postgres|database)\b/.test(lower) && categories.includes('database')) {
    return 'database';
  }
  if (/\b(component|css|style|design|ui|ux|font|layout|copy|motion)\b/.test(lower) && categories.includes('style-guide')) {
    return 'style-guide';
  }
  if (/\b(todo|follow up|later|remaining|pending|deploy|fix next)\b/.test(lower) && categories.includes('todo')) {
    return 'todo';
  }
  if (/\b(architecture|service|route|module|pattern|flow|integration|mcp|hook)\b/.test(lower) && categories.includes('architecture')) {
    return 'architecture';
  }
  return categories.includes('general') ? 'general' : categories[0];
}

function extractMemory(prompt) {
  const match = prompt.match(/(?:^|\b)(?:remember|save memory|add memory|store memory|note for memory)\s*:?\s+([\s\S]+)/i);
  if (!match) return null;

  let fact = match[1].trim();
  fact = fact.replace(/\s+#([a-z0-9-]+)/gi, '');
  fact = fact.replace(/\s+\bcategory:\s*[a-z0-9-]+/i, '');
  fact = fact.trim();

  if (fact.length < 12) return null;
  if (fact.length > 800) fact = `${fact.slice(0, 797)}...`;

  const tagMatches = [...match[1].matchAll(/#([a-z0-9-]+)/gi)].map((tag) => tag[1]);
  const keywordTags = match[1]
    .toLowerCase()
    .match(/\b(mcp|codex|hook|memory|neon|postgres|react|node|typescript|database|architecture)\b/g) || [];

  return {
    fact,
    tags: normalizeTags([...tagMatches, ...keywordTags]),
  };
}

function addMemory(projectDir, prompt) {
  const extracted = extractMemory(prompt);
  if (!extracted) return null;

  const { db, memoryFile } = ensureDb(projectDir);
  const category = inferCategory(prompt, db.project_context.categories);
  const duplicate = db.memories.some((memory) => memory.fact.toLowerCase() === extracted.fact.toLowerCase());
  if (duplicate) return { skipped: true, reason: 'duplicate' };

  const now = new Date().toISOString();
  db.memories.push({
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    fact: extracted.fact,
    category,
    tags: extracted.tags.length ? extracted.tags : ['codex', 'memory'],
    created_at: now,
    updated_at: now,
  });

  saveDb(memoryFile, db);
  return { saved: true, category };
}

function contextMessage(projectDir) {
  return [
    'PROJECT-MEMORY ACTIVE:',
    `- MCP server: project-memory -> node /Users/blair/Desktop/Development/Romem/index.js`,
    `- Scope: ${projectDir}`,
    '- Start substantial work by calling get_project_context, then list_memories or search_memories.',
    '- Before add/update memory, call list_categories and use active category.',
    '- After major task, obscure bug fix, or durable decision, call add_memory with specific fact plus 2-5 lowercase tags.',
    '- User can say "remember ..." or "add memory ..." and this hook will also save prompt text into .mcp-memory/project-memory.json.',
  ].join('\n');
}

(async () => {
  const data = await readInput();
  const projectDir = findProjectDir(data);
  const prompt = String(data.prompt || data.user_prompt || '');
  const eventName = data.hook_event_name || data.hookEventName || process.env.CODEX_HOOK_EVENT || '';

  let saved = null;
  if (prompt) {
    saved = addMemory(projectDir, prompt);
  }

  const additionalContext = saved && saved.saved
    ? `${contextMessage(projectDir)}\n\nSaved explicit memory from user prompt as category "${saved.category}".`
    : contextMessage(projectDir);

  const payload = eventName
    ? { hookSpecificOutput: { hookEventName: eventName, additionalContext } }
    : { additionalContext };

  process.stdout.write(JSON.stringify(payload));
})();
