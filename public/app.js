// ==========================================================================
// PROJECT MEMORY CENTER CLIENT ENGINE
// ==========================================================================

// ========== CUSTOM DROPDOWN COMPONENT ==========
class CustomDropdown {
  constructor(mountEl, { items = [], value = null, allowCreate = false, onSelect, onCreateItem } = {}) {
    this.mount = mountEl;
    this.items = items;
    this.value = value;
    this.allowCreate = allowCreate;
    this.onSelect = onSelect || (() => {});
    this.onCreateItem = onCreateItem || (() => {});
    this.isOpen = false;
    if (!CustomDropdown._instances) CustomDropdown._instances = [];
    CustomDropdown._instances.push(this);
    if (!CustomDropdown._outsideHandler) {
      CustomDropdown._outsideHandler = (e) => {
        CustomDropdown._instances.forEach(d => {
          if (d.isOpen && !d.mount.contains(e.target)) d.close();
        });
      };
      document.addEventListener('click', CustomDropdown._outsideHandler);
    }
    this._render();
  }

  _label(val) {
    const item = this.items.find(i => i.value === val);
    return item ? item.label : (val ? val.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Select…');
  }

  _render() {
    this.mount.innerHTML = `
      <div class="custom-select${this.isOpen ? ' open' : ''}">
        <button type="button" class="select-trigger">
          <span>${this._label(this.value)}</span>
          <i data-lucide="chevron-down" class="select-chevron"></i>
        </button>
        <div class="select-panel">
          ${this.items.map(item => `
            <button type="button" class="select-option${item.value === this.value ? ' selected' : ''}" data-value="${item.value}">
              ${item.label}
              ${item.value === this.value ? '<i data-lucide="check" class="select-check"></i>' : ''}
            </button>
          `).join('')}
          ${this.allowCreate ? '<div class="select-create-slot"></div>' : ''}
        </div>
      </div>
    `;
    this.el = this.mount.querySelector('.custom-select');
    this.el.querySelector('.select-trigger').addEventListener('click', (e) => {
      e.stopPropagation();
      this.isOpen ? this.close() : this.open();
    });
    this.el.querySelectorAll('.select-option').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.select(btn.dataset.value); });
    });
    lucide.createIcons({ nodes: [this.mount] });
  }

  open()  { this.isOpen = true;  this.el.classList.add('open'); }
  close() { this.isOpen = false; this.el.classList.remove('open'); }

  select(val) {
    this.value = val;
    this.onSelect(val);
    this._render();
  }

  getValue() { return this.value; }

  setItems(items) {
    this.items = items;
    const wasOpen = this.isOpen;
    this._render();
    if (wasOpen) this.open();
  }

  showCreateOption(label, val) {
    const slot = this.el ? this.el.querySelector('.select-create-slot') : null;
    if (!slot) return;
    if (!label) { slot.innerHTML = ''; return; }
    slot.innerHTML = `
      <button type="button" class="select-create-option" data-create="${val}">
        <i data-lucide="plus-circle"></i> Create "${label}" category
      </button>
    `;
    slot.querySelector('.select-create-option').addEventListener('click', (e) => {
      e.stopPropagation();
      this.onCreateItem(val);
      this.close();
    });
    lucide.createIcons({ nodes: [slot] });
  }
}

// --- Category icon mapping ---
const CATEGORY_ICONS = {
  'all': 'layers',
  'general': 'circle',
  'architecture': 'git-branch',
  'style-guide': 'palette',
  'database': 'database',
  'todo': 'check-square',
  'preference': 'heart',
};
function getCategoryIcon(cat) { return CATEGORY_ICONS[cat] || 'tag'; }

// --- App State ---
let state = {
  project_name: 'Loading...',
  project_path: 'Loading path...',
  memories: [],
  project_context: {
    tech_stack: [],
    key_rules: [],
    architecture_notes: [],
    categories: ['general', 'style-guide', 'architecture', 'todo', 'database']
  },
  filters: {
    search: '',
    category: 'all',
    tag: null
  },
  isContextDirty: false,
  sortOrder: localStorage.getItem('memory-sort') || 'newest',
  drawerOpen: false,
  activeTab: 'memories', // 'memories' or 'CLAUDE.md' / 'AGENTS.md' / 'GEMINI.md'
  mdFiles: {},           // Local cache for markdown content
  isMdDirty: false,      // Markdown dirty state
  groqKey: localStorage.getItem('groq-api-key') || ''
};

// --- DOM References ---
const elActiveProjectName = document.getElementById('active-project-name');
const elActiveProjectPath = document.getElementById('active-project-path');
const elHeaderTitle = document.getElementById('header-title');

const elSearchInput = document.getElementById('search-input');
const elSidebarNav = document.getElementById('sidebar-nav');
const elTagCloud = document.getElementById('tag-cloud-container');
const elMemoriesGrid = document.getElementById('memories-grid');
const elEmptyState = document.getElementById('empty-state-view');
const elFilterStatusText = document.getElementById('filter-status-text');

// Form References
const elAddMemoryForm = document.getElementById('add-memory-form');
const elNewFact = document.getElementById('new-fact');
const elNewTags = document.getElementById('new-tags');

// Project Context References
const elTechBadgeContainer = document.getElementById('tech-badge-container');
const elTechStackInput = document.getElementById('tech-stack-input');
const elRulesChecklist = document.getElementById('rules-checklist');
const elRulesInput = document.getElementById('rules-input');
const elAddRuleBtn = document.getElementById('add-rule-btn');
const elArchitectureChecklist = document.getElementById('architecture-checklist');
const elArchitectureInput = document.getElementById('architecture-input');
const elAddArchitectureBtn = document.getElementById('add-architecture-btn');

// Category Management DOM References
const elCategoryChips = document.getElementById('category-chips-container');
const elCategoryInput = document.getElementById('category-input');
const elAddCategoryBtn = document.getElementById('add-category-btn');

// Autosave DOM References
const elAutosaveIndicator = document.getElementById('autosave-indicator');
const elAutosaveIcon = document.getElementById('autosave-icon');
const elAutosaveText = document.getElementById('autosave-text');

// Undo Toast DOM References
const elUndoToast = document.getElementById('undo-toast');
const elUndoToastMessage = document.getElementById('undo-toast-message');
const elUndoToastBtn = document.getElementById('undo-toast-btn');
const elUndoProgressFill = document.getElementById('undo-progress-fill');

// Bulk DOM References
const elBulkSelectToggle = document.getElementById('bulk-select-toggle');
const elBulkToolbar = document.getElementById('bulk-toolbar');
const elBulkCount = document.getElementById('bulk-count');
const elBulkDeleteBtn = document.getElementById('bulk-delete-btn');
const elBulkCancelBtn = document.getElementById('bulk-cancel-btn');

// Sort DOM References
const elSortSelect = document.getElementById('sort-select');

