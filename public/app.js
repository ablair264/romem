// ==========================================================================
// PROJECT MEMORY CENTER CLIENT ENGINE
// ==========================================================================

// --- App State ---
let state = {
  project_name: 'Loading...',
  project_path: 'Loading path...',
  memories: [],
  project_context: {
    tech_stack: [],
    key_rules: [],
    architecture_notes: []
  },
  filters: {
    search: '',
    category: 'all',
    tag: null
  },
  isContextDirty: false
};

// --- DOM References ---
const elActiveProjectName = document.getElementById('active-project-name');
const elActiveProjectPath = document.getElementById('active-project-path');
const elStatMemories = document.getElementById('stat-memories');
const elStatCategories = document.getElementById('stat-categories');
const elStatTags = document.getElementById('stat-tags');

const elSearchInput = document.getElementById('search-input');
const elCategoryTabs = document.getElementById('category-tabs-container');
const elTagCloud = document.getElementById('tag-cloud-container');
const elMemoriesGrid = document.getElementById('memories-grid');
const elEmptyState = document.getElementById('empty-state-view');
const elFilterStatusText = document.getElementById('filter-status-text');

// Form References
const elAddMemoryForm = document.getElementById('add-memory-form');
const elNewFact = document.getElementById('new-fact');
const elNewCategory = document.getElementById('new-category');
const elNewTags = document.getElementById('new-tags');

// Project Context References
const elSaveContextBtn = document.getElementById('save-context-btn');
const elTechBadgeContainer = document.getElementById('tech-badge-container');
const elTechStackInput = document.getElementById('tech-stack-input');
const elRulesChecklist = document.getElementById('rules-checklist');
const elRulesInput = document.getElementById('rules-input');
const elAddRuleBtn = document.getElementById('add-rule-btn');
const elArchitectureChecklist = document.getElementById('architecture-checklist');
const elArchitectureInput = document.getElementById('architecture-input');
const elAddArchitectureBtn = document.getElementById('add-architecture-btn');

// Modal References
const elEditModal = document.getElementById('edit-modal');
const elEditMemoryForm = document.getElementById('edit-memory-form');
const elEditId = document.getElementById('edit-id');
const elEditFact = document.getElementById('edit-fact');
const elEditCategory = document.getElementById('edit-category');
const elEditTags = document.getElementById('edit-tags');
const elCloseModalBtn = document.getElementById('close-modal-btn');
const elCancelModalBtn = document.getElementById('cancel-modal-btn');

// Toast Reference
const elToast = document.getElementById('toast');
const elToastIcon = document.getElementById('toast-icon');
const elToastMessage = document.getElementById('toast-message');

// --- Helper: Toast Notifications ---
function showToast(message, type = 'info') {
  elToastMessage.textContent = message;
  
  // Set classes
  elToast.className = 'toast-notification active ' + type;
  
  // Update icons dynamically
  if (type === 'success') {
    elToastIcon.setAttribute('data-lucide', 'check-circle-2');
  } else if (type === 'error') {
    elToastIcon.setAttribute('data-lucide', 'alert-triangle');
  } else {
    elToastIcon.setAttribute('data-lucide', 'info');
  }
  
  lucide.createIcons();

  // Auto hide
  setTimeout(() => {
    elToast.classList.remove('active');
  }, 3500);
}

// --- API Client Interactions ---

// Load Dashboard Metadata & Stats
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    
    state.project_name = data.project_name;
    state.project_path = data.project_path;
    
    elActiveProjectName.textContent = data.project_name;
    elActiveProjectPath.textContent = data.project_path;
    
    elStatMemories.textContent = data.stats.memories_count;
    elStatCategories.textContent = data.stats.categories_count;
    elStatTags.textContent = data.stats.tags_count;
  } catch (err) {
    showToast('Failed to connect to backend server metadata.', 'error');
  }
}

// Load Memories Data
async function fetchMemories() {
  try {
    const res = await fetch('/api/memories');
    const data = await res.json();
    state.memories = data.memories || [];
    renderFilters();
    renderMemories();
  } catch (err) {
    showToast('Failed to fetch stored memory blocks.', 'error');
  }
}

