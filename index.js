#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

// Helper to resolve the active project path dynamically
function getProjectDir() {
  // 1. Check CLI argument --project-path
  const pathArgIndex = process.argv.indexOf('--project-path');
  if (pathArgIndex !== -1 && process.argv[pathArgIndex + 1]) {
    const resolvedPath = path.resolve(process.argv[pathArgIndex + 1]);
    console.error(`[Project Memory] Scoping project path via CLI: ${resolvedPath}`);
    return resolvedPath;
  }

  // 2. Check environment variable
  if (process.env.MCP_PROJECT_PATH) {
    const resolvedPath = path.resolve(process.env.MCP_PROJECT_PATH);
    console.error(`[Project Memory] Scoping project path via environment variable: ${resolvedPath}`);
    return resolvedPath;
  }

  // 3. Fallback to process.cwd() (directory where AI client is launched)
  const resolvedPath = path.resolve(process.cwd());
  console.error(`[Project Memory] Scoping project path via CWD: ${resolvedPath}`);
  return resolvedPath;
}

const projectDir = getProjectDir();
const memoryDir = path.join(projectDir, '.mcp-memory');
const memoryFile = path.join(memoryDir, 'project-memory.json');

// Ensure memory directory exists
async function ensureMemoryDir() {
  try {
    await fs.mkdir(memoryDir, { recursive: true });
  } catch (err) {
    // Ignore if already exists
  }
}