// Modal References
const elEditModal = document.getElementById('edit-modal');
const elEditMemoryForm = document.getElementById('edit-memory-form');
const elEditId = document.getElementById('edit-id');
const elEditFact = document.getElementById('edit-fact');
const elEditTags = document.getElementById('edit-tags');
const elCloseModalBtn = document.getElementById('close-modal-btn');
const elCancelModalBtn = document.getElementById('cancel-modal-btn');

// Add Modal References
const elAddModal = document.getElementById('add-modal');
const elOpenAddModalBtn = document.getElementById('open-add-modal-btn');
const elCloseAddModalBtn = document.getElementById('close-add-modal-btn');
const elCancelAddModalBtn = document.getElementById('cancel-add-modal-btn');

// Drawer References
const elContextDrawer = document.getElementById('context-drawer');
const elDrawerOverlay = document.getElementById('drawer-overlay');
const elOpenSettingsBtn = document.getElementById('open-settings-btn');
const elCloseDrawerBtn = document.getElementById('close-drawer-btn');

// Toast Reference
const elToast = document.getElementById('toast');
const elToastIcon = document.getElementById('toast-icon');
const elToastMessage = document.getElementById('toast-message');

// Markdown & AI Drawer DOM References
const elMdEditorPanel = document.getElementById('md-editor-panel');
const elActiveMdFilename = document.getElementById('active-md-filename');
const elMdStatusIndicator = document.getElementById('md-status-indicator');
const elSaveMdBtn = document.getElementById('save-md-btn');
const elMdTextarea = document.getElementById('md-textarea');
const elMdPreview = document.getElementById('md-preview');
const elAiConsoleDrawer = document.getElementById('ai-console-drawer');
const elCloseAiConsoleBtn = document.getElementById('close-ai-console-btn');
const elAiOptimizeBtn = document.getElementById('ai-optimize-btn');
const elBtnAiDuplicates = document.getElementById('btn-ai-duplicates');
const elBtnAiPrune = document.getElementById('btn-ai-prune');
const elBtnAiClassify = document.getElementById('btn-ai-classify');
const elBtnAiSync = document.getElementById('btn-ai-sync');
const elConsoleTerminal = document.getElementById('console-terminal');
const elTerminalContent = document.getElementById('terminal-content');
const elConsoleFooter = document.getElementById('console-footer');
const elCancelConsoleChanges = document.getElementById('cancel-console-changes');
const elApplyConsoleChanges = document.getElementById('apply-console-changes');
const elGroqApiKey = document.getElementById('groq-api-key');

// --- Dropdowns state & pending deletions maps ---
let addFormDropdown = null;
let editFormDropdown = null;
let bulkCategoryDropdown = null;
const pendingDeletes = new Map();

// --- Bulk Selection state ---
let bulkMode = false;
const selectedIds = new Set();

function getCategoryItems() {
  const cats = state.project_context.categories || ['general', 'style-guide', 'architecture', 'todo', 'database'];
  return cats.map(c => ({ value: c, label: c.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()) }));
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function setAutosaveState(s) {
  if (!elAutosaveIndicator) return;
  elAutosaveIndicator.className = 'autosave-indicator ' + s;
  const icons = { unsaved: 'circle-dot', saving: 'loader-2', saved: 'check-circle-2', error: 'alert-circle' };
  const texts = { unsaved: 'Unsaved changes', saving: 'Saving…', saved: 'Saved', error: 'Save failed' };
  elAutosaveIcon.setAttribute('data-lucide', icons[s] || 'circle-dot');
  elAutosaveText.textContent = texts[s] || '';
  lucide.createIcons({ nodes: [elAutosaveIndicator] });
}

const debouncedAutoSave = debounce(async () => {
  setAutosaveState('saving');
  try {
    const res = await fetch('/api/context', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.project_context)
    });
    if (res.ok) {
      setAutosaveState('saved');
      await fetchStatus();
    } else {
      throw new Error();
    }
  } catch {
    setAutosaveState('error');
  }
}, 2000);

function showUndoToast(ids, snapshots, message) {
  if (!elUndoToast) return;
  elUndoToastMessage.textContent = message;
  elUndoToast.classList.add('active');
  elUndoProgressFill.style.transition = 'none';
  elUndoProgressFill.style.transform = 'scaleX(1)';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    elUndoProgressFill.style.transition = 'transform 5s linear';
    elUndoProgressFill.style.transform = 'scaleX(0)';
  }));

  const timeoutId = setTimeout(async () => {
    ids.forEach(id => pendingDeletes.delete(id));
    elUndoToast.classList.remove('active');
    try {
      await Promise.all(ids.map(id => fetch(`/api/memories?id=${id}`, { method: 'DELETE' })));
      await fetchStatus();
    } catch {
      showToast('Delete failed — memory may still exist.', 'error');
    }
  }, 5000);

  ids.forEach((id, i) => pendingDeletes.set(id, { memory: snapshots[i], timeoutId }));
}

// Bind Undo action
if (elUndoToastBtn) {
  elUndoToastBtn.addEventListener('click', () => {
    pendingDeletes.forEach(({ memory, timeoutId }) => {
      clearTimeout(timeoutId);
      state.memories.push(memory);
    });
    pendingDeletes.clear();
    elUndoToast.classList.remove('active');
    state.memories.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    renderMemories();
    renderFilters();
    showToast('Delete undone.', 'success');
  });
}

// --- Helper: Toast Notifications ---
function showToast(message, type = 'info') {
  elToastMessage.textContent = message;
  elToast.className = 'toast active ' + type;

  if (type === 'success') {
    elToastIcon.setAttribute('data-lucide', 'check-circle-2');
  } else if (type === 'error') {
    elToastIcon.setAttribute('data-lucide', 'alert-triangle');
  } else {
    elToastIcon.setAttribute('data-lucide', 'info');
  }

  lucide.createIcons();
  setTimeout(() => { elToast.classList.remove('active'); }, 3500);
}

// --- API Client Interactions ---

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.project_name = data.project_name;
    state.project_path = data.project_path;
    state.stats = {
      memories_count: data.stats.memories_count,
      categories_count: data.stats.categories_count,
      tags_count: data.stats.tags_count
    };
    if (elActiveProjectName) elActiveProjectName.textContent = data.project_name;
    if (elActiveProjectPath) elActiveProjectPath.textContent = data.project_path;
  } catch (err) {
    showToast('Failed to connect to backend server metadata.', 'error');
  }
}

async function fetchMemories() {
  try {
    const res = await fetch('/api/memories');
    const data = await res.json();
    state.memories = data.memories || [];
    renderFilters();
    renderMemories();
    refreshTagsDatalist();
  } catch (err) {
    showToast('Failed to fetch stored memory blocks.', 'error');
  }
}

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