// Load Context Data
async function fetchContext() {
  try {
    const res = await fetch('/api/context');
    const data = await res.json();
    state.project_context = data.project_context || {
      tech_stack: [],
      key_rules: [],
      architecture_notes: []
    };
    renderContext();
  } catch (err) {
    showToast('Failed to fetch project context guidelines.', 'error');
  }
}

// Save Context Data
async function saveContext() {
  try {
    const res = await fetch('/api/context', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.project_context)
    });
    
    if (res.ok) {
      state.isContextDirty = false;
      elSaveContextBtn.classList.remove('dirty');
      showToast('Project context successfully synced to disk!', 'success');
      fetchStatus();
    } else {
      throw new Error('Failed to update context');
    }
  } catch (err) {
    showToast('Could not save high-level context changes.', 'error');
  }
}

// --- Render Functions ---

// Render Filters Sidebar (Category lists and Tag Cloud)
function renderFilters() {
  // Extract all categories and tag counts
  const categories = {};
  const tags = {};
  
  state.memories.forEach(m => {
    categories[m.category] = (categories[m.category] || 0) + 1;
    m.tags.forEach(t => {
      tags[t] = (tags[t] || 0) + 1;
    });
  });

  // Render Categories Tabs
  const totalCount = state.memories.length;
  let categoryTabsHtml = `<button class="cat-tab ${state.filters.category === 'all' ? 'active' : ''}" data-category="all" data-count="${totalCount}">All Memories</button>`;
  
  // Hardcoded standard categories order for aesthetics, plus any dynamic ones
  const standardCategories = ['general', 'architecture', 'style-guide', 'database', 'todo', 'preference'];
  const allCurrentCategories = Array.from(new Set([...standardCategories, ...Object.keys(categories)]));

  allCurrentCategories.forEach(cat => {
    const count = categories[cat] || 0;
    // Only show standard categories or categories with items
    if (count > 0 || standardCategories.includes(cat)) {
      const label = cat.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
      categoryTabsHtml += `<button class="cat-tab ${state.filters.category === cat ? 'active' : ''}" data-category="${cat}" data-count="${count}">${label}</button>`;
    }
  });
  elCategoryTabs.innerHTML = categoryTabsHtml;

  // Render Tag Cloud
  const sortedTags = Object.keys(tags).sort((a, b) => tags[b] - tags[a]);
  let tagCloudHtml = '';
  
  if (sortedTags.length === 0) {
    tagCloudHtml = '<span class="label-helper">No tags indexed yet</span>';
  } else {
    sortedTags.forEach(tag => {
      const activeClass = state.filters.tag === tag ? 'active' : '';
      tagCloudHtml += `<span class="cloud-tag ${activeClass}" data-tag="${tag}">${tag} <span style="opacity: 0.6; font-size: 9px;">(${tags[tag]})</span></span>`;
    });
  }
  elTagCloud.innerHTML = tagCloudHtml;

  // Re-bind click events
  document.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filters.category = btn.getAttribute('data-category');
      state.filters.tag = null; // Clear tag filter when switching categories
      renderFilters();
      renderMemories();
    });
  });

  document.querySelectorAll('.cloud-tag').forEach(span => {
    span.addEventListener('click', () => {
      const tag = span.getAttribute('data-tag');
      state.filters.tag = state.filters.tag === tag ? null : tag; // toggle
      renderFilters();
      renderMemories();
    });
  });
}

