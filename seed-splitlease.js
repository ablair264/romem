import fs from 'fs/promises';
import path from 'path';

// Target splitlease database path
const splitleaseDir = '/home/alastair/splitlease';
const targetMemoryDir = path.join(splitleaseDir, '.mcp-memory');
const targetMemoryFile = path.join(targetMemoryDir, 'project-memory.json');

// Source remember directories
const rememberDir1 = '/home/alastair/Romem/.remember';
const rememberDir2 = '/home/alastair/Romem/.remember2';

// Safe write to file
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {}
}

async function loadOrCreateDB() {
  await ensureDir(targetMemoryDir);
  try {
    const data = await fs.readFile(targetMemoryFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {
      project_context: {
        tech_stack: [],
        key_rules: [],
        architecture_notes: []
      },
      memories: []
    };
  }
}

async function saveDB(data) {
  await ensureDir(targetMemoryDir);
  const tempFile = `${targetMemoryFile}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tempFile, targetMemoryFile);
}

// Extract tags from fact text
function extractTags(text) {
  const keywords = {
    'santander': ['santander'],
    'satellite': ['satellite'],
    'novuna': ['novuna'],
    'n8n': ['n8n'],
    'openai': ['openai', 'openai-client'],
    'gemini': ['gemini'],
    'migration': ['migration', 'migrated', 'quoted_rates', 'lease_quotes', 'provider_rates'],
    'webhook': ['webhook', 'webhooks'],
    'autoquote': ['autoquote', 'auto-quote'],
    'email': ['email', 'intel', 'gmail'],
    'error': ['error', '500', 'failed', 'violation'],
    'refactor': ['refactor', 'split', 'redesigned'],
    'railway': ['railway', 'deploy'],
    'deal-score': ['deal_score', 'percentile-rank', 'efficiency']
  };

  const tags = new Set();
  const lowerText = text.toLowerCase();

  for (const [tag, patterns] of Object.entries(keywords)) {
    if (patterns.some(p => lowerText.includes(p))) {
      tags.add(tag);
    }
  }

  return Array.from(tags);
}

// Auto-determine category
function determineCategory(text) {
  const lower = text.toLowerCase();
  if (lower.includes('todo') || lower.includes('plan') || lower.includes('remain')) {
    return 'todo';
  }
  if (lower.includes('fix') || lower.includes('error') || lower.includes('constraint') || lower.includes('db') || lower.includes('migration')) {
    return 'database';
  }
  if (lower.includes('split') || lower.includes('service.ts') || lower.includes('architecture') || lower.includes('designed')) {
    return 'architecture';
  }
  if (lower.includes('style') || lower.includes('standard') || lower.includes('convention')) {
    return 'style-guide';
  }
  return 'general';
}

async function main() {
  console.log('==================================================');
  console.log('   SPLITLEASE HISTORICAL REMEMBER SEEDER');
  console.log('==================================================\n');

  const db = await loadOrCreateDB();

  // Pre-seed premium tech stack based on log analysis
  const essentialTech = [
    'Node.js', 'TypeScript', 'n8n Webhook', 'Gemini AI', 
    'OpenAI Shared Client', 'PostgreSQL DB', 'Railway Deploy', 
    'Playwright MCP', 'Gmail Pipeline'
  ];
  essentialTech.forEach(tech => {
    if (!db.project_context.tech_stack.includes(tech)) {
      db.project_context.tech_stack.push(tech);
    }
  });

  // Pre-seed core guidelines
  const coreGuidelines = [
    'Fixed CapCode REPLACE statement defeating index scans (use direct indices).',
    'Conditionally use otrMode: "standard" when customOtrPence is null to prevent Santander satellite 500 error.',
    'Async n8n (Gmail -> Gemini -> webhook) replaces heavy inline OpenAI processing.',
    'Redesigned opportunity scoring: remove efficiency bonus, use percentile-rank + marketability modifier.'
  ];
  coreGuidelines.forEach(rule => {
    if (!db.project_context.key_rules.includes(rule)) {
      db.project_context.key_rules.push(rule);
    }
  });

  const parsedMemories = [];

  // Helper to read and parse logs
  async function parseDoneLog(filePath, defaultDate = '2026-05-20') {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      let currentDate = defaultDate;
      // Extract date from filename if possible (e.g. today-2026-05-19.done.md)
      const dateMatch = path.basename(filePath).match(/today-(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        currentDate = dateMatch[1];
      }

      let activeEntry = '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Matches timeline entry like "## 20:38 | master" or "## 2026-05-19"
        if (trimmed.startsWith('## ')) {
          if (activeEntry) {
            pushParsedMemory(activeEntry, currentDate);
            activeEntry = '';
          }
          // Check if line contains a timestamp
          const hasTime = trimmed.match(/\d{2}:\d{2}/);
          if (!hasTime) {
            const possibleDate = trimmed.replace('##', '').trim();
            if (possibleDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              currentDate = possibleDate;
            }
          }
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          pushParsedMemory(trimmed.substring(2), currentDate);
        } else {
          // Multiline or timeline description line
          activeEntry = activeEntry ? `${activeEntry} ${trimmed}` : trimmed;
        }
      }

      if (activeEntry) {
        pushParsedMemory(activeEntry, currentDate);
      }
    } catch (e) {
      console.warn(`[Seeder Warning] Could not parse log file ${filePath}: ${e.message}`);
    }
  }

  function pushParsedMemory(text, dateString) {
    const cleanFact = text.replace(/^[-\s✓\s*]+/g, '').trim();
    if (!cleanFact || cleanFact.length < 15 || cleanFact.includes('Identity Candidates')) return;

    // Check duplicates
    if (parsedMemories.some(m => m.fact.toLowerCase() === cleanFact.toLowerCase())) return;

    const tags = extractTags(cleanFact);
    const category = determineCategory(cleanFact);

    parsedMemories.push({
      id: `mem_seed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fact: cleanFact,
      category: category,
      tags: tags.length ? tags : ['history'],
      created_at: new Date(dateString).toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // 1. Parse Handoff details from splitlease/.remember/remember.md
  console.log('[Seeder] Ingesting handoffs and state parameters...');
  try {
    const handoffPath = path.join(rememberDir2, 'remember.md');
    const content = await fs.readFile(handoffPath, 'utf8');
    
    // Parse handoff sections
    const sections = content.split('##');
    for (const section of sections) {
      const lines = section.split('\n');
      const title = lines[0].trim();
      const body = lines.slice(1).join(' ').trim();
      
      if (body && (title === 'State' || title === 'Next' || title === 'Context')) {
        pushParsedMemory(`[Handoff ${title}] ${body}`, '2026-05-20');
      }
    }
  } catch (e) {
    console.warn('[Seeder Warning] Could not read handoff remember.md');
  }

  // 2. Parse now.md timelines
  console.log('[Seeder] Reading task streams from now.md files...');
  await parseDoneLog(path.join(rememberDir1, 'now.md'), '2026-05-19');
  await parseDoneLog(path.join(rememberDir2, 'now.md'), '2026-05-20');

  // 3. Scan and parse all today-*.md logs
  console.log('[Seeder] Processing chronological daily done logs...');
  const dirsToScan = [rememberDir1, rememberDir2];
  
  for (const dir of dirsToScan) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.startsWith('today-') && file.endsWith('.md')) {
          await parseDoneLog(path.join(dir, file));
        }
      }
    } catch (e) {
      console.warn(`[Seeder Warning] Could not scan directory ${dir}: ${e.message}`);
    }
  }

  // Add parsed memories to DB, ensuring no duplicates on fact text
  let newMemoriesCount = 0;
  parsedMemories.forEach(mem => {
    const exists = db.memories.some(existing => existing.fact.toLowerCase() === mem.fact.toLowerCase());
    if (!exists) {
      db.memories.push(mem);
      newMemoriesCount++;
    }
  });

  // Save database
  await saveDB(db);

  console.log('\n==================================================');
  console.log('      SEEDING COMPLETED SUCCESSFULLY!');
  console.log('==================================================');
  console.log(`Target database    : ${targetMemoryFile}`);
  console.log(`Tech stack entries : ${db.project_context.tech_stack.length}`);
  console.log(`Coding guidelines  : ${db.project_context.key_rules.length}`);
  console.log(`Total Memories     : ${db.memories.length} (Ingested ${newMemoriesCount} new)`);
  console.log('==================================================\n');
}

main().catch(err => {
  console.error('Seeding Failed:', err);
});