async function saveContext() {
  try {
    const res = await fetch('/api/context', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.project_context)
    });
    if (res.ok) {
      state.isContextDirty = false;
      if (elAutosaveIndicator) setAutosaveState('saved');
      showToast('Project context successfully synced to disk!', 'success');
      await fetchStatus();
    } else {
      throw new Error('Failed to update context');
    }
  } catch (err) {
    showToast('Could not save high-level context changes.', 'error');
  }
}

// --- Drawer open/close ---
function openDrawer() {
  elContextDrawer.classList.add('open');
  elDrawerOverlay.classList.add('active');
  state.drawerOpen = true;
}
function closeDrawer() {
  elContextDrawer.classList.remove('open');
  elDrawerOverlay.classList.remove('active');
  state.drawerOpen = false;
}

// --- Add Memory Modal ---
function openAddModal() {
  elAddModal.classList.add('active');
}
function closeAddModal() {
  elAddModal.classList.remove('active');
}

// --- Render Functions ---

function renderSidebarNav() {
  if (!elSidebarNav) return;

  const categories = {};
  state.memories.forEach(m => {
    categories[m.category] = (categories[m.category] || 0) + 1;
  });

  const totalCount = state.memories.length;
  const contextCats = state.project_context.categories || [];
  const allCats = Array.from(new Set([...contextCats, ...Object.keys(categories)]));

  let html = '';
  // "All Memories" always first
  html += `<button class="nav-item${state.filters.category === 'all' ? ' active' : ''}" data-category="all">
    <i data-lucide="${getCategoryIcon('all')}"></i>
    <span class="nav-label">All Memories</span>
    <span class="nav-count">${totalCount}</span>
  </button>`;

  allCats.forEach(cat => {
    const count = categories[cat] || 0;
    if (count > 0 || contextCats.includes(cat)) {
      const label = cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      html += `<button class="nav-item${state.filters.category === cat ? ' active' : ''}" data-category="${cat}">
        <i data-lucide="${getCategoryIcon(cat)}"></i>
        <span class="nav-label">${label}</span>
        <span class="nav-count">${count}</span>
      </button>`;
    }
  });

  elSidebarNav.innerHTML = html;

  // Bind click events
  elSidebarNav.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filters.category = btn.getAttribute('data-category');
      state.filters.tag = null;
      switchView('memories');
      renderSidebarNav();
      renderMemories();
      renderTagCloud();
    });
  });

  lucide.createIcons({ nodes: [elSidebarNav] });
}

function renderTagCloud() {
  if (!elTagCloud) return;

  const tags = {};
  state.memories.forEach(m => {
    m.tags.forEach(t => { tags[t] = (tags[t] || 0) + 1; });
  });

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

  // Bind click events
  document.querySelectorAll('.cloud-tag').forEach(span => {
    span.addEventListener('click', () => {
      const tag = span.getAttribute('data-tag');
      state.filters.tag = state.filters.tag === tag ? null : tag;
      switchView('memories');
      renderTagCloud();
      renderMemories();
    });
  });
}

function renderFilters() {
  renderSidebarNav();
  renderTagCloud();
}

function refreshTagsDatalist() {
  const elTagsDatalist = document.getElementById('tags-datalist');
  if (!elTagsDatalist) return;
  const uniqueTags = new Set();
  state.memories.forEach(m => {
    if (m.tags && Array.isArray(m.tags)) {
      m.tags.forEach(tag => {
        if (tag.trim()) uniqueTags.add(tag.trim().toLowerCase());
      });
    }
  });
  elTagsDatalist.innerHTML = Array.from(uniqueTags)
    .sort()
    .map(tag => `<option value="${tag}"></option>`)
    .join('');
}

function renderCategoryChips() {
  if (!elCategoryChips) return;
  const cats = state.project_context.categories || [];
  elCategoryChips.innerHTML = '';
  cats.forEach(cat => {
    const chip = document.createElement('span');
    chip.className = 'category-chip' + (cat === 'general' ? ' protected' : '');
    const label = cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    chip.innerHTML = cat === 'general'
      ? label
      : `${label}<button type="button" class="category-chip-remove" title="Delete"><i data-lucide="x"></i></button>`;
    if (cat !== 'general') {
      chip.querySelector('.category-chip-remove').addEventListener('click', () => deleteCategory(cat));
    }
    elCategoryChips.appendChild(chip);
  });
  lucide.createIcons({ nodes: [elCategoryChips] });
}

async function addCategory(name) {
  const clean = name.toLowerCase().trim().replace(/\s+/g, '-');
  if (!clean) return;
  const cats = state.project_context.categories || [];
  if (cats.includes(clean)) {
    showToast(`Category "${clean}" already exists.`, 'info');
    return;
  }
  state.project_context.categories = [...cats, clean];
  markContextDirty();
  renderCategoryChips();
  const catItems = getCategoryItems();
  if (addFormDropdown) addFormDropdown.setItems(catItems);
  if (editFormDropdown) editFormDropdown.setItems(catItems);
  renderFilters();
}

async function deleteCategory(cat) {
  const count = state.memories.filter(m => m.category === cat).length;
  state.project_context.categories = state.project_context.categories.filter(c => c !== cat);
  state.memories.forEach(m => {
    if (m.category === cat) m.category = 'general';
  });
  markContextDirty();
  renderCategoryChips();
  const catItems = getCategoryItems();
  if (addFormDropdown) addFormDropdown.setItems(catItems);
  if (editFormDropdown) editFormDropdown.setItems(catItems);
  renderFilters();
  renderMemories();
  if (count > 0) {
    showToast(`"${cat}" deleted. ${count} memor${count === 1 ? 'y' : 'ies'} moved to General.`, 'info');
  }
}

function sortMemories(arr) {
  const s = [...arr];
  if (state.sortOrder === 'newest')   return s.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (state.sortOrder === 'oldest')   return s.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (state.sortOrder === 'category') return s.sort((a, b) => a.category.localeCompare(b.category));
  if (state.sortOrder === 'alpha')    return s.sort((a, b) => a.fact.localeCompare(b.fact));
  return s;
}

function updateBulkToolbar() {
  if (!elBulkCount || !elBulkToolbar) return;
  elBulkCount.textContent = `${selectedIds.size} selected`;
  elBulkToolbar.classList.toggle('active', selectedIds.size > 0);
}

function enterBulkMode() {
  bulkMode = true;
  selectedIds.clear();
  if (elBulkSelectToggle) {
    elBulkSelectToggle.classList.add('active');
  }
  elMemoriesGrid.classList.add('bulk-mode');
  updateBulkToolbar();
  bulkCategoryDropdown = new CustomDropdown(
    document.getElementById('mount-bulk-category'),
    { items: [{ value: '', label: 'Move to…' }, ...getCategoryItems()], value: '',
      onSelect: async (val) => { if (val && selectedIds.size > 0) await bulkRecategorize(val); }
    }
  );
}