// Load memory database from disk (lazy-creates if missing)
async function loadMemory() {
  await ensureMemoryDir();
  try {
    const data = await fs.readFile(memoryFile, 'utf8');
    const db = JSON.parse(data);
    
    // Ensure project_context and categories exist
    if (!db.project_context) {
      db.project_context = {};
    }
    if (!db.project_context.tech_stack) db.project_context.tech_stack = [];
    if (!db.project_context.key_rules) db.project_context.key_rules = [];
    if (!db.project_context.architecture_notes) db.project_context.architecture_notes = [];
    if (!db.project_context.categories) {
      db.project_context.categories = ['general', 'style-guide', 'architecture', 'todo', 'database'];
    }
    
    return db;
  } catch (err) {
    // Initialize an empty store structure
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

// Save memory database to disk with atomic write to avoid corruption
async function saveMemory(data) {
  await ensureMemoryDir();
  const tempFile = `${memoryFile}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tempFile, memoryFile);
}

// Create the MCP server instance
const server = new Server(
  {
    name: 'project-memory-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register list of available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'add_memory',
        description: "Add a new persistent memory, fact, style preference, or architectural detail to the active project.",
        inputSchema: {
          type: 'object',
          properties: {
            fact: {
              type: 'string',
              description: 'The core fact, architectural rule, style standard, or decision to remember (e.g. "We use TypeScript and standard ESM for our Node.js services").'
            },
            category: {
              type: 'string',
              description: 'The category for organizing the memory. Must match one of the active categories.'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'A list of tags for search categorization (e.g. ["typescript", "postgres", "eslint"]).'
            }
          },
          required: ['fact', 'category']
        }
      },
      {
        name: 'search_memories',
        description: "Search the active project's persistent memories for relevant facts, rules, and architecture details using keywords.",
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to match against memories, categories, or tags.'
            },
            category: {
              type: 'string',
              description: 'Filter memories by category.'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'list_memories',
        description: "List all persistent memories saved in the active project, optionally filtered by category.",
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Optional category filter to restrict listed memories.'
            }
          }
        }
      },
      {
        name: 'update_memory',
        description: "Update an existing project memory by providing its unique memory ID.",
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The unique ID of the memory to update.'
            },
            fact: {
              type: 'string',
              description: 'The updated fact content.'
            },
            category: {
              type: 'string',
              description: 'The updated category.'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'The updated list of tags.'
            }
          },
          required: ['id', 'fact']
        }
      },
      {
        name: 'delete_memory',
        description: "Permanently delete a persistent memory by its unique ID.",
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The unique ID of the memory to delete.'
            }
          },
          required: ['id']
        }
      },
      {
        name: 'get_project_context',
        description: "Retrieve high-level project summary context including tech stack, key rules, and structural architecture notes.",
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'update_project_context',
        description: "Update high-level metadata (such as overall tech stack, key rules/standards, and architecture overview) for the active project.",
        inputSchema: {
          type: 'object',
          properties: {
            tech_stack: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of core languages, frameworks, or databases in use (e.g. ["Next.js", "Neon Postgres", "Tailwind"]).'
            },
            key_rules: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of crucial coding styles or working agreements (e.g. "Write descriptive title tags for SEO", "Never run destructive commands").'
            },
            architecture_notes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Key insights regarding architecture or folder organization.'
            },
            categories: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of custom category names for organizing memories (e.g. ["architecture", "performance", "todo"]).'
            }
          }
        }
      },
      {
        name: 'list_categories',
        description: "List all active, custom-defined taxonomies/categories for organizing memories in the active project.",
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

// Implement tool execution logic
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const db = await loadMemory();

  try {
    switch (name) {
      case 'add_memory': {
        const { fact, category = 'general', tags = [] } = args;
        const activeCategories = db.project_context.categories || ['general', 'style-guide', 'architecture', 'todo', 'database'];
        const cleanCategory = category.toLowerCase().trim();

        if (!activeCategories.includes(cleanCategory)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: The category "${category}" is not in the project's master categories list.\n\nActive Categories:\n${activeCategories.map(c => `- ${c}`).join('\n')}\n\nTo add memories under a new category, first add it using update_project_context.`
              }
            ],
            isError: true
          };
        }

        const newMemory = {
          id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          fact,
          category: cleanCategory,
          tags: tags.map(t => t.toLowerCase().trim()).filter(Boolean),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        db.memories.push(newMemory);
        await saveMemory(db);
        console.error(`[Project Memory] Added memory: ${newMemory.id}`);

        return {
          content: [
            {
              type: 'text',
              text: `Memory successfully added to project!\n\nID: ${newMemory.id}\nCategory: ${newMemory.category}\nFact: "${newMemory.fact}"`
            }
          ]
        };
      }

      case 'search_memories': {
        const { query, category } = args;
        const queryLower = query.toLowerCase();

        const results = db.memories.filter(m => {
          const matchQuery = 
            m.fact.toLowerCase().includes(queryLower) ||
            m.category.toLowerCase().includes(queryLower) ||
            m.tags.some(t => t.toLowerCase().includes(queryLower));
          
          const matchCategory = !category || m.category === category.toLowerCase().trim();
          return matchQuery && matchCategory;
        });

        console.error(`[Project Memory] Search query "${query}" returned ${results.length} results.`);

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: 'No matching memories found.' }]
          };
        }

        const formatted = results
          .map(r => `[ID: ${r.id}] (${r.category}) ${r.fact} (Tags: ${r.tags.join(', ')})`)
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${results.length} project memory matching "${query}":\n\n${formatted}`
            }
          ]
        };
      }

      case 'list_memories': {
        const { category } = args;
        const filtered = category
          ? db.memories.filter(m => m.category === category.toLowerCase().trim())
          : db.memories;

        console.error(`[Project Memory] Listed ${filtered.length} memories.`);

        if (filtered.length === 0) {
          return {
            content: [{ type: 'text', text: 'No memories found.' }]
          };
        }

        const formatted = filtered
          .map(r => `[ID: ${r.id}] (${r.category}) ${r.fact} (Tags: ${r.tags.join(', ')})`)
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Active project has ${filtered.length} memories stored:\n\n${formatted}`
            }
          ]
        };
      }

      case 'update_memory': {
        const { id, fact, category, tags } = args;
        const index = db.memories.findIndex(m => m.id === id);

        if (index === -1) {
          return {
            content: [{ type: 'text', text: `Error: Memory with ID "${id}" was not found in this project.` }],
            isError: true
          };
        }

        if (category) {
          const activeCategories = db.project_context.categories || ['general', 'style-guide', 'architecture', 'todo', 'database'];
          const cleanCategory = category.toLowerCase().trim();
          if (!activeCategories.includes(cleanCategory)) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: The category "${category}" is not in the project's master categories list.\n\nActive Categories:\n${activeCategories.map(c => `- ${c}`).join('\n')}`
                }
              ],
              isError: true
            };
          }
          db.memories[index].category = cleanCategory;
        }

        db.memories[index].fact = fact;
        if (tags) {
          db.memories[index].tags = tags.map(t => t.toLowerCase().trim()).filter(Boolean);
        }
        db.memories[index].updated_at = new Date().toISOString();

        await saveMemory(db);
        console.error(`[Project Memory] Updated memory: ${id}`);

        return {
          content: [
            {
              type: 'text',
              text: `Memory updated successfully!\n\nID: ${id}\nUpdated Fact: "${fact}"`
            }
          ]
        };
      }

      case 'delete_memory': {
        const { id } = args;
        const initialCount = db.memories.length;
        db.memories = db.memories.filter(m => m.id !== id);

        if (db.memories.length === initialCount) {
          return {
            content: [{ type: 'text', text: `Error: Memory with ID "${id}" was not found.` }],
            isError: true
          };
        }

        await saveMemory(db);
        console.error(`[Project Memory] Deleted memory: ${id}`);

        return {
          content: [{ type: 'text', text: `Memory with ID "${id}" has been permanently deleted.` }]
        };
      }

      case 'get_project_context': {
        const ctx = db.project_context;
        const formattedTech = ctx.tech_stack.length > 0 ? ctx.tech_stack.join(', ') : 'None specified';
        const formattedRules = ctx.key_rules.length > 0 ? ctx.key_rules.map(r => `- ${r}`).join('\n') : 'None specified';
        const formattedArch = ctx.architecture_notes.length > 0 ? ctx.architecture_notes.map(a => `- ${a}`).join('\n') : 'None specified';
        const formattedCats = ctx.categories.join(', ');

        return {
          content: [
            {
              type: 'text',
              text: `# Project Overview Context\n\n**Tech Stack:** ${formattedTech}\n\n**Coding Rules & Guidelines:**\n${formattedRules}\n\n**Architecture & Folder Structure Notes:**\n${formattedArch}\n\n**Master Memory Categories:** ${formattedCats}`
            }
          ]
        };
      }

      case 'update_project_context': {
        const { tech_stack, key_rules, architecture_notes, categories } = args;

        if (tech_stack) db.project_context.tech_stack = tech_stack;
        if (key_rules) db.project_context.key_rules = key_rules;
        if (architecture_notes) db.project_context.architecture_notes = architecture_notes;
        
        if (categories) {
          const processed = categories.map(c => c.toLowerCase().trim()).filter(Boolean);
          if (!processed.includes('general')) {
            processed.unshift('general');
          }
          db.project_context.categories = processed;

          // Orphan cascade mapping: re-assign deleted categories to 'general'
          db.memories.forEach(m => {
            if (!processed.includes(m.category)) {
              console.error(`[Project Memory] Category "${m.category}" deleted. Re-mapping memory "${m.id}" to "general".`);
              m.category = 'general';
            }
          });
        }

        await saveMemory(db);
        console.error(`[Project Memory] Updated project high-level context.`);

        return {
          content: [{ type: 'text', text: `Project high-level context successfully updated!` }]
        };
      }

      case 'list_categories': {
        const categories = db.project_context.categories || ['general', 'style-guide', 'architecture', 'todo', 'database'];
        return {
          content: [
            {
              type: 'text',
              text: `Project Master Categories List:\n\n${categories.map(c => `- ${c}`).join('\n')}`
            }
          ]
        };
      }

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (err) {
    console.error(`[Project Memory] Tool error in "${name}":`, err);
    return {
      content: [{ type: 'text', text: `Error executing tool: ${err.message}` }],
      isError: true
    };
  }
});

// Run server using stdio transport
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[Project Memory] Server fully initialized and listening on stdio scoping directory: ${projectDir}`);
}

run().catch((err) => {
  console.error('[Project Memory] CRITICAL: Server crashed during initialization:', err);
  process.exit(1);
});
