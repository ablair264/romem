import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const PORT = 4555;
const BASE_URL = `http://localhost:${PORT}`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeRequest(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP error ${res.status}: ${text}`);
  }
  return res.json();
}

async function runSmokeTest() {
  console.log('\n======================================================');
  console.log('       ROMEM PRODUCTION FLOW SMOKE TEST');
  console.log('======================================================\n');

  // Ensure production build dist/server/server/index.js exists
  const serverPath = path.resolve('dist/server/server/index.js');
  if (!fs.existsSync(serverPath)) {
    console.error(`[Smoke Test] ERROR: Production server build not found at ${serverPath}`);
    console.error('Please run "npm run build" first.');
    process.exit(1);
  }

  console.log('[Smoke Test] Booting production server on port %d...', PORT);
  
  // Set temporary directory for sqlite db so we don't contaminate local data
  const tempDir = path.resolve('.romem-smoke-test-temp');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  const env = {
    ...process.env,
    PORT: PORT.toString(),
    ROMEM_PROJECT_ID: 'smoke-test-project',
    ROMEM_ROOT_DIR: tempDir,
  };

  const serverProc = spawn('node', [serverPath], { env });

  serverProc.stderr.on('data', (data) => {
    console.error(`[Server Stderr] ${data.toString().trim()}`);
  });

  // Let the server start
  await sleep(2500);

  try {
    // 1. Health check
    console.log('[Smoke Test] 1. Checking backend health...');
    const health = await makeRequest(`${BASE_URL}/api/health`);
    console.log('✓ Health OK:', health);

    // 2. Submit task summary (Triggers Mastra Ingestion -> stages proposal)
    console.log('\n[Smoke Test] 2. Submitting simulated task summary...');
    const summaryPayload = {
      agent: 'gemini',
      taskId: 'smoke-999',
      summary: 'Added automated smoke testing and verified static next.js compilation',
      changes: ['Created scripts/smoke-test.js', 'Updated next.config.mjs for static export'],
      decisions: ['Use cross-platform copy script instead of shell'],
      gotchas: ['Dynamic rewrites not compatible with next static exports'],
      todos: ['Integrate smoke test in Railway build pipelines'],
      docsImpact: ['Documented Railway steps in README.md'],
      skillsImpact: ['smoke testing guidelines'],
      categories: ['testing', 'devops'],
      tags: ['smoke-test', 'railway', 'nextjs'],
    };

    const submitRes = await makeRequest(
      `${BASE_URL}/api/projects/smoke-test-project/task-summaries`,
      'POST',
      summaryPayload
    );

    const proposal = submitRes.proposal;
    const taskSummary = submitRes.taskSummary;

    console.log('✓ Task summary ingested. Staged proposal created:');
    console.log(`  - Proposal ID: ${proposal.id}`);
    console.log(`  - Summary: ${proposal.summary}`);
    console.log(`  - Status: ${proposal.status}`);
    console.log(`  - Used Fallback Model: ${submitRes.usedFallback}`);

    if (proposal.status !== 'staged') {
      throw new Error(`Expected proposal status 'staged', got '${proposal.status}'`);
    }

    // 3. Approve proposal (Applies operations, copies skill files, and creates DB entries)
    console.log('\n[Smoke Test] 3. Approving proposal %s...', proposal.id);
    const approveRes = await makeRequest(`${BASE_URL}/api/proposals/${proposal.id}/approve`, 'POST', {});
    console.log('✓ Proposal approved. Applied status response received:');
    console.log(`  - Status: ${approveRes.status}`);

    if (approveRes.status !== 'applied') {
      throw new Error(`Expected approved status 'applied', got '${approveRes.status}'`);
    }

    // 4. Verify memories were created in the store
    console.log('\n[Smoke Test] 4. Querying database memories to verify persistence...');
    const memories = await makeRequest(`${BASE_URL}/api/projects/smoke-test-project/memories`);
    console.log(`✓ Retrieved ${memories.length} memories from SQLite storage.`);
    const hasMatch = memories.some(m => m.fact.includes('smoke testing'));
    if (!hasMatch) {
      throw new Error('Could not find the smoke testing fact in stored database memories.');
    }
    console.log('✓ Confirmed smoke test memory fact is successfully stored!');

    // 5. Verify todos were created
    console.log('\n[Smoke Test] 5. Verifying TODOs database entries...');
    const todos = await makeRequest(`${BASE_URL}/api/projects/smoke-test-project/todos`);
    const hasTodo = todos.some(t => t.title.includes('smoke test in Railway'));
    if (!hasTodo) {
      throw new Error('Expected TODO "smoke test in Railway" was not found.');
    }
    console.log('✓ Confirmed TODO item is successfully stored!');

    console.log('\n======================================================');
    console.log('       SUCCESS: ALL SMOKE TESTS COMPLETED SUCCESSFULLY!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('\n❌ SMOKE TEST FAILURE:', error.message);
    process.exitCode = 1;
  } finally {
    console.log('[Smoke Test] Cleaning up server process and temporary directory...');
    serverProc.kill();
    
    // Clean up temporary database files
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {}

    console.log('[Smoke Test] Cleaned up.');
  }
}

runSmokeTest().catch(console.error);