function exitBulkMode() {
  bulkMode = false;
  selectedIds.clear();
  if (elBulkSelectToggle) {
    elBulkSelectToggle.classList.remove('active');
  }
  elMemoriesGrid.classList.remove('bulk-mode');
  elBulkToolbar.classList.remove('active');
  renderMemories();
}

async function bulkDelete() {
  if (selectedIds.size === 0) return;
  const ids = [...selectedIds];
  const snaps = ids.map(id => state.memories.find(m => m.id === id)).filter(Boolean);
  state.memories = state.memories.filter(m => !ids.includes(m.id));
  exitBulkMode();
  renderMemories();
  renderFilters();
  showUndoToast(ids, snaps, `${ids.length} memories deleted`);
}

async function bulkRecategorize(category) {
  const ids = [...selectedIds];
  try {
    await Promise.all(ids.map(id => {
      const mem = state.memories.find(m => m.id === id);
      return fetch('/api/memories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, fact: mem?.fact || '', category })
      });
    }));
    await fetchMemories();
    exitBulkMode();
    showToast(`${ids.length} memories moved to ${category}.`, 'success');
  } catch {
    showToast('Bulk move failed.', 'error');
  }
}

// Render Memories Grid
function renderMemories() {
  const query = state.filters.search.toLowerCase().trim();
  const category = state.filters.category;
  const activeTag = state.filters.tag;

  // Update header title
  if (elHeaderTitle) {
    elHeaderTitle.textContent = category === 'all'
      ? 'All Memories'
      : category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Apply filters
  const filtered = state.memories.filter(m => {
    const matchesSearch = !query ||
      m.fact.toLowerCase().includes(query) ||
      m.category.toLowerCase().includes(query) ||
      m.tags.some(t => t.toLowerCase().includes(query));
    const matchesCategory = category === 'all' || m.category === category;
    const matchesTag = !activeTag || m.tags.includes(activeTag);
    return matchesSearch && matchesCategory && matchesTag;
  });

  const sorted = sortMemories(filtered);

  // Update Filters Indicator Text
  let filterText = `${sorted.length} of ${state.memories.length} memories`;
  if (category !== 'all' || activeTag || query) {
    const filtersUsed = [];
    if (category !== 'all') filtersUsed.push(`Category: ${category}`);
    if (activeTag) filtersUsed.push(`Tag: #${activeTag}`);
    if (query) filtersUsed.push(`Search: "${query}"`);
    filterText += ` · ${filtersUsed.join(', ')}`;
  }
  elFilterStatusText.textContent = filterText;

  // Clear Grid
  elMemoriesGrid.querySelectorAll('.memory-card').forEach(el => el.remove());

  if (sorted.length === 0) {
    elEmptyState.style.display = 'flex';
  } else {
    elEmptyState.style.display = 'none';

    sorted.forEach((m, index) => {
      const card = document.createElement('article');
      card.className = 'memory-card glass-card' + (selectedIds.has(m.id) ? ' selected' : '');
      card.setAttribute('data-id', m.id);
      card.setAttribute('data-cat', m.category);

      // Cascade entrance stagger
      card.style.animationDelay = `${Math.min(index, 7) * 50}ms`;

      const categoryLabel = m.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const dateText = new Date(m.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      const tagsHtml = m.tags.map(t => `<span class="card-tag">#${t}</span>`).join('');

      card.innerHTML = `
        <div class="memory-card-checkbox"><i data-lucide="check"></i></div>
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

      card.querySelector('.act-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(m);
      });
      card.querySelector('.act-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMemory(m.id);
      });

      card.addEventListener('click', () => {
        if (!bulkMode) return;
        selectedIds.has(m.id) ? selectedIds.delete(m.id) : selectedIds.add(m.id);
        card.classList.toggle('selected', selectedIds.has(m.id));
        updateBulkToolbar();
      });

      elMemoriesGrid.appendChild(card);
    });
  }

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

  // Refresh UI elements that depend on categories
  refreshUI();
  lucide.createIcons();
}

function refreshUI() {
  const catItems = getCategoryItems();
  if (addFormDropdown) addFormDropdown.setItems(catItems);
  if (editFormDropdown) editFormDropdown.setItems(catItems);
  renderCategoryChips();
}

// Mark context state as unsaved
function markContextDirty() {
  state.isContextDirty = true;
  setAutosaveState('unsaved');
  debouncedAutoSave();
}

// --- Actions & Forms Submissions ---

// Create Fact Action
elAddMemoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fact = elNewFact.value.trim();
  const category = addFormDropdown ? addFormDropdown.getValue() : 'general';
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
      closeAddModal();
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
  if (editFormDropdown) editFormDropdown.select(m.category);
  elEditTags.value = m.tags.join(', ');
  elEditModal.classList.add('active');
}

// Edit Memory Form Submit
elEditMemoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = elEditId.value;
  const fact = elEditFact.value.trim();
  const category = editFormDropdown ? editFormDropdown.getValue() : 'general';
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

// Close Edit Modal
elCloseModalBtn.addEventListener('click', () => elEditModal.classList.remove('active'));
elCancelModalBtn.addEventListener('click', () => elEditModal.classList.remove('active'));
window.addEventListener('click', (e) => {
  if (e.target === elEditModal) elEditModal.classList.remove('active');
  if (e.target === elAddModal) closeAddModal();
});

// Delete Memory Action
async function deleteMemory(id) {
  const snap = state.memories.find(m => m.id === id);
  if (!snap) return;
  state.memories = state.memories.filter(m => m.id !== id);
  const card = elMemoriesGrid.querySelector(`.memory-card[data-id="${id}"]`);
  if (card) {
    card.classList.add('deleting');
    setTimeout(() => {
      renderMemories();
      renderFilters();
    }, 300);
  } else {
    renderMemories();
    renderFilters();
  }
  showUndoToast([id], [snap], 'Memory deleted');
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

// Category Management inputs
if (elAddCategoryBtn) {
  elAddCategoryBtn.addEventListener('click', () => {
    const val = elCategoryInput.value.trim();
    if (val) {
      addCategory(val);
      elCategoryInput.value = '';
    }
  });
}
if (elCategoryInput) {
  elCategoryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = elCategoryInput.value.trim();
      if (val) {
        addCategory(val);
        elCategoryInput.value = '';
      }
    }
  });
}

// Bulk selection controls
if (elBulkSelectToggle) {
  elBulkSelectToggle.addEventListener('click', () => bulkMode ? exitBulkMode() : enterBulkMode());
}
if (elBulkDeleteBtn) {
  elBulkDeleteBtn.addEventListener('click', bulkDelete);
}
if (elBulkCancelBtn) {
  elBulkCancelBtn.addEventListener('click', exitBulkMode);
}

// Sort control
if (elSortSelect) {
  elSortSelect.value = state.sortOrder;
  elSortSelect.addEventListener('change', () => {
    state.sortOrder = elSortSelect.value;
    localStorage.setItem('memory-sort', state.sortOrder);
    renderMemories();
  });
}

// --- Search Filter ---
const elSearchClearBtn = document.getElementById('search-clear-btn');

elSearchInput.addEventListener('input', (e) => {
  state.filters.search = e.target.value;
  if (elSearchClearBtn) {
    elSearchClearBtn.style.display = e.target.value ? 'flex' : 'none';
  }
  renderMemories();
});

if (elSearchClearBtn) {
  elSearchClearBtn.addEventListener('click', () => {
    elSearchInput.value = '';
    state.filters.search = '';
    elSearchClearBtn.style.display = 'none';
    elSearchInput.focus();
    renderMemories();
  });
}

// --- Drawer & Modal Bindings ---
if (elOpenSettingsBtn) elOpenSettingsBtn.addEventListener('click', openDrawer);
if (elCloseDrawerBtn) elCloseDrawerBtn.addEventListener('click', closeDrawer);
if (elDrawerOverlay) elDrawerOverlay.addEventListener('click', closeDrawer);

if (elOpenAddModalBtn) elOpenAddModalBtn.addEventListener('click', openAddModal);
if (elCloseAddModalBtn) elCloseAddModalBtn.addEventListener('click', closeAddModal);
if (elCancelAddModalBtn) elCancelAddModalBtn.addEventListener('click', closeAddModal);

// Keyboard shortcut: Escape closes drawer and modals
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.drawerOpen) closeDrawer();
    if (elAddModal.classList.contains('active')) closeAddModal();
    if (elEditModal.classList.contains('active')) elEditModal.classList.remove('active');
  }
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

// ==========================================================================
// DUAL PANE MARKDOWN EDITOR & AI CONSOLE HANDLERS
// ==========================================================================

function setMdStatus(status) {
  if (!elMdStatusIndicator) return;
  elMdStatusIndicator.className = 'md-status-indicator ' + status;
  const icons = { saved: 'check-circle-2', dirty: 'circle-dot', saving: 'loader-2', error: 'alert-circle' };
  const texts = { saved: 'Saved', dirty: 'Unsaved Changes', saving: 'Saving…', error: 'Load failed' };
  
  const iconEl = elMdStatusIndicator.querySelector('i');
  if (iconEl) iconEl.setAttribute('data-lucide', icons[status] || 'check-circle-2');
  const textEl = elMdStatusIndicator.querySelector('span');
  if (textEl) textEl.textContent = texts[status] || '';
  
  lucide.createIcons({ nodes: [elMdStatusIndicator] });
}

async function loadMdFile(fileName) {
  elActiveMdFilename.textContent = fileName;
  setMdStatus('saved');
  state.isMdDirty = false;

  // Check cache first
  if (state.mdFiles[fileName] !== undefined) {
    elMdTextarea.value = state.mdFiles[fileName];
    renderMdPreview(state.mdFiles[fileName]);
    return;
  }

  setMdStatus('saving');
  try {
    const res = await fetch('/api/project-mds');
    const data = await res.json();
    if (data.files) {
      Object.keys(data.files).forEach(f => {
        state.mdFiles[f] = data.files[f];
      });
      elMdTextarea.value = state.mdFiles[fileName] || '';
      renderMdPreview(state.mdFiles[fileName] || '');
      setMdStatus('saved');
    }
  } catch (err) {
    showToast('Failed to load project rule files.', 'error');
    setMdStatus('error');
  }
}

async function saveActiveMdFile() {
  const fileName = state.activeTab;
  if (fileName === 'memories') return;
  
  const content = elMdTextarea.value;
  setMdStatus('saving');
  try {
    const res = await fetch('/api/project-mds', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: fileName, content })
    });
    
    if (res.ok) {
      state.mdFiles[fileName] = content;
      state.isMdDirty = false;
      setMdStatus('saved');
      showToast(`${fileName} successfully saved to disk!`, 'success');
    } else {
      throw new Error();
    }
  } catch (err) {
    setMdStatus('error');
    showToast('Failed to save file.', 'error');
  }
}

function switchView(tabName) {
  state.activeTab = tabName;
  const isMemories = tabName === 'memories';

  // Toggle grid vs editor panel
  elMemoriesGrid.style.display = isMemories ? (state.memories.length === 0 ? 'none' : 'grid') : 'none';
  elEmptyState.style.display = isMemories ? (state.memories.length === 0 ? 'flex' : 'none') : 'none';
  elMdEditorPanel.style.display = isMemories ? 'none' : 'flex';

  // Toggle header controls
  const searchGroup = document.querySelector('.search-group');
  const sortSelect = document.getElementById('sort-select');
  const bulkSelect = document.getElementById('bulk-select-toggle');
  
  if (searchGroup) searchGroup.style.display = isMemories ? 'flex' : 'none';
  if (sortSelect) sortSelect.style.display = isMemories ? 'block' : 'none';
  if (bulkSelect) bulkSelect.style.display = isMemories ? 'flex' : 'none';

  // Update header title
  if (elHeaderTitle) {
    if (isMemories) {
      elHeaderTitle.textContent = state.filters.category === 'all'
        ? 'All Memories'
        : state.filters.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    } else {
      elHeaderTitle.textContent = `Documentation Rules — ${tabName}`;
    }
  }

  // Update doc nav buttons active class
  document.querySelectorAll('.doc-nav-btn').forEach(btn => {
    const file = btn.getAttribute('data-file');
    btn.classList.toggle('active', file === tabName);
  });

  // Update category nav active class
  if (!isMemories) {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.remove('active');
    });
  }

  if (!isMemories) {
    loadMdFile(tabName);
  }
}

function writeTerminal(promptSymbol, messageHtml) {
  const promptEl = elConsoleTerminal.querySelector('.terminal-prompt');
  if (promptEl) promptEl.textContent = `$ ${promptSymbol}`;
  elTerminalContent.innerHTML = messageHtml;
}

let lastProposedContent = null;

async function runAiDuplicates() {
  if (!state.groqKey) {
    showToast('Groq API Key is required. Please set it in Settings.', 'error');
    return;
  }
  writeTerminal('duplicates --scan', '<span class="typing-cursor">Scanning project memories for duplicate guidelines...</span>');
  try {
    const res = await fetch('/api/ai/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.groqKey}`
      },
      body: JSON.stringify({ action: 'detect_duplicates' })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Server error');
    }
    const data = await res.json();
    renderAiDuplicatesResult(data);
  } catch (err) {
    writeTerminal('duplicates --error', `<span style="color:var(--danger)">Scan failed: ${err.message}</span>`);
  }
}

function renderAiDuplicatesResult(data) {
  const dups = data.duplicates || [];
  if (dups.length === 0) {
    writeTerminal('duplicates --clean', '<span style="color:var(--accent)">No semantic duplicates detected in project memories! Clean scan completed.</span>');
    return;
  }
  
  let html = `<p style="margin-bottom:10px;color:var(--accent);">Found ${dups.length} duplicate groups:</p><div class="ai-diff-list">`;
  dups.forEach((group, gIdx) => {
    html += `
      <div class="ai-group-card">
        <div class="ai-group-title"><i data-lucide="copy"></i> Group: ${escapeHtml(group.groupName)}</div>
        <div class="ai-group-items">
    `;
    
    group.duplicateIds.forEach(id => {
      const mem = state.memories.find(m => m.id === id);
      const factText = mem ? mem.fact : 'Unknown memory';
      html += `
        <div class="ai-group-item">
          <span>${escapeHtml(factText)}</span>
          <button type="button" class="ai-delete-dup-btn" data-id="${id}"><i data-lucide="trash-2"></i> Delete</button>
        </div>
      `;
    });
    
    html += `
        </div>
        <div class="ai-group-merge"><strong>Suggested Merge:</strong> "${escapeHtml(group.mergeSuggestion)}"</div>
        <button type="button" class="btn-primary ai-merge-apply-btn" data-gidx="${gIdx}" style="padding:4px 8px;font-size:10px;margin-top:5px;align-self:flex-start;">
          <i data-lucide="check"></i> Apply Merge &amp; Delete Originals
        </button>
      </div>
    `;
  });
  html += '</div>';
  
  writeTerminal('duplicates --results', html);
  lucide.createIcons({ nodes: [elTerminalContent] });
  
  // Bind inline delete buttons
  elTerminalContent.querySelectorAll('.ai-delete-dup-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Delete this duplicate memory?')) {
        btn.disabled = true;
        await fetch(`/api/memories?id=${id}`, { method: 'DELETE' });
        await fetchMemories();
        showToast('Duplicate memory deleted successfully.', 'success');
        runAiDuplicates();
      }
    });
  });
  
  // Bind merge apply buttons
  elTerminalContent.querySelectorAll('.ai-merge-apply-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const gIdx = parseInt(btn.getAttribute('data-gidx'));
      const group = dups[gIdx];
      btn.disabled = true;
      
      try {
        const addRes = await fetch('/api/memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fact: group.mergeSuggestion,
            category: 'general',
            tags: ['merged-duplicate']
          })
        });
        
        if (!addRes.ok) throw new Error('Failed to create merged memory');
        
        await Promise.all(group.duplicateIds.map(id => fetch(`/api/memories?id=${id}`, { method: 'DELETE' })));
        
        await fetchStatus();
        await fetchMemories();
        showToast('Duplicate group successfully merged and clean-up completed!', 'success');
        runAiDuplicates();
      } catch (err) {
        showToast(`Merge failed: ${err.message}`, 'error');
        btn.disabled = false;
      }
    });
  });
}