// Render Memories Grid
function renderMemories() {
  const query = state.filters.search.toLowerCase().trim();
  const category = state.filters.category;
  const activeTag = state.filters.tag;

  // Apply filters
  const filtered = state.memories.filter(m => {
    // Search query filter
    const matchesSearch = !query || 
      m.fact.toLowerCase().includes(query) || 
      m.category.toLowerCase().includes(query) || 
      m.tags.some(t => t.toLowerCase().includes(query));

    // Category filter
    const matchesCategory = category === 'all' || m.category === category;

    // Tag filter
    const matchesTag = !activeTag || m.tags.includes(activeTag);

    return matchesSearch && matchesCategory && matchesTag;
  });

  // Update Filters Indicator Text
  let filterText = `Showing ${filtered.length} of ${state.memories.length} memories`;
  if (category !== 'all' || activeTag || query) {
    const filtersUsed = [];
    if (category !== 'all') filtersUsed.push(`Category: ${category}`);
    if (activeTag) filtersUsed.push(`Tag: #${activeTag}`);
    if (query) filtersUsed.push(`Search: "${query}"`);
    filterText += ` • Filtered by (${filtersUsed.join(', ')})`;
  }
  elFilterStatusText.textContent = filterText;

  // Clear Grid
  elMemoriesGrid.querySelectorAll('.memory-card').forEach(el => el.remove());

  if (filtered.length === 0) {
    elEmptyState.style.display = 'flex';
  } else {
    elEmptyState.style.display = 'none';

    filtered.forEach(m => {
      const card = document.createElement('article');
      card.className = 'memory-card glass-card';
      card.setAttribute('data-id', m.id);

      const categoryLabel = m.category.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
      const dateText = new Date(m.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      const tagsHtml = m.tags.map(t => `<span class="card-tag">#${t}</span>`).join('');

      card.innerHTML = `
        <div class="memory-card-header">
          <span class="category-tag cat-${m.category}">${categoryLabel}</span>
          <div class="card-actions">
            <button class="btn-card-action act-edit" title="Edit memory"><i data-lucide="edit-2"></i></button>
            <button class="btn-card-action act-delete" title="Delete memory"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
        <p class="memory-fact">${escapeHtml(m.fact)}</p>
        <div class="memory-card-footer">
          <div class="card-tags">${tagsHtml}</div>
          <span class="card-date">${dateText}</span>
        </div>
      `;

      // Event Handlers for Card Action Buttons
      card.querySelector('.act-edit').addEventListener('click', () => openEditModal(m));
      card.querySelector('.act-delete').addEventListener('click', () => deleteMemory(m.id));

      elMemoriesGrid.appendChild(card);
    });
  }

  // Draw vector icons
  lucide.createIcons();
}

// Render Context Editor Panels
function renderContext() {
  // 1. Tech Stack Badges
  elTechBadgeContainer.innerHTML = '';
  if (state.project_context.tech_stack.length === 0) {
    elTechBadgeContainer.innerHTML = '<span class="label-helper">No technologies configured</span>';
  } else {
    state.project_context.tech_stack.forEach((tech, idx) => {
      const badge = document.createElement('span');
      badge.className = 'tech-badge';
      badge.innerHTML = `
        ${tech}
        <button class="remove-btn" data-index="${idx}"><i data-lucide="x"></i></button>
      `;
      badge.querySelector('.remove-btn').addEventListener('click', () => {
        state.project_context.tech_stack.splice(idx, 1);
        markContextDirty();
        renderContext();
      });
      elTechBadgeContainer.appendChild(badge);
    });
  }

  // 2. Key Coding Rules
  elRulesChecklist.innerHTML = '';
  if (state.project_context.key_rules.length === 0) {
    elRulesChecklist.innerHTML = '<li class="label-helper" style="padding: 10px;">No coding rules set</li>';
  } else {
    state.project_context.key_rules.forEach((rule, idx) => {
      const li = document.createElement('li');
      li.className = 'checklist-item';
      li.innerHTML = `
        <span class="checklist-text">${escapeHtml(rule)}</span>
        <button class="btn-remove-item" data-index="${idx}"><i data-lucide="trash-2"></i></button>
      `;
      li.querySelector('.btn-remove-item').addEventListener('click', () => {
        state.project_context.key_rules.splice(idx, 1);
        markContextDirty();
        renderContext();
      });
      elRulesChecklist.appendChild(li);
    });
  }

  // 3. Architecture Notes
  elArchitectureChecklist.innerHTML = '';
  if (state.project_context.architecture_notes.length === 0) {
    elArchitectureChecklist.innerHTML = '<li class="label-helper" style="padding: 10px;">No architecture layouts mapped</li>';
  } else {
    state.project_context.architecture_notes.forEach((note, idx) => {
      const li = document.createElement('li');
      li.className = 'checklist-item';
      li.innerHTML = `
        <span class="checklist-text">${escapeHtml(note)}</span>
        <button class="btn-remove-item" data-index="${idx}"><i data-lucide="trash-2"></i></button>
      `;
      li.querySelector('.btn-remove-item').addEventListener('click', () => {
        state.project_context.architecture_notes.splice(idx, 1);
        markContextDirty();
        renderContext();
      });
      elArchitectureChecklist.appendChild(li);
    });
  }

  // Bind icons
  lucide.createIcons();
}

// Mark context state as unsaved
function markContextDirty() {
  state.isContextDirty = true;
  elSaveContextBtn.classList.add('dirty');
}

// --- Actions & Forms Submissions ---

// Create Fact Action
elAddMemoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const fact = elNewFact.value.trim();
  const category = elNewCategory.value;
  const tagsStr = elNewTags.value;
  const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);

  if (!fact) return;

  try {
    const res = await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact, category, tags })
    });
    
    if (res.ok) {
      showToast('Memory block added to local project database!', 'success');
      elAddMemoryForm.reset();
      
      // Refresh dashboard data
      await fetchStatus();
      await fetchMemories();
    } else {
      const data = await res.json();
      throw new Error(data.error || 'Server error');
    }
  } catch (err) {
    showToast(`Could not store memory: ${err.message}`, 'error');
  }
});

