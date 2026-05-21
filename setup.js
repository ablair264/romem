import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const HOMEDIR = os.homedir();
const SERVER_PATH = path.resolve('./index.js');

const CLAUDE_CONFIG_PATH = path.join(HOMEDIR, '.claude.json');
const GEMINI_CONFIG_DIR = path.join(HOMEDIR, '.gemini');
const GEMINI_CONFIG_PATH = path.join(GEMINI_CONFIG_DIR, 'settings.json');

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    // Ignore
  }
}

async function updateJsonConfig(filePath, serverName, serverConfig) {
  let config = {};
  
  try {
    const rawData = await fs.readFile(filePath, 'utf8');
    config = JSON.parse(rawData);
  } catch (err) {
    // If file doesn't exist or is invalid, start with empty object
    config = {};
  }

  // Ensure mcpServers exists
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // Inject or update server configuration
  config.mcpServers[serverName] = serverConfig;

  // Safe atomic write
  const tempFile = `${filePath}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(config, null, 2), 'utf8');
  await fs.rename(tempFile, filePath);
  
  return config;
}

async function runSetup() {
  console.log('\n==================================================');
  console.log('   PROJECT-SCOPED MCP MEMORY SERVER SETUP');
  console.log('==================================================\n');

  console.log(`[Setup] Server path resolved to: ${SERVER_PATH}`);

  const serverConfig = {
    command: 'node',
    args: [SERVER_PATH],
    env: {}
  };

  const serverName = 'project-memory';

  // 1. Configure Claude Code
  try {
    console.log(`[Setup] Configuring Claude Code (global scope)...`);
    await updateJsonConfig(CLAUDE_CONFIG_PATH, serverName, serverConfig);
    console.log(`[Setup] SUCCESS: Updated Claude Code config at: ${CLAUDE_CONFIG_PATH}`);
  } catch (err) {
    console.error(`[Setup] FAILED: Could not configure Claude Code:`, err.message);
  }

  // 2. Configure Gemini
  try {
    console.log(`[Setup] Configuring Gemini (global scope)...`);
    await ensureDir(GEMINI_CONFIG_DIR);
    await updateJsonConfig(GEMINI_CONFIG_PATH, serverName, serverConfig);
    console.log(`[Setup] SUCCESS: Updated Gemini config at: ${GEMINI_CONFIG_PATH}`);
  } catch (err) {
    console.error(`[Setup] FAILED: Could not configure Gemini:`, err.message);
  }

  console.log('\n==================================================');
  console.log('   CONFIGURATION COMPLETED SUCCESSFULLY!');
  console.log('==================================================\n');

  console.log('Your local MCP Memory is now globally configured for your user accounts!');
  console.log('Any project folder from which you launch your AI assistants will automatically');
  console.log('have its own scoped database folder `.mcp-memory/` created in its root.\n');

  console.log('### How to configure Project-Specific Shared settings (Optional):');
  console.log('If you want to share memory with a development team, you can commit it to Git:');
  console.log('1. Simply keep the `.mcp-memory/` folder in your project root and commit it.');
  console.log('2. Add a `.mcp.json` (for Claude Code) or `.gemini/settings.json` (for Gemini) to the root of your project:');
  
  console.log('\n--- Project-scoped .mcp.json or .gemini/settings.json snippet ---');
  console.log(JSON.stringify({
    mcpServers: {
      [serverName]: serverConfig
    }
  }, null, 2));
  console.log('----------------------------------------------------------------\n');
}

runSetup().catch(console.error);