async function runAiPrune() {
  if (!state.groqKey) {
    showToast('Groq API Key is required. Please set it in Settings.', 'error');
    return;
  }
  writeTerminal('prune --analyze', '<span class="typing-cursor">Analyzing memory bank for contradictory or outdated rule drift...</span>');
  try {
    const res = await fetch('/api/ai/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.groqKey}`
      },
      body: JSON.stringify({ action: 'prune_obsolete' })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Server error');
    }
    const data = await res.json();
    renderAiPruneResult(data);
  } catch (err) {
    writeTerminal('prune --error', `<span style="color:var(--danger)">Prune scan failed: ${err.message}</span>`);
  }
}

function renderAiPruneResult(data) {
  const obs = data.obsolete || [];
  if (obs.length === 0) {
    writeTerminal('prune --clean', '<span style="color:var(--accent)">No contradictory or outdated memories detected! Your memory guidelines are perfectly aligned.</span>');
    return;
  }
  
  let html = `<p style="margin-bottom:10px;color:var(--accent);">Detected ${obs.length} obsolete / contradictory rules:</p><div class="ai-diff-list">`;
  obs.forEach((item, idx) => {
    html += `
      <div class="ai-group-card" style="border-color:rgba(239,68,68,0.2);background:rgba(239,68,68,0.02);">
        <div class="ai-group-title" style="color:var(--danger);"><i data-lucide="shield-alert"></i> Rule Contradiction #${idx + 1}</div>
        <div style="font-size:11px;margin-top:5px;line-height:1.4;">
          <div style="color:var(--accent);margin-bottom:3px;"><strong>New Active Rule:</strong> "${escapeHtml(item.activeFact)}"</div>
          <div style="color:var(--text-muted);text-decoration:line-through;margin-bottom:5px;"><strong>Obsolete Rule:</strong> "${escapeHtml(item.obsoleteFact)}"</div>
          <div style="color:var(--text-secondary);font-style:italic;"><strong>Reason:</strong> ${escapeHtml(item.reason)}</div>
        </div>
        <button type="button" class="btn-primary ai-prune-apply-btn" data-id="${item.obsoleteId}" style="padding:4px 8px;font-size:10px;margin-top:8px;background:var(--danger);border-color:var(--danger);align-self:flex-start;">
          <i data-lucide="trash-2"></i> Prune Outdated Rule
        </button>
      </div>
    `;
  });
  html += '</div>';
  
  writeTerminal('prune --results', html);
  lucide.createIcons({ nodes: [elTerminalContent] });
  
  elTerminalContent.querySelectorAll('.ai-prune-apply-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      try {
        await fetch(`/api/memories?id=${id}`, { method: 'DELETE' });
        await fetchStatus();
        await fetchMemories();
        showToast('Outdated memory pruned successfully.', 'success');
        runAiPrune();
      } catch (err) {
        showToast('Prune failed.', 'error');
        btn.disabled = false;
      }
    });
  });
}