// Edit Memory Dialog Open
function openEditModal(m) {
  elEditId.value = m.id;
  elEditFact.value = m.fact;
  elEditCategory.value = m.category;
  elEditTags.value = m.tags.join(', ');
  
  elEditModal.classList.add('active');
}

// Edit Memory Form Submit
elEditMemoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = elEditId.value;
  const fact = elEditFact.value.trim();
  const category = elEditCategory.value;
  const tags = elEditTags.value.split(',').map(t => t.trim()).filter(Boolean);

  try {
    const res = await fetch('/api/memories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, fact, category, tags })
    });

    if (res.ok) {
      showToast('Memory block successfully updated!', 'success');
      elEditModal.classList.remove('active');
      
      await fetchStatus();
      await fetchMemories();
    } else {
      throw new Error('Update failed');
    }
  } catch (err) {
    showToast('Failed to update details.', 'error');
  }
});

// Close Modals
elCloseModalBtn.addEventListener('click', () => elEditModal.classList.remove('active'));
elCancelModalBtn.addEventListener('click', () => elEditModal.classList.remove('active'));
window.addEventListener('click', (e) => {
  if (e.target === elEditModal) elEditModal.classList.remove('active');
});

// Delete Memory Action
async function deleteMemory(id) {
  if (!confirm('Are you sure you want to permanently delete this memory fact?')) return;

  try {
    const res = await fetch(`/api/memories?id=${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast('Memory block permanently deleted.', 'success');
      
      // Animate card removal
      const card = elMemoriesGrid.querySelector(`.memory-card[data-id="${id}"]`);
      if (card) {
        card.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9) translateY(10px)';
        setTimeout(async () => {
          await fetchStatus();
          await fetchMemories();
        }, 300);
      } else {
        await fetchStatus();
        await fetchMemories();
      }
    } else {
      throw new Error('Delete failed');
    }
  } catch (err) {
    showToast('Failed to delete memory block.', 'error');
  }
}

// --- Context Add Inputs Actions ---

// 1. Add technology tag
elTechStackInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = elTechStackInput.value.trim();
    if (val && !state.project_context.tech_stack.includes(val)) {
      state.project_context.tech_stack.push(val);
      elTechStackInput.value = '';
      markContextDirty();
      renderContext();
    }
  }
});

// 2. Add checklist coding rule
function handleAddRule() {
  const val = elRulesInput.value.trim();
  if (val) {
    state.project_context.key_rules.push(val);
    elRulesInput.value = '';
    markContextDirty();
    renderContext();
  }
}
elAddRuleBtn.addEventListener('click', handleAddRule);
elRulesInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleAddRule();
  }
});

// 3. Add architecture folder note
function handleAddArchitecture() {
  const val = elArchitectureInput.value.trim();
  if (val) {
    state.project_context.architecture_notes.push(val);
    elArchitectureInput.value = '';
    markContextDirty();
    renderContext();
  }
}
elAddArchitectureBtn.addEventListener('click', handleAddArchitecture);
elArchitectureInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleAddArchitecture();
  }
});

// Save all context button
elSaveContextBtn.addEventListener('click', saveContext);

// --- Search Filter Keypresses ---
elSearchInput.addEventListener('input', (e) => {
  state.filters.search = e.target.value;
  renderMemories();
});

// --- Utility Functions ---
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Init Loader ---
async function init() {
  await fetchStatus();
  await fetchMemories();
  await fetchContext();
}

// Boot Client
init();
