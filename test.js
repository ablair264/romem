import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const TEST_DIR = path.resolve('./test-project');
const MEMORY_FILE = path.join(TEST_DIR, '.mcp-memory', 'project-memory.json');

async function cleanUp() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    console.log('[Test Suite] Cleaned up temporary test directory.');
  } catch (err) {
    // Ignore error
  }
}

async function runTests() {
  console.log('[Test Suite] Initializing project memory tests...');
  await cleanUp();
  await fs.mkdir(TEST_DIR, { recursive: true });

  // Spawn index.js pointing to our test directory
  const serverProc = spawn('node', ['./index.js', '--project-path', TEST_DIR]);

  // Log stderr from server for visibility
  serverProc.stderr.on('data', (data) => {
    console.error(`[Server Stderr] ${data.toString().trim()}`);
  });

  serverProc.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[Test Suite] Server process exited unexpectedly with code ${code}`);
      process.exit(1);
    }
  });

  // Helper to read JSON-RPC lines from server stdout
  let buffer = '';
  const pendingRequests = new Map();

  serverProc.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const message = JSON.parse(trimmed);
        if (message.id !== undefined && pendingRequests.has(message.id)) {
          const { resolve, reject } = pendingRequests.get(message.id);
          pendingRequests.delete(message.id);
          if (message.error) {
            reject(message.error);
          } else {
            resolve(message.result);
          }
        }
      } catch (err) {
        console.error('[Test Suite] Failed to parse JSON-RPC line:', trimmed, err);
      }
    }
  });

  let nextId = 1;
  function callRpc(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pendingRequests.set(id, { resolve, reject });
      const payload = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };
      serverProc.stdin.write(JSON.stringify(payload) + '\n');
    });
  }

  function sendNotification(method, params = {}) {
    const payload = {
      jsonrpc: '2.0',
      method,
      params
    };
    serverProc.stdin.write(JSON.stringify(payload) + '\n');
  }

  try {
    // 1. Perform standard MCP Handshake
    console.log('\n--- 1. Performing Handshake ---');
    const initResult = await callRpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-test-runner', version: '1.0.0' }
    });
    console.log('[Test Suite] Handshake init response received:', initResult.serverInfo);
    
    sendNotification('notifications/initialized');
    console.log('[Test Suite] Sent initialized notification.');

    // 2. Add a memory
    console.log('\n--- 2. Adding Memories ---');
    const addResult = await callRpc('tools/call', {
      name: 'add_memory',
      arguments: {
        fact: 'We use TypeScript with standard ESM modules and strict lint rules.',
        category: 'style-guide',
        tags: ['typescript', 'esm', 'lint']
      }
    });
    console.log('[Test Suite] Add memory response:', addResult.content[0].text);

    // 3. List memories
    console.log('\n--- 3. Listing Memories ---');
    const listResult = await callRpc('tools/call', {
      name: 'list_memories',
      arguments: {}
    });
    console.log('[Test Suite] List memories response:', listResult.content[0].text);

    // Extract ID of added memory
    const match = listResult.content[0].text.match(/ID: (mem_[^\s\]]+)/);
    if (!match) throw new Error('Could not find created memory ID in listing.');
    const memoryId = match[1];
    console.log(`[Test Suite] Extracted newly created memory ID: ${memoryId}`);

    // 4. Search memories
    console.log('\n--- 4. Searching Memories ---');
    const searchResult = await callRpc('tools/call', {
      name: 'search_memories',
      arguments: { query: 'TypeScript' }
    });
    console.log('[Test Suite] Search results for "TypeScript":', searchResult.content[0].text);

    // 5. Update memories
    console.log('\n--- 5. Updating Memories ---');
    const updateResult = await callRpc('tools/call', {
      name: 'update_memory',
      arguments: {
        id: memoryId,
        fact: 'We use TypeScript v5.4, ESM structures, and modern strict eslint configurations.',
        category: 'style-guide',
        tags: ['typescript', 'eslint', 'v5.4']
      }
    });
    console.log('[Test Suite] Update memory response:', updateResult.content[0].text);

    // 6. Test project context and dynamic categories
    console.log('\n--- 6. Managing High-Level Project Context & Categories ---');
    const contextInitResult = await callRpc('tools/call', {
      name: 'get_project_context',
      arguments: {}
    });
    console.log('[Test Suite] Initial context:', contextInitResult.content[0].text);

    // Test List Categories
    const categoriesInit = await callRpc('tools/call', {
      name: 'list_categories',
      arguments: {}
    });
    console.log('[Test Suite] Initial categories list:\n', categoriesInit.content[0].text);

    // Assert Invalid Category rejection
    console.log('[Test Suite] Testing bounds: Attempting to add memory with invalid category...');
    const invalidAdd = await callRpc('tools/call', {
      name: 'add_memory',
      arguments: {
        fact: 'This fact has an invalid category.',
        category: 'ultra-premium-nonexistent',
        tags: ['invalid']
      }
    });
    if (invalidAdd.isError) {
      console.log('[Test Suite] Success: Server correctly rejected invalid category addition:\n', invalidAdd.content[0].text);
    } else {
      throw new Error('Server should have rejected adding memory with invalid category!');
    }

    // Update Context, including a custom category list
    const updateContextResult = await callRpc('tools/call', {
      name: 'update_project_context',
      arguments: {
        tech_stack: ['Node.js', 'TypeScript', 'Fastify', 'Neon Postgres'],
        key_rules: ['Always write detailed unit tests for tools', 'Ensure absolute compliance to standards'],
        architecture_notes: ['Store models inside src/models', 'Register routes inside src/routes'],
        categories: ['general', 'style-guide', 'architecture', 'todo', 'database', 'performance-custom']
      }
    });
    console.log('[Test Suite] Update context response:', updateContextResult.content[0].text);

    const categoriesFinal = await callRpc('tools/call', {
      name: 'list_categories',
      arguments: {}
    });
    console.log('[Test Suite] Updated categories list:\n', categoriesFinal.content[0].text);
    if (!categoriesFinal.content[0].text.includes('performance-custom')) {
      throw new Error('Performance custom category was not successfully saved!');
    }

    const contextFinalResult = await callRpc('tools/call', {
      name: 'get_project_context',
      arguments: {}
    });
    console.log('[Test Suite] Updated context:', contextFinalResult.content[0].text);

    // 7. Delete memories
    console.log('\n--- 7. Deleting Memories ---');
    const deleteResult = await callRpc('tools/call', {
      name: 'delete_memory',
      arguments: { id: memoryId }
    });
    console.log('[Test Suite] Delete response:', deleteResult.content[0].text);

    // 8. Verify the DB file exists on disk
    console.log('\n--- 8. Verifying local storage on disk ---');
    const fileExists = await fs.access(MEMORY_FILE).then(() => true).catch(() => false);
    if (fileExists) {
      console.log(`[Test Suite] SUCCESS: Scoped memory file successfully verified at: ${MEMORY_FILE}`);
      const rawData = await fs.readFile(MEMORY_FILE, 'utf8');
      console.log('[Test Suite] Final DB contents on disk:\n', rawData);
    } else {
      throw new Error(`Memory database file was not created at ${MEMORY_FILE}`);
    }

    console.log('\n======================================');
    console.log('SUCCESS: All integration tests passed!');
    console.log('======================================\n');

  } catch (err) {
    console.error('\nFAIL: Test suite failed with error:', err);
    serverProc.kill();
    await cleanUp();
    process.exit(1);
  }

  // Gracefully terminate the server and cleanup
  serverProc.kill();
  await cleanUp();
}

runTests().catch(console.error);
