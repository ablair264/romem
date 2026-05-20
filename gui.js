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

// Boot the server starting at 3000
startServer(3000);