async function runAiClassify() {
  if (!state.groqKey) {
    showToast('Groq API Key is required. Please set it in Settings.', 'error');
    return;
  }
  writeTerminal('classify --tag', '<span class="typing-cursor">Analyzing memory contents to optimize tagging and categorization schema...</span>');
  try {
    const res = await fetch('/api/ai/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.groqKey}`
      },
      body: JSON.stringify({ action: 'auto_classify' })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Server error');
    }
    const data = await res.json();
    renderAiClassifyResult(data);
  } catch (err) {
    writeTerminal('classify --error', `<span style="color:var(--danger)">Auto-tagging failed: ${err.message}</span>`);
  }
}

function renderAiClassifyResult(data) {
  const list = data.classifications || [];
  const changes = list.filter(item => {
    const mem = state.memories.find(m => m.id === item.id);
    if (!mem) return false;
    
    const catDiff = mem.category !== item.suggestedCategory;
    const originalTagsJoined = [...mem.tags].sort().join(',');
    const suggestedTagsJoined = [...item.suggestedTags].sort().join(',');
    const tagsDiff = originalTagsJoined !== suggestedTagsJoined;
    
    return catDiff || tagsDiff;
  });
  
  if (changes.length === 0) {
    writeTerminal('classify --clean', '<span style="color:var(--accent)">All project memories are already perfectly categorized and tagged!</span>');
    return;
  }
  
  let html = `<p style="margin-bottom:10px;color:var(--accent);">Suggested improvements for ${changes.length} memories:</p><div class="ai-diff-list">`;
  changes.forEach((item, idx) => {
    const mem = state.memories.find(m => m.id === item.id);
    const catLabel = item.suggestedCategory.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    html += `
      <div class="ai-group-card" style="border-color:rgba(139,92,246,0.15);background:rgba(139,92,246,0.02);">
        <div class="ai-group-title" style="color:#a78bfa;"><i data-lucide="tag"></i> Suggestion #${idx + 1}</div>
        <p style="font-size:11px;margin:4px 0;color:var(--text-primary);">"${escapeHtml(item.fact)}"</p>
        <div style="font-size:10px;color:var(--text-muted);display:flex;flex-direction:column;gap:3px;">
          <div>Category: <span style="text-decoration:line-through;margin-right:5px;">${mem ? mem.category : ''}</span> → <span class="category-tag cat-${item.suggestedCategory}" style="font-size:9px;padding:1px 4px;">${catLabel}</span></div>
          <div>Tags: <span style="text-decoration:line-through;margin-right:5px;">#${mem ? mem.tags.join(' #') : ''}</span> → <span style="color:var(--accent);">#${item.suggestedTags.join(' #')}</span></div>
        </div>
        <button type="button" class="btn-primary ai-classify-apply-btn" data-id="${item.id}" data-idx="${idx}" style="padding:4px 8px;font-size:10px;margin-top:8px;align-self:flex-start;">
          <i data-lucide="check"></i> Apply Tags &amp; Category
        </button>
      </div>
    `;
  });
  html += '</div>';
  
  writeTerminal('classify --results', html);
  lucide.createIcons({ nodes: [elTerminalContent] });
  
  elTerminalContent.querySelectorAll('.ai-classify-apply-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const idx = parseInt(btn.getAttribute('data-idx'));
      const item = changes[idx];
      btn.disabled = true;
      
      try {
        const res = await fetch('/api/memories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            fact: item.fact,
            category: item.suggestedCategory,
            tags: item.suggestedTags
          })
        });
        
        if (!res.ok) throw new Error();
        await fetchMemories();
        showToast('Memory categorization successfully optimized!', 'success');
        runAiClassify();
      } catch {
        showToast('Optimization update failed.', 'error');
        btn.disabled = false;
      }
    });
  });
}

