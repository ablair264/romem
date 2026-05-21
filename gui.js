import http from 'http';
import fs from 'fs/promises';
import path from 'path';

// Helper to resolve project folder path dynamically
function getProjectDir() {
  const pathArgIndex = process.argv.indexOf('--project-path');
  if (pathArgIndex !== -1 && process.argv[pathArgIndex + 1]) {
    return path.resolve(process.argv[pathArgIndex + 1]);
  }
  if (process.env.MCP_PROJECT_PATH) {
    return path.resolve(process.env.MCP_PROJECT_PATH);
  }
  return path.resolve(process.cwd());
}

// Helper to resolve starting port dynamically
function getStartingPort() {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const p = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(p)) return p;
  }
  if (process.env.PORT) {
    const p = parseInt(process.env.PORT, 10);
    if (!isNaN(p)) return p;
  }
  return 3000;
}

const projectDir = getProjectDir();
const memoryDir = path.join(projectDir, '.mcp-memory');
const memoryFile = path.join(memoryDir, 'project-memory.json');

// Ensure memory directory exists
async function ensureMemoryDir() {
  try {
    await fs.mkdir(memoryDir, { recursive: true });
  } catch (err) {
    // Ignore
  }
}

// Load database (lazy-creates if missing)
async function loadMemory() {
  await ensureMemoryDir();
  try {
    const data = await fs.readFile(memoryFile, 'utf8');
    const db = JSON.parse(data);
    
    if (!db.project_context) db.project_context = {};
    if (!db.project_context.tech_stack) db.project_context.tech_stack = [];
    if (!db.project_context.key_rules) db.project_context.key_rules = [];
    if (!db.project_context.architecture_notes) db.project_context.architecture_notes = [];
    if (!db.project_context.categories) {
      db.project_context.categories = ['general', 'style-guide', 'architecture', 'todo', 'database'];
    }
    
    return db;
  } catch (err) {
    const initialData = {
      project_context: {
        tech_stack: [],
        key_rules: [],
        architecture_notes: [],
        categories: ['general', 'style-guide', 'architecture', 'todo', 'database']
      },
      memories: []
    };
    await saveMemory(initialData);
    return initialData;
  }
}

