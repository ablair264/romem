import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';

const testDir = path.resolve('./test-project-gui');

// Helper to make HTTP requests using Node native http
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', err => reject(err));

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('[Test Suite] Initializing project memory GUI tests...');
  
  // Clean up any stale test directory
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (err) {}

  await fs.mkdir(testDir, { recursive: true });

  // Spawn the GUI server scoped to the test project CWD on an isolated port to prevent collisions
  const serverProcess = spawn('node', ['gui.js', '--project-path', testDir, '--port', '4500']);
  
  let serverPort = null;
  let serverOutput = '';

  // Wait for the server to output its allocated port
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for GUI server to start. Output so far:\n${serverOutput}`));
    }, 5000);

    serverProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      serverOutput += chunk;
      console.log(`[Server Stdout] ${chunk.trim()}`);

      // Scan for dashboard URL line
      const match = chunk.match(/http:\/\/localhost:(\d+)/);
      if (match && match[1]) {
        serverPort = parseInt(match[1], 10);
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Stderr] ${data.toString().trim()}`);
    });
  });

  console.log(`\n[Test Suite] Detected GUI Server running on port ${serverPort}. Starting audits...`);

  try {
    // --- 1. Audit Static File Serving ---
    console.log('\n--- Test 1: Static File Serving ---');
    const indexRes = await makeRequest({
      hostname: 'localhost',
      port: serverPort,
      path: '/index.html',
      method: 'GET'
    });
    
    if (indexRes.statusCode !== 200) throw new Error(`Expected 200 for index.html, got ${indexRes.statusCode}`);
    if (!indexRes.headers['content-type'].includes('text/html')) {
      throw new Error(`Expected text/html content-type, got ${indexRes.headers['content-type']}`);
    }
    console.log('✓ index.html successfully served with correct Content-Type');

    const cssRes = await makeRequest({
      hostname: 'localhost',
      port: serverPort,
      path: '/style.css',
      method: 'GET'
    });
    if (cssRes.statusCode !== 200) throw new Error(`Expected 200 for style.css, got ${cssRes.statusCode}`);
    if (!cssRes.headers['content-type'].includes('text/css')) {
      throw new Error(`Expected text/css content-type, got ${cssRes.headers['content-type']}`);
    }
    console.log('✓ style.css successfully served with correct Content-Type');

    // --- 2. Audit GET /api/status ---
    console.log('\n--- Test 2: GET /api/status ---');
    const statusRes = await makeRequest({
      hostname: 'localhost',
      port: serverPort,
      path: '/api/status',
      method: 'GET'
    });
    const status = JSON.parse(statusRes.body);
    if (status.project_name !== 'test-project-gui') {
      throw new Error(`Expected project_name to be "test-project-gui", got "${status.project_name}"`);
    }
    console.log('✓ API status matches dynamically resolved project folder');

    // --- 3. Audit POST /api/memories (Add) ---
    console.log('\n--- Test 3: POST /api/memories (Add) ---');
    const addRes = await makeRequest({
      hostname: 'localhost',
      port: serverPort,
      path: '/api/memories',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      fact: 'We write ultra pure vanilla ESModules with beautiful style templates.',
      category: 'style-guide',
      tags: ['esm', 'css', 'design']
    });

    const addBody = JSON.parse(addRes.body);
    if (addRes.statusCode !== 201 || !addBody.success) {
      throw new Error(`Expected 201 created, got ${addRes.statusCode}`);
    }
    const createdMemory = addBody.memory;
    console.log(`✓ Memory created successfully with ID: ${createdMemory.id}`);

    // --- 4. Audit GET /api/memories (List) ---
    console.log('\n--- Test 4: GET /api/memories (List) ---');
    const listRes = await makeRequest({
      hostname: 'localhost',
      port: serverPort,
      path: '/api/memories',
      method: 'GET'
    });
    const listBody = JSON.parse(listRes.body);
    const found = listBody.memories.find(m => m.id === createdMemory.id);
    if (!found) throw new Error('Created memory block was not retrieved in list memories.');
    console.log('✓ Successfully listed memory bank and found newly added item');

    // --- 5. Audit PUT /api/context (Update Context) ---
    console.log('\n--- Test 5: PUT /api/context (Update Context) ---');
    const contextRes = await makeRequest({
      hostname: 'localhost',
      port: serverPort,
      path: '/api/context',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, {
      tech_stack: ['Node.js', 'Vanilla CSS', 'Lucide'],
      key_rules: ['All code must pass integration tests'],
      architecture_notes: ['The directory layout is served from public/']
    });

    if (contextRes.statusCode !== 200) {
      throw new Error(`Expected 200 for PUT /api/context, got ${contextRes.statusCode}`);
    }
    console.log('✓ Successfully saved high-level project context variables');

    // Verify context persistent reads
    const getContextRes = await makeRequest({
      hostname: 'localhost',
      port: serverPort,
      path: '/api/context',
      method: 'GET'
    });
    const contextBody = JSON.parse(getContextRes.body);
    if (contextBody.project_context.tech_stack[1] !== 'Vanilla CSS') {
      throw new Error('Retrieved context did not match our edited value.');
    }
    console.log('✓ Successfully verified persistent context read back');

    // --- 6. Audit DELETE /api/memories (Delete) ---
    console.log('\n--- Test 6: DELETE /api/memories (Delete) ---');
    const deleteRes = await makeRequest({
      hostname: 'localhost',
      port: serverPort,
      path: `/api/memories?id=${createdMemory.id}`,
      method: 'DELETE'
    });
    if (deleteRes.statusCode !== 200) {
      throw new Error(`Expected 200 for delete action, got ${deleteRes.statusCode}`);
    }
    console.log('✓ Memory successfully deleted');

    // Check again to ensure list is empty
    const finalCheckRes = await makeRequest({
      hostname: 'localhost',
      port: serverPort,
      path: '/api/memories',
      method: 'GET'
    });
    const finalList = JSON.parse(finalCheckRes.body).memories;
    if (finalList.some(m => m.id === createdMemory.id)) {
      throw new Error('Memory was deleted but still retrieved in list.');
    }
    console.log('✓ Memory successfully confirmed absent from DB');

    // --- 7. Audit GET /api/project-mds ---
    console.log('\n--- Test 7: GET /api/project-mds ---');
    const getMdsRes = await makeRequest({
      hostname: 'localhost',
      port: serverPort,
      path: '/api/project-mds',
      method: 'GET'
    });
    if (getMdsRes.statusCode !== 200) {
      throw new Error(`Expected 200 for GET /api/project-mds, got ${getMdsRes.statusCode}`);
    }
    const mdsBody = JSON.parse(getMdsRes.body);
    if (!mdsBody.files || !('CLAUDE.md' in mdsBody.files)) {
      throw new Error('Expected files payload with CLAUDE.md key');
    }
    console.log('✓ Successfully retrieved project markdown files');

    // --- 8. Audit PUT /api/project-mds ---
    console.log('\n--- Test 8: PUT /api/project-mds ---');
    const testContent = '# CLAUDE.md\n- Always write vanilla code\n- No frameworks unless asked';
    const putMdsRes = await makeRequest({
      hostname: 'localhost',
      port: serverPort,
      path: '/api/project-mds',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, {
      files: {
        'CLAUDE.md': testContent
      }
    });
    if (putMdsRes.statusCode !== 200) {
      throw new Error(`Expected 200 for PUT /api/project-mds, got ${putMdsRes.statusCode}`);
    }
    
    // Verify file content persists
    const getMdsVerifyRes = await makeRequest({
      hostname: 'localhost',
      port: serverPort,
      path: '/api/project-mds',
      method: 'GET'
    });
    const mdsVerifyBody = JSON.parse(getMdsVerifyRes.body);
    if (mdsVerifyBody.files['CLAUDE.md'] !== testContent) {
      throw new Error('Written markdown file content did not persist correctly.');
    }
    console.log('✓ Successfully verified markdown file editing persistence');

    // --- 9. Audit POST /api/ai/agent (Missing API Key) ---
    console.log('\n--- Test 9: POST /api/ai/agent (Authentication failure) ---');
    const aiAgentRes = await makeRequest({
      hostname: 'localhost',
      port: serverPort,
      path: '/api/ai/agent',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      action: 'detect_duplicates'
    });
    if (aiAgentRes.statusCode !== 401) {
      throw new Error(`Expected 401 for unauthorized AI request, got ${aiAgentRes.statusCode}`);
    }
    console.log('✓ Successfully verified API key validation constraints');

    console.log('\n=============================================');
    console.log(' SUCCESS: All GUI Integration Tests Passed!');
    console.log('=============================================\n');

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILURE:', err.message);
    process.exitCode = 1;
  } finally {
    // Terminate the spawned GUI process
    console.log('[Test Suite] Cleaning up test server and directory structures...');
    serverProcess.kill('SIGTERM');
    
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (err) {}
    
    console.log('[Test Suite] Cleaned up.');
  }
}

runTests();