async function runAiSync() {
  if (!state.groqKey) {
    showToast('Groq API Key is required. Please set it in Settings.', 'error');
    return;
  }
  writeTerminal('sync --markdown', '<span class="typing-cursor">Synthesizing stored memory guidelines into project documentation files...</span>');
  try {
    const res = await fetch('/api/ai/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.groqKey}`
      },
      body: JSON.stringify({ action: 'sync_markdown' })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Server error');
    }
    const data = await res.json();
    renderAiSyncResult(data);
  } catch (err) {
    writeTerminal('sync --error', `<span style="color:var(--danger)">Sync analysis failed: ${err.message}</span>`);
  }
}

function renderAiSyncResult(data) {
  lastProposedContent = data;
  
  let html = `<p style="margin-bottom:10px;color:var(--accent);">Synched rules proposed by Llama 3:</p>`;
  html += `<div style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);margin-bottom:12px;white-space:pre-wrap;line-height:1.4;">${escapeHtml(data.explanation || 'Analyzed memories and generated updates.')}</div>`;
  
  html += '<div class="ai-diff-list">';
  
  const files = [
    { key: 'claudemd', label: 'CLAUDE.md' },
    { key: 'agentsmd', label: 'AGENTS.md' },
    { key: 'geminimd', label: 'GEMINI.md' }
  ];
  
  files.forEach(f => {
    if (data[f.key] && data[f.key].proposed) {
      html += `
        <div class="ai-diff-item">
          <div class="ai-diff-file"><i data-lucide="file-text"></i> Proposed changes for ${f.label}</div>
          <div class="ai-diff-desc">Complete new proposed size: ${data[f.key].proposed.length} chars. Select "Apply to Editor" to load content.</div>
        </div>
      `;
    }
  });
  
  html += '</div>';
  
  writeTerminal('sync --proposed', html);
  lucide.createIcons({ nodes: [elTerminalContent] });
  
  elConsoleFooter.style.display = 'flex';
}

function renderMdPreview(markdown) {
  if (!elMdPreview) return;
  if (!markdown) {
    elMdPreview.innerHTML = '<span class="label-helper">Empty rules file. Start typing to write guidelines...</span>';
    return;
  }

  let html = escapeHtml(markdown);

  // Parse multiline code blocks first (to hide them from subsequent replacements)
  const codeBlocks = [];
  html = html.replace(/```(\w*)\r?\n([\s\S]*?)\r?\n```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre><code class="language-${lang}">${code}</code></pre>`);
    return placeholder;
  });

  // Parse inline code blocks
  const inlineCodes = [];
  html = html.replace(/`([^`\n]+)`/g, (match, code) => {
    const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
    inlineCodes.push(`<code>${code}</code>`);
    return placeholder;
  });

  // Headers
  html = html.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Checkbox/Bullet list elements
  html = html.replace(/^\s*-\s+\[\s*\]\s+(.*?)$/gm, '<li><input type="checkbox" disabled> $1</li>');
  html = html.replace(/^\s*-\s+\[x\]\s+(.*?)$/gm, '<li><input type="checkbox" checked disabled> $1</li>');
  html = html.replace(/^\s*-\s+(.*?)$/gm, '<li>$1</li>');

  // Wrap consecutive list items in <ul>
  html = html.replace(/((?:<li>.*?<\/li>\s*)+)/gs, '<ul>$1</ul>');

  // Tables
  html = html.replace(/^\|(.*?)\|$/gm, (match, content) => {
    const cols = content.split('|').map(c => c.trim());
    return `<tr>${cols.map(c => `<td>${c}</td>`).join('')}</tr>`;
  });
  html = html.replace(/((?:<tr>.*?<\/tr>\s*)+)/gs, (match) => {
    let cleaned = match.replace(/<tr>\s*(?:<td>\s*:?-+:?\s*<\/td>\s*)+<\/tr>/g, '');
    cleaned = cleaned.replace(/<tr>\s*(<td>.*?<\/td>\s*)+<\/tr>/, (m) => {
      return m.replace(/<td>(.*?)<\/td>/g, '<th>$1</th>');
    });
    return `<table>${cleaned}</table>`;
  });

  // Blockquotes and Alerts
  html = html.replace(/^>(.*?)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/((?:<blockquote>.*?<\/blockquote>\s*)+)/gs, (match) => {
    let content = match.replace(/<\/?blockquote>\s*/g, ' ').trim();
    if (content.startsWith('[!NOTE]')) {
      return `<blockquote class="alert-note"><p>${content.replace('[!NOTE]', '').trim()}</p></blockquote>`;
    } else if (content.startsWith('[!TIP]')) {
      return `<blockquote class="alert-tip"><p>${content.replace('[!TIP]', '').trim()}</p></blockquote>`;
    } else if (content.startsWith('[!IMPORTANT]')) {
      return `<blockquote class="alert-important"><p>${content.replace('[!IMPORTANT]', '').trim()}</p></blockquote>`;
    } else if (content.startsWith('[!WARNING]')) {
      return `<blockquote class="alert-warning"><p>${content.replace('[!WARNING]', '').trim()}</p></blockquote>`;
    } else if (content.startsWith('[!CAUTION]')) {
      return `<blockquote class="alert-caution"><p>${content.replace('[!CAUTION]', '').trim()}</p></blockquote>`;
    }
    return `<blockquote><p>${content}</p></blockquote>`;
  });

  // Bold / Italics
  html = html.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([\s\S]*?)\*/g, '<em>$1</em>');

  // Wrap remaining text blocks in paragraphs
  const lines = html.split('\n');
  html = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (/^<\/?(h[1-4]|pre|code|ul|ol|li|table|tr|th|td|blockquote|hr|p)/i.test(trimmed)) {
      return line;
    }
    if (trimmed.startsWith('__CODE_BLOCK_') || trimmed.startsWith('__INLINE_CODE_')) {
      return line;
    }
    return `<p>${line}</p>`;
  }).join('\n');

  // Restore inline codes
  inlineCodes.forEach((val, idx) => {
    html = html.replace(`__INLINE_CODE_${idx}__`, val);
  });
  // Restore code blocks
  codeBlocks.forEach((val, idx) => {
    html = html.replace(`__CODE_BLOCK_${idx}__`, val);
  });

  elMdPreview.innerHTML = html;
}