// Save database atomically
async function saveMemory(data) {
  await ensureMemoryDir();
  const tempFile = `${memoryFile}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tempFile, memoryFile);
}

// Helper to parse JSON request body
function getRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({});
      }
    });
  });
}

// Helper to send JSON responses
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Mime type map for static file server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --- API ROUTING ---
  if (pathname.startsWith('/api/')) {
    const db = await loadMemory();

    try {
      // 1. GET /api/status - Retrieve metadata and statistics
      if (pathname === '/api/status' && req.method === 'GET') {
        const activeCategories = db.project_context.categories || ['general', 'style-guide', 'architecture', 'todo', 'database'];
        const tags = new Set(db.memories.flatMap(m => m.tags));
        
        return sendJson(res, 200, {
          project_path: projectDir,
          project_name: path.basename(projectDir),
          stats: {
            memories_count: db.memories.length,
            categories_count: activeCategories.length,
            tags_count: tags.size
          }
        });
      }

      // 2. GET /api/memories - Retrieve list of memories
      if (pathname === '/api/memories' && req.method === 'GET') {
        return sendJson(res, 200, { memories: db.memories });
      }

      // 3. POST /api/memories - Add new memory
      if (pathname === '/api/memories' && req.method === 'POST') {
        const body = await getRequestBody(req);
        if (!body.fact || !body.category) {
          return sendJson(res, 400, { error: 'Missing required fields: "fact" and "category"' });
        }

        const activeCategories = db.project_context.categories || ['general', 'style-guide', 'architecture', 'todo', 'database'];
        const cleanCategory = body.category.toLowerCase().trim();

        if (!activeCategories.includes(cleanCategory)) {
          return sendJson(res, 400, { error: `Category "${body.category}" is not in the project's master categories list.` });
        }

        const newMemory = {
          id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          fact: body.fact,
          category: cleanCategory,
          tags: (body.tags || []).map(t => t.toLowerCase().trim()).filter(Boolean),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        db.memories.push(newMemory);
        await saveMemory(db);

        console.log(`[GUI Server] Added memory: ${newMemory.id}`);
        return sendJson(res, 201, { success: true, memory: newMemory });
      }

      // 4. PUT /api/memories - Update memory
      if (pathname === '/api/memories' && req.method === 'PUT') {
        const body = await getRequestBody(req);
        if (!body.id || !body.fact || !body.category) {
          return sendJson(res, 400, { error: 'Missing required fields: "id", "fact", and "category"' });
        }

        const index = db.memories.findIndex(m => m.id === body.id);
        if (index === -1) {
          return sendJson(res, 404, { error: `Memory with ID ${body.id} not found.` });
        }

        const activeCategories = db.project_context.categories || ['general', 'style-guide', 'architecture', 'todo', 'database'];
        const cleanCategory = body.category.toLowerCase().trim();

        if (!activeCategories.includes(cleanCategory)) {
          return sendJson(res, 400, { error: `Category "${body.category}" is not in the project's master categories list.` });
        }

        db.memories[index] = {
          ...db.memories[index],
          fact: body.fact,
          category: cleanCategory,
          tags: body.tags 
            ? body.tags.map(t => t.toLowerCase().trim()).filter(Boolean)
            : db.memories[index].tags,
          updated_at: new Date().toISOString()
        };

        await saveMemory(db);
        console.log(`[GUI Server] Updated memory: ${body.id}`);
        return sendJson(res, 200, { success: true, memory: db.memories[index] });
      }

      // 5. DELETE /api/memories - Delete memory
      if (pathname === '/api/memories' && req.method === 'DELETE') {
        const id = parsedUrl.searchParams.get('id');
        if (!id) {
          return sendJson(res, 400, { error: 'Missing query parameter: "id"' });
        }

        const initialLength = db.memories.length;
        db.memories = db.memories.filter(m => m.id !== id);

        if (db.memories.length === initialLength) {
          return sendJson(res, 404, { error: `Memory with ID ${id} not found.` });
        }

        await saveMemory(db);
        console.log(`[GUI Server] Deleted memory: ${id}`);
        return sendJson(res, 200, { success: true });
      }

      // 6. GET /api/context - Retrieve project context
      if (pathname === '/api/context' && req.method === 'GET') {
        return sendJson(res, 200, { project_context: db.project_context });
      }

      // 7. PUT /api/context - Update project context
      if (pathname === '/api/context' && req.method === 'PUT') {
        const body = await getRequestBody(req);
        
        if (body.tech_stack) db.project_context.tech_stack = body.tech_stack;
        if (body.key_rules) db.project_context.key_rules = body.key_rules;
        if (body.architecture_notes) db.project_context.architecture_notes = body.architecture_notes;
        
        if (body.categories) {
          const processed = body.categories.map(c => c.toLowerCase().trim()).filter(Boolean);
          if (!processed.includes('general')) {
            processed.unshift('general');
          }
          db.project_context.categories = processed;

          // Cascade delete: map memories inside deleted categories to 'general'
          db.memories.forEach(m => {
            if (!processed.includes(m.category)) {
              console.log(`[GUI Server] Re-mapped memory ${m.id} from orphaned category "${m.category}" to "general"`);
              m.category = 'general';
            }
          });
        }

        await saveMemory(db);
        console.log(`[GUI Server] Updated high-level project context.`);
        return sendJson(res, 200, { success: true, project_context: db.project_context });
      }

      // GET /api/project-mds - Load CLAUDE.md, AGENTS.md, GEMINI.md
      if (pathname === '/api/project-mds' && req.method === 'GET') {
        const fileNames = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md'];
        const files = {};
        for (const fileName of fileNames) {
          const filePath = path.join(projectDir, fileName);
          try {
            const content = await fs.readFile(filePath, 'utf8');
            files[fileName] = content;
          } catch (err) {
            files[fileName] = ''; // Return empty string if file doesn't exist
          }
        }
        return sendJson(res, 200, { files });
      }

      // PUT /api/project-mds - Save CLAUDE.md, AGENTS.md, GEMINI.md
      if (pathname === '/api/project-mds' && req.method === 'PUT') {
        const body = await getRequestBody(req);
        if (body.files) {
          for (const [filename, content] of Object.entries(body.files)) {
            if (['CLAUDE.md', 'AGENTS.md', 'GEMINI.md'].includes(filename)) {
              const filePath = path.join(projectDir, filename);
              await fs.writeFile(filePath, content || '', 'utf8');
            }
          }
          return sendJson(res, 200, { success: true });
        } else if (body.filename && body.content !== undefined) {
          const { filename, content } = body;
          if (['CLAUDE.md', 'AGENTS.md', 'GEMINI.md'].includes(filename)) {
            const filePath = path.join(projectDir, filename);
            await fs.writeFile(filePath, content || '', 'utf8');
            return sendJson(res, 200, { success: true });
          } else {
            return sendJson(res, 400, { error: 'Invalid filename' });
          }
        }
        return sendJson(res, 400, { error: 'Missing files or filename/content' });
      }

      // POST /api/ai/agent - Groq Llama 3 API router
      if (pathname === '/api/ai/agent' && req.method === 'POST') {
        const body = await getRequestBody(req);
        const groqKey = req.headers['authorization']?.replace('Bearer ', '') || body.groqKey;

        if (!groqKey) {
          return sendJson(res, 401, { error: 'Missing Groq API Key. Please configure it in Settings.' });
        }

        const action = body.action;
        const payload = body.payload || {};

        let systemPrompt = '';
        let userPrompt = '';

        if (action === 'detect_duplicates') {
          systemPrompt = `You are an expert AI database clean-up agent. Your task is to scan the project memories and identify exact or semantic duplicates (rules/facts that convey the same instruction, e.g., 'Use TypeScript strict mode' and 'Strict TS mode is enabled').
Return a JSON object with a "duplicates" array, where each element is an object representing a duplicate group:
{
  "duplicates": [
    {
      "groupName": "Short descriptive name for the duplicate group",
      "duplicateIds": ["mem_id1", "mem_id2"],
      "mergeSuggestion": "Single, clear, unified pure guideline statement that incorporates both memories"
    }
  ]
}
Return ONLY valid JSON. Do not include markdown code block syntax (like \`\`\`json) in your raw response.`;
          userPrompt = `Here is the list of project memories to scan for duplicates:\n${JSON.stringify(db.memories, null, 2)}`;
        } else if (action === 'prune_obsolete') {
          systemPrompt = `You are an expert project compliance agent. Your task is to scan the list of project memories and identify any contradictory, obsolete, or outdated rules (e.g. one memory says 'Use Tailwind CSS v3' and a newer one says 'Upgrade styling to Tailwind CSS v4').
Return a JSON object with an "obsolete" array containing items representing rule drift or direct obsolescence:
{
  "obsolete": [
    {
      "activeId": "mem_id_of_newer_correct_rule",
      "activeFact": "The content of the newer rule",
      "obsoleteId": "mem_id_of_older_outdated_rule",
      "obsoleteFact": "The content of the older rule",
      "reason": "Detailed explanation of why the older rule is obsolete or contradicted by the newer rule"
    }
  ]
}
Return ONLY valid JSON. Do not include markdown code block syntax (like \`\`\`json) in your raw response.`;
          userPrompt = `Here is the list of project memories to scan for obsolete or contradicted rules:\n${JSON.stringify(db.memories, null, 2)}`;
        } else if (action === 'auto_classify') {
          systemPrompt = `You are an expert memory organization agent. Analyze the provided project memories and suggest the most appropriate category (must be one of: ${JSON.stringify(db.project_context.categories)}) and highly specific tags for each memory to maintain organization.
Return a JSON object with a "classifications" array:
{
  "classifications": [
    {
      "id": "mem_id",
      "fact": "Fact content",
      "suggestedCategory": "category_name",
      "suggestedTags": ["tag1", "tag2"]
    }
  ]
}
Return ONLY valid JSON. Do not include markdown code block syntax.`;
          userPrompt = `Here are the memories to analyze:\n${JSON.stringify(db.memories, null, 2)}`;
        } else if (action === 'sync_markdown') {
          const fileNames = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md'];
          const files = {};
          for (const fileName of fileNames) {
            const filePath = path.join(projectDir, fileName);
            try {
              files[fileName] = await fs.readFile(filePath, 'utf8');
            } catch (err) {
              files[fileName] = '';
            }
          }

          systemPrompt = `You are an expert developer workflow agent. Analyze the project memories and high-level context, and compare them with the current contents of the project's key rules files (CLAUDE.md, AGENTS.md, GEMINI.md). Propose precise updates and additions to these files to ensure they capture the latest developer memories and facts perfectly.
Return a JSON object of this structure:
{
  "claudemd": {
    "proposed": "Complete new content for CLAUDE.md with changes integrated"
  },
  "agentsmd": {
    "proposed": "Complete new content for AGENTS.md with changes integrated"
  },
  "geminimd": {
    "proposed": "Complete new content for GEMINI.md with changes integrated"
  },
  "explanation": "Brief markdown list explaining what rules were synced and why"
}
Return ONLY valid JSON. Do not include markdown code block wrapping in your raw response.`;
          userPrompt = `Project Context:
${JSON.stringify(db.project_context, null, 2)}

Stored Project Memories:
${JSON.stringify(db.memories, null, 2)}

Current File Contents:
- CLAUDE.md:
${files['CLAUDE.md']}

- AGENTS.md:
${files['AGENTS.md']}

- GEMINI.md:
${files['GEMINI.md']}`;
        } else {
          return sendJson(res, 400, { error: 'Invalid AI Agent action requested' });
        }

        // Call Groq API
        try {
          const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.1,
              response_format: { type: 'json_object' }
            })
          });

          if (!groqResponse.ok) {
            const errText = await groqResponse.text();
            throw new Error(`Groq API responded with status ${groqResponse.status}: ${errText}`);
          }

          const groqData = await groqResponse.json();
          let completionText = groqData.choices?.[0]?.message?.content || '{}';
          
          // Double check: if it has markdown wrapper, clean it
          completionText = completionText.trim();
          if (completionText.startsWith('```json')) {
            completionText = completionText.replace(/^```json/, '').replace(/```$/, '').trim();
          } else if (completionText.startsWith('```')) {
            completionText = completionText.replace(/^```/, '').replace(/```$/, '').trim();
          }

          let parsedResult;
          try {
            parsedResult = JSON.parse(completionText);
          } catch (jsonErr) {
            console.error('Failed to parse Groq completion as JSON:', completionText);
            return sendJson(res, 500, { error: 'Failed to parse AI response as JSON', raw: completionText });
          }

          return sendJson(res, 200, parsedResult);
        } catch (apiErr) {
          console.error('[GUI Server] Groq Request Failed:', apiErr);
          return sendJson(res, 502, { error: `AI service error: ${apiErr.message}` });
        }
      }

      // If no endpoint matched
      return sendJson(res, 404, { error: 'Endpoint not found' });

    } catch (err) {
      console.error('[GUI Server] API Error:', err);
      return sendJson(res, 500, { error: `Internal server error: ${err.message}` });
    }
  }

  // --- STATIC FILE SERVING ---
  try {
    let cleanPath = pathname === '/' ? 'index.html' : pathname.substring(1);
    let filePath = path.join('./public', cleanPath);

    // Security check: ensure path is within public folder
    const relative = path.relative('./public', filePath);
    const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    if (!isSafe && cleanPath !== 'index.html') {
      res.writeHead(403);
      return res.end('Access Forbidden');
    }

    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Internal Server Error: ${err.message}`);
    }
  }
});

// Automatic port search
function startServer(port) {
  server.listen(port, () => {
    console.log('\n==================================================');
    console.log('   PROJECT MEMORY CENTER (WEB INTERFACE)');
    console.log('==================================================');
    console.log(`Project Folder : ${projectDir}`);
    console.log(`Active CWD     : ${process.cwd()}`);
    console.log(`Web Dashboard  : http://localhost:${port}`);
    console.log('==================================================\n');
    console.log('Press Ctrl+C to terminate the dashboard.\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[GUI Server] Port ${port} is in use, attempting port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[GUI Server] Server Error:', err);
      process.exit(1);
    }
  });
}

// Boot the server using the resolved starting port
startServer(getStartingPort());