function bindMarkdownAndAiEvents() {
  // Groq API key setup
  if (elGroqApiKey) {
    elGroqApiKey.value = state.groqKey;
    elGroqApiKey.addEventListener('input', (e) => {
      state.groqKey = e.target.value.trim();
      localStorage.setItem('groq-api-key', state.groqKey);
    });
  }

  // Bind sidebar document links
  document.querySelectorAll('.doc-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const file = btn.getAttribute('data-file');
      switchView(file);
    });
  });

  // Editor modifications tracker
  if (elMdTextarea) {
    elMdTextarea.addEventListener('input', (e) => {
      state.isMdDirty = true;
      setMdStatus('dirty');
      renderMdPreview(e.target.value);
    });
    
    elMdTextarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveActiveMdFile();
      }
    });
  }

  // Save rules button
  if (elSaveMdBtn) {
    elSaveMdBtn.addEventListener('click', saveActiveMdFile);
  }

  // AI optimizing panel triggers
  if (elAiOptimizeBtn) {
    elAiOptimizeBtn.addEventListener('click', () => {
      elAiConsoleDrawer.classList.add('active');
      writeTerminal('ready', 'Llama 3 AI Agent Console activated. Select an action to scan and optimize memories.');
    });
  }

  if (elCloseAiConsoleBtn) {
    elCloseAiConsoleBtn.addEventListener('click', () => {
      elAiConsoleDrawer.classList.remove('active');
      elConsoleFooter.style.display = 'none';
    });
  }

  // Sliding Drawer console action keys
  if (elBtnAiDuplicates) {
    elBtnAiDuplicates.addEventListener('click', () => {
      toggleConsoleButton(elBtnAiDuplicates);
      runAiDuplicates();
    });
  }
  if (elBtnAiPrune) {
    elBtnAiPrune.addEventListener('click', () => {
      toggleConsoleButton(elBtnAiPrune);
      runAiPrune();
    });
  }
  if (elBtnAiClassify) {
    elBtnAiClassify.addEventListener('click', () => {
      toggleConsoleButton(elBtnAiClassify);
      runAiClassify();
    });
  }
  if (elBtnAiSync) {
    elBtnAiSync.addEventListener('click', () => {
      toggleConsoleButton(elBtnAiSync);
      runAiSync();
    });
  }

  // Sync applies
  if (elCancelConsoleChanges) {
    elCancelConsoleChanges.addEventListener('click', () => {
      elConsoleFooter.style.display = 'none';
      lastProposedContent = null;
      writeTerminal('ready', 'Changes discarded. Select another action.');
    });
  }

  if (elApplyConsoleChanges) {
    elApplyConsoleChanges.addEventListener('click', () => {
      if (!lastProposedContent) return;
      
      const fileName = state.activeTab;
      let proposedText = '';
      if (fileName === 'CLAUDE.md' && lastProposedContent.claudemd) {
        proposedText = lastProposedContent.claudemd.proposed;
      } else if (fileName === 'AGENTS.md' && lastProposedContent.agentsmd) {
        proposedText = lastProposedContent.agentsmd.proposed;
      } else if (fileName === 'GEMINI.md' && lastProposedContent.geminimd) {
        proposedText = lastProposedContent.geminimd.proposed;
      } else {
        showToast(`No sync changes generated for current file ${fileName}.`, 'info');
        return;
      }
      
      if (proposedText) {
        elMdTextarea.value = proposedText;
        state.isMdDirty = true;
        setMdStatus('dirty');
        renderMdPreview(proposedText);
        
        elAiConsoleDrawer.classList.remove('active');
        elConsoleFooter.style.display = 'none';
        showToast(`Synced guidelines loaded into ${fileName}! You can now review and save.`, 'success');
      }
    });
  }
}

function toggleConsoleButton(activeBtn) {
  elConsoleFooter.style.display = 'none';
  [elBtnAiDuplicates, elBtnAiPrune, elBtnAiClassify, elBtnAiSync].forEach(btn => {
    if (btn) btn.classList.toggle('active', btn === activeBtn);
  });
}

// --- Init Loader ---
async function init() {
  await fetchStatus();
  await fetchMemories();
  await fetchContext();

  // Initialize CustomDropdown instances
  addFormDropdown = new CustomDropdown(
    document.getElementById('mount-new-category'),
    { items: getCategoryItems(), value: 'general', allowCreate: true, onSelect: () => {},
      onCreateItem: async (val) => {
        await addCategory(val);
        addFormDropdown.setItems(getCategoryItems());
        addFormDropdown.select(val);
        await saveContext();
      }
    }
  );
  editFormDropdown = new CustomDropdown(
    document.getElementById('mount-edit-category'),
    { items: getCategoryItems(), value: 'general', allowCreate: true, onSelect: () => {},
      onCreateItem: async (val) => {
        await addCategory(val);
        editFormDropdown.setItems(getCategoryItems());
        editFormDropdown.select(val);
        await saveContext();
      }
    }
  );

  // Wire up Markdown Editor & AI Console
  bindMarkdownAndAiEvents();
}

// Boot Client
init();
