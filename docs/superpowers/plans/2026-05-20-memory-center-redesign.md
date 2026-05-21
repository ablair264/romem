# Project Memory Center — Redesign & Feature Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full visual redesign (teal palette, Syne/DM Sans/JetBrains Mono, animated mesh background) plus UX feature additions (custom dropdowns, category management, auto-save, undo delete, bulk select, sort, search clear, tag autocomplete) across three frontend files.

**Architecture:** Pure vanilla JS/CSS/HTML frontend served by `gui.js` on port 3000. No build toolchain. All changes confined to `public/index.html`, `public/style.css`, `public/app.js`. No changes to `gui.js` or `index.js`.

**Tech Stack:** Vanilla JS ES6+, CSS custom properties, Lucide icons CDN, Google Fonts CDN

---

### Dev Setup

```bash
node gui.js --project-path /path/to/your/project
# Open http://localhost:3000
# Hard-refresh: Cmd+Shift+R after each save
```

---

### Gemini-Safe Tasks (independent, no cross-task state)

| Task | Description |
|------|-------------|
| **1** | CSS tokens + font imports |
| **2** | Animated mesh gradient background |
| **3** | Refactor component styles to new tokens |
| **4** | Card hover, animations, modal spring |
| **11** | Search clear button |
| **12** | Tag autocomplete |
| **13** | Stagger entrance + metric counter animation |
| **14** | Sliding category tab indicator |

**Sequential (Claude — cross-task dependencies):** 5 → 6 → 7 → 8 → 9 → 10

---

### Task 1 [GEMINI]: CSS Design Tokens + Font Imports

**Files:**
- Modify: `public/index.html` lines 8-10
- Modify: `public/style.css` lines 6-37 (`:root` block)

- [ ] **Step 1: Replace font imports in `public/index.html`**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Replace entire `:root` block in `public/style.css`**

```css
:root {
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --bg-main: #0b0e14;
  --bg-card: rgba(15, 20, 30, 0.72);
  --bg-card-hover: rgba(18, 25, 38, 0.85);
  --border-glass: rgba(121, 213, 233, 0.08);
  --border-glass-active: rgba(121, 213, 233, 0.3);

  --text-primary: #ffffff;
  --text-secondary: #94a3b8;
  --text-muted: #4b5563;

  --accent-primary: #79d5e9;
  --accent-deep: #4daeac;
  --accent-amber: #f59e0b;
  --neon-emerald: #10b981;
  --neon-rose: #f43f5e;

  --glow-primary: 0 0 20px rgba(121, 213, 233, 0.2);
  --glow-primary-strong: 0 0 30px rgba(121, 213, 233, 0.35);

  --ease-fast: cubic-bezier(0.16, 1, 0.3, 1);
  --transition-normal: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
```

- [ ] **Step 3: Update `body` font-family**

In `public/style.css` find `font-family: var(--font-body)` in the `body` rule — it's already correct if using the variable. Just confirm `--font-body` reference is present.

- [ ] **Step 4: Verify** — Open http://localhost:3000. Page loads with DM Sans body text, dark background, no layout breaks.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/style.css
git commit -m "style: replace purple palette with teal tokens, upgrade to Syne/DM Sans/JetBrains Mono"
```

---

### Task 2 [GEMINI]: Animated Mesh Gradient Background

**Files:**
- Modify: `public/index.html` — replace orb markup
- Modify: `public/style.css` — replace orb CSS blocks

- [ ] **Step 1: Replace background HTML in `public/index.html`**

Replace:
```html
<div class="glass-bg-glows">
  <div class="glow-orb orb-1"></div>
  <div class="glow-orb orb-2"></div>
</div>
```
With:
```html
<div class="app-bg-mesh"></div>
```

- [ ] **Step 2: Replace background CSS in `public/style.css`**

Delete the `.glass-bg-glows`, `.glow-orb`, `.orb-1`, `.orb-2`, and `@keyframes floatOrb` blocks. Replace with:

```css
.app-bg-mesh {
  position: fixed;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 20% 30%, rgba(121, 213, 233, 0.07) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(77, 174, 172, 0.05) 0%, transparent 50%),
    linear-gradient(135deg, #0b0e14 0%, #0f141c 40%, #111822 70%, #0b0e14 100%);
  background-size: 300% 300%, 300% 300%, 100% 100%;
  animation: meshShift 25s ease infinite;
}

@keyframes meshShift {
  0%, 100% { background-position: 0% 0%, 100% 100%, 0% 0%; }
  33%       { background-position: 50% 30%, 50% 70%, 0% 0%; }
  66%       { background-position: 100% 60%, 0% 40%, 0% 0%; }
}
```

- [ ] **Step 3: Verify** — Dark navy background with subtle slow-shifting teal tint. No purple blobs.

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/style.css
git commit -m "style: replace purple orbs with animated teal mesh gradient"
```

---

### Task 3 [GEMINI]: Refactor Component Styles to New Tokens

**Files:**
- Modify: `public/style.css` only — replace all `--neon-indigo`, `--neon-violet`, `--neon-fuchsia` references

- [ ] **Step 1: Verify old token count**

```bash
grep -c "neon-indigo\|neon-violet\|neon-fuchsia" public/style.css
```

Note the count. Target: 0 after this task.

- [ ] **Step 2: Replace logo gradient**

Find `.logo-icon-container`, update `background`:
```css
background: linear-gradient(135deg, var(--accent-deep), var(--accent-primary));
box-shadow: var(--glow-primary);
```

- [ ] **Step 3: Replace title gradient**

Find `.title-meta h1`, update `background`:
```css
background: linear-gradient(to right, #ffffff, var(--accent-primary));
```

- [ ] **Step 4: Replace scope badge color**

Find `.scope-badge`, update `color`:
```css
color: var(--accent-primary);
```

- [ ] **Step 5: Replace metric icon colors**

```css
.val-indigo {
  background: rgba(121, 213, 233, 0.1);
  border: 1px solid rgba(121, 213, 233, 0.2);
  color: var(--accent-primary);
}
.val-violet {
  background: rgba(77, 174, 172, 0.1);
  border: 1px solid rgba(77, 174, 172, 0.2);
  color: var(--accent-deep);
}
.val-fuchsia {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  color: var(--accent-amber);
}
```

- [ ] **Step 6: Replace all input focus colors**

Find every instance of:
- `border-color: var(--neon-violet)` → `border-color: var(--accent-primary)`
- `box-shadow: 0 0 12px rgba(139, 92, 246, 0.15)` → `box-shadow: 0 0 12px rgba(121, 213, 233, 0.15)`

Affects: `.input-glow-group input:focus`, `.checklist-add-wrapper input:focus`, `.badge-input-wrapper input:focus`, `.form-group textarea:focus`, `.form-group select:focus`, `.form-group input:focus`

- [ ] **Step 7: Replace category tab active state**

```css
.cat-tab.active {
  background: rgba(121, 213, 233, 0.08);
  border-color: rgba(121, 213, 233, 0.2);
  color: var(--accent-primary);
  font-weight: 600;
}
.cat-tab.active::after {
  background: rgba(121, 213, 233, 0.15);
  color: var(--accent-primary);
}
```

- [ ] **Step 8: Replace tag cloud active state**

```css
.cloud-tag:hover, .cloud-tag.active {
  background: rgba(121, 213, 233, 0.08);
  border-color: rgba(121, 213, 233, 0.2);
  color: var(--accent-primary);
}
```

- [ ] **Step 9: Replace primary button**

```css
.btn-primary {
  background: linear-gradient(135deg, var(--accent-deep), var(--accent-primary));
  border: none;
  border-radius: 10px;
  color: #0b0e14;
  padding: 12px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: var(--transition-normal);
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--glow-primary-strong);
}
```

Note: `color: #0b0e14` (dark text on light teal — better contrast).

- [ ] **Step 10: Replace h3 icon color**

```css
.sidebar-panel h3 i, .dashboard-main-content h3 i {
  width: 18px;
  height: 18px;
  color: var(--accent-primary);
}
```

- [ ] **Step 11: Replace tech badge**

```css
.tech-badge {
  font-size: 11px;
  font-family: var(--font-mono);
  background: rgba(121, 213, 233, 0.08);
  border: 1px solid rgba(121, 213, 233, 0.2);
  color: var(--accent-primary);
  padding: 4px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
```

- [ ] **Step 12: Replace btn-icon hover**

```css
.btn-icon:hover {
  border-color: var(--accent-primary);
  background: rgba(121, 213, 233, 0.08);
  color: var(--accent-primary);
}
```

- [ ] **Step 13: Replace box-header icon**

```css
.box-header h4 i { color: var(--accent-primary); }
```

- [ ] **Step 14: Replace category badge colors**

```css
.cat-general     { background: rgba(255,255,255,0.04);  color: var(--text-secondary); border: 1px solid rgba(255,255,255,0.08); }
.cat-architecture{ background: rgba(121,213,233,0.08);  color: var(--accent-primary); border: 1px solid rgba(121,213,233,0.2);  }
.cat-style-guide { background: rgba(77,174,172,0.08);   color: var(--accent-deep);    border: 1px solid rgba(77,174,172,0.2);   }
.cat-database    { background: rgba(16,185,129,0.08);   color: var(--neon-emerald);   border: 1px solid rgba(16,185,129,0.2);   }
.cat-todo        { background: rgba(245,158,11,0.08);   color: var(--accent-amber);   border: 1px solid rgba(245,158,11,0.2);   }
.cat-preference  { background: rgba(244,63,94,0.08);    color: var(--neon-rose);      border: 1px solid rgba(244,63,94,0.2);    }
```

- [ ] **Step 15: Replace toast border colors**

```css
.toast-notification.success { border-color: rgba(16,185,129,0.35); color: var(--neon-emerald); }
.toast-notification.success i { color: var(--neon-emerald); }
.toast-notification.error { border-color: rgba(244,63,94,0.35); color: var(--neon-rose); }
.toast-notification.error i { color: var(--neon-rose); }
.toast-notification.info { border-color: rgba(121,213,233,0.35); color: var(--accent-primary); }
.toast-notification.info i { color: var(--accent-primary); }
```

- [ ] **Step 16: Verify zero old token references**

```bash
grep -n "neon-indigo\|neon-violet\|neon-fuchsia\|#6366f1\|#8b5cf6\|#d946ef" public/style.css
```
Expected: no output.

- [ ] **Step 17: Commit**

```bash
git add public/style.css
git commit -m "style: refactor all components to teal accent tokens, remove purple"
```

---

### Task 4 [GEMINI]: Card Hover, Animation & Modal Updates

**Files:**
- Modify: `public/style.css` only

- [ ] **Step 1: Update `.glass-card` border-radius and hover**

```css
.glass-card {
  background: var(--bg-card);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  border: 1px solid var(--border-glass);
  border-radius: 16px;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
  transition: var(--transition-normal);
}
.glass-card:hover {
  border-color: rgba(121, 213, 233, 0.12);
  background: var(--bg-card-hover);
}
```

- [ ] **Step 2: Add `.memory-card` hover lift**

Find `.memory-card`, update to:
```css
.memory-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  overflow: hidden;
  animation: cardFadeIn 0.4s var(--ease-fast) both;
  transition: transform 0.25s var(--ease-fast), border-color 0.25s ease, box-shadow 0.25s ease;
}
.memory-card:hover {
  transform: translateY(-2px);
  border-color: rgba(121, 213, 233, 0.2);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(121, 213, 233, 0.1);
}
```

- [ ] **Step 3: Update `cardFadeIn` keyframe**

```css
@keyframes cardFadeIn {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

- [ ] **Step 4: Add `.memory-card.deleting` class**

```css
.memory-card.deleting {
  animation: cardDelete 0.3s var(--ease-fast) forwards;
  pointer-events: none;
}
@keyframes cardDelete {
  to { opacity: 0; transform: scale(0.9) translateY(8px); }
}
```

- [ ] **Step 5: Update modal spring**

```css
.modal-card {
  width: 500px;
  max-width: 90%;
  padding: 24px;
  border: 1px solid rgba(121, 213, 233, 0.12);
  transform: translateY(16px) scale(0.93);
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-overlay.active .modal-card {
  transform: translateY(0) scale(1);
}
```

- [ ] **Step 6: Update form element border-radius (12px → 10px)**

Globally replace `border-radius: 12px` on form inputs/textareas/selects with `border-radius: 10px`. Affects `.form-group textarea`, `.form-group select`, `.form-group input`, `.input-glow-group input`, `.checklist-add-wrapper input`, `.badge-input-wrapper input`.

- [ ] **Step 7: Add mono font to tags and path**

```css
.card-tag { font-family: var(--font-mono); }
.scope-path { font-family: var(--font-mono); }
```

- [ ] **Step 8: Verify** — Cards lift on hover with teal glow. Modal springs open with slight overshoot.

- [ ] **Step 9: Commit**

```bash
git add public/style.css
git commit -m "style: card hover lift, teal glow, spring modal, mono tags"
```

---

### Task 5: Custom Dropdown Component

**Files:**
- Modify: `public/index.html` — replace native selects with mount divs
- Modify: `public/style.css` — custom dropdown CSS
- Modify: `public/app.js` — CustomDropdown class, update form handlers

- [ ] **Step 1: Replace native selects in `public/index.html`**

Replace add form select:
```html
<!-- Remove this -->
<select id="new-category">...</select>
<!-- Add this -->
<div id="mount-new-category" class="custom-select-mount"></div>
```

Replace edit modal select:
```html
<!-- Remove this -->
<select id="edit-category">...</select>
<!-- Add this -->
<div id="mount-edit-category" class="custom-select-mount"></div>
```

- [ ] **Step 2: Add custom dropdown CSS to end of `public/style.css`**

```css
/* ========== CUSTOM DROPDOWN ========== */
.custom-select-mount { position: relative; }
.custom-select { position: relative; user-select: none; }

.select-trigger {
  width: 100%;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border-glass);
  border-radius: 10px;
  color: var(--text-primary);
  padding: 10px 12px;
  font-size: 13px;
  font-family: var(--font-body);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  transition: var(--transition-normal);
  text-align: left;
}
.select-trigger:hover { border-color: rgba(121, 213, 233, 0.2); }
.custom-select.open .select-trigger {
  border-color: var(--accent-primary);
  box-shadow: 0 0 12px rgba(121, 213, 233, 0.15);
}

.select-chevron {
  width: 14px; height: 14px;
  color: var(--text-muted);
  transition: transform 0.2s var(--ease-fast);
  flex-shrink: 0;
}
.custom-select.open .select-chevron { transform: rotate(180deg); }

.select-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: rgba(12, 17, 26, 0.98);
  border: 1px solid rgba(121, 213, 233, 0.15);
  border-radius: 10px;
  z-index: 50;
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 0.25s var(--ease-fast), opacity 0.2s ease;
  backdrop-filter: blur(16px);
}
.custom-select.open .select-panel { max-height: 240px; opacity: 1; overflow-y: auto; }
.select-panel::-webkit-scrollbar { width: 4px; }
.select-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

.select-option {
  width: 100%;
  background: none; border: none;
  color: var(--text-secondary);
  padding: 9px 12px;
  font-size: 13px;
  font-family: var(--font-body);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease;
}
.select-option:hover { background: rgba(121, 213, 233, 0.06); color: var(--text-primary); }
.select-option.selected { color: var(--accent-primary); font-weight: 600; }
.select-check { width: 13px; height: 13px; color: var(--accent-primary); }

.select-create-option {
  width: 100%;
  background: none;
  border: none;
  border-top: 1px solid rgba(255,255,255,0.05);
  color: var(--accent-primary);
  padding: 9px 12px;
  font-size: 12px;
  font-family: var(--font-body);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left;
  transition: background 0.15s ease;
  opacity: 0.9;
}
.select-create-option:hover { background: rgba(121, 213, 233, 0.06); opacity: 1; }
.select-create-option i { width: 12px; height: 12px; }
```

- [ ] **Step 3: Add CustomDropdown class to top of `public/app.js`** (before `let state = {...}`)

```javascript
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
```

- [ ] **Step 4: Add dropdown instances and helper to `public/app.js`**

After the DOM references section, add:
```javascript
let addFormDropdown = null;
let editFormDropdown = null;

function getCategoryItems() {
  const cats = state.project_context.categories || ['general', 'style-guide', 'architecture', 'todo', 'database'];
  return cats.map(c => ({ value: c, label: c.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()) }));
}
```

- [ ] **Step 5: Initialize dropdowns at end of `init()` (after `await fetchContext()`)**

```javascript
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
```

Note: `addCategory` and `saveContext` are defined in later tasks. If implementing before Task 6/7, stub them:
```javascript
function addCategory(val) { return Promise.resolve(); }
```
Remove the stub after Tasks 6 and 7 are complete.

- [ ] **Step 6: Update form submit handlers in `public/app.js`**

In `elAddMemoryForm` submit handler, replace `const category = elNewCategory.value` with:
```javascript
const category = addFormDropdown ? addFormDropdown.getValue() : 'general';
```

In `elEditMemoryForm` submit handler, replace `const category = elEditCategory.value` with:
```javascript
const category = editFormDropdown ? editFormDropdown.getValue() : 'general';
```

- [ ] **Step 7: Update `openEditModal()` in `public/app.js`**

```javascript
function openEditModal(m) {
  elEditId.value = m.id;
  elEditFact.value = m.fact;
  if (editFormDropdown) editFormDropdown.select(m.category);
  elEditTags.value = m.tags.join(', ');
  elEditModal.classList.add('active');
}
```

- [ ] **Step 8: Refresh dropdown items when context changes**

At the end of `renderContext()` (before `lucide.createIcons()`), add:
```javascript
const catItems = getCategoryItems();
if (addFormDropdown) addFormDropdown.setItems(catItems);
if (editFormDropdown) editFormDropdown.setItems(catItems);
```

- [ ] **Step 9: Verify** — Custom dropdown opens/closes smoothly. Selecting category updates trigger text. Edit modal shows correct category. No native selects visible.

- [ ] **Step 10: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "feat: CustomDropdown component replaces all native selects"
```

---

### Task 6: Category Management Panel

**Files:**
- Modify: `public/index.html` — 4th context box
- Modify: `public/style.css` — category chip styles
- Modify: `public/app.js` — category CRUD, `addCategory()`, `deleteCategory()`

Requires Task 5 complete.

- [ ] **Step 1: Add 4th context box HTML to `public/index.html`**

Inside `.context-grid`, after the architecture context box:
```html
<div class="context-box">
  <div class="box-header">
    <h4><i data-lucide="layout-grid"></i> Memory Categories</h4>
  </div>
  <div class="category-chips-container" id="category-chips-container"></div>
  <div class="checklist-add-wrapper">
    <input type="text" id="category-input" placeholder="Add new category...">
    <button type="button" id="add-category-btn" class="btn-icon"><i data-lucide="plus"></i></button>
  </div>
</div>
```

- [ ] **Step 2: Add category chip CSS to `public/style.css`**

```css
.category-chips-container {
  display: flex; flex-wrap: wrap; gap: 6px;
  min-height: 32px; align-content: flex-start;
}
.category-chip {
  font-size: 11px; font-family: var(--font-mono);
  background: rgba(121,213,233,0.06);
  border: 1px solid rgba(121,213,233,0.15);
  color: var(--accent-primary);
  padding: 4px 8px; border-radius: 6px;
  display: inline-flex; align-items: center; gap: 5px;
  transition: var(--transition-normal);
}
.category-chip.protected { opacity: 0.4; }
.category-chip-remove {
  border: none; background: none; cursor: pointer;
  color: var(--text-muted); display: flex; align-items: center; padding: 0;
  transition: color 0.2s ease;
}
.category-chip-remove:hover { color: var(--neon-rose); }
.category-chip-remove i { width: 10px; height: 10px; }
```

- [ ] **Step 3: Add DOM references in `public/app.js`**

```javascript
const elCategoryChips = document.getElementById('category-chips-container');
const elCategoryInput = document.getElementById('category-input');
const elAddCategoryBtn = document.getElementById('add-category-btn');
```

- [ ] **Step 4: Add `renderCategoryChips()` to `public/app.js`**

```javascript
function renderCategoryChips() {
  const cats = state.project_context.categories || [];
  elCategoryChips.innerHTML = '';
  cats.forEach(cat => {
    const chip = document.createElement('span');
    chip.className = 'category-chip' + (cat === 'general' ? ' protected' : '');
    const label = cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    chip.innerHTML = cat === 'general'
      ? label
      : `${label}<button class="category-chip-remove" title="Delete"><i data-lucide="x"></i></button>`;
    if (cat !== 'general') {
      chip.querySelector('.category-chip-remove').addEventListener('click', () => deleteCategory(cat));
    }
    elCategoryChips.appendChild(chip);
  });
  lucide.createIcons({ nodes: [elCategoryChips] });
}
```

- [ ] **Step 5: Add `addCategory()` and `deleteCategory()` to `public/app.js`**

```javascript
function addCategory(name) {
  const clean = name.toLowerCase().trim().replace(/\s+/g, '-');
  if (!clean) return Promise.resolve();
  const cats = state.project_context.categories || [];
  if (cats.includes(clean)) { showToast(`Category "${clean}" already exists.`, 'info'); return Promise.resolve(); }
  state.project_context.categories = [...cats, clean];
  markContextDirty();
  renderCategoryChips();
  const catItems = getCategoryItems();
  if (addFormDropdown) addFormDropdown.setItems(catItems);
  if (editFormDropdown) editFormDropdown.setItems(catItems);
  renderFilters();
  return Promise.resolve();
}

function deleteCategory(cat) {
  const count = state.memories.filter(m => m.category === cat).length;
  state.project_context.categories = state.project_context.categories.filter(c => c !== cat);
  state.memories.forEach(m => { if (m.category === cat) m.category = 'general'; });
  markContextDirty();
  renderCategoryChips();
  const catItems = getCategoryItems();
  if (addFormDropdown) addFormDropdown.setItems(catItems);
  if (editFormDropdown) editFormDropdown.setItems(catItems);
  renderFilters();
  renderMemories();
  if (count > 0) showToast(`"${cat}" deleted. ${count} memor${count === 1 ? 'y' : 'ies'} moved to General.`, 'info');
}
```

- [ ] **Step 6: Wire add category input/button in `public/app.js`**

```javascript
elAddCategoryBtn.addEventListener('click', () => {
  const val = elCategoryInput.value.trim();
  if (val) { addCategory(val); elCategoryInput.value = ''; }
});
elCategoryInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); const val = elCategoryInput.value.trim(); if (val) { addCategory(val); elCategoryInput.value = ''; } }
});
```

- [ ] **Step 7: Call `renderCategoryChips()` from `renderContext()`**

At end of `renderContext()`, before `lucide.createIcons()`:
```javascript
renderCategoryChips();
```

- [ ] **Step 8: Verify** — 4 boxes in context panel. Can add category, chip appears, dropdowns update. Can delete non-general category, orphan memories move to General.

- [ ] **Step 9: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "feat: category management panel with CRUD and inline dropdown creation"
```

---

### Task 7: Auto-Save Context

**Files:**
- Modify: `public/index.html` — replace save button with status indicator
- Modify: `public/style.css` — indicator styles
- Modify: `public/app.js` — debounce auto-save, replace `markContextDirty()`

- [ ] **Step 1: Replace save button HTML in `public/index.html`**

Replace:
```html
<button id="save-context-btn" class="btn-secondary btn-save-indicator">
  <i data-lucide="save"></i> Save Context changes
</button>
```
With:
```html
<div class="autosave-indicator" id="autosave-indicator">
  <i data-lucide="check-circle-2" id="autosave-icon"></i>
  <span id="autosave-text">Saved</span>
</div>
```

- [ ] **Step 2: Add indicator CSS to `public/style.css`**

```css
.autosave-indicator {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-family: var(--font-display); font-weight: 500;
  color: var(--text-muted);
  transition: color 0.3s ease, opacity 0.3s ease;
  opacity: 0.5;
}
.autosave-indicator i { width: 14px; height: 14px; }
.autosave-indicator.unsaved { color: var(--accent-amber); opacity: 1; }
.autosave-indicator.saving  { color: var(--accent-primary); opacity: 1; }
.autosave-indicator.saved   { color: var(--neon-emerald); opacity: 0.8; }
.autosave-indicator.error   { color: var(--neon-rose); opacity: 1; }
@keyframes spin { to { transform: rotate(360deg); } }
.autosave-indicator.saving i { animation: spin 1s linear infinite; }
```

- [ ] **Step 3: Update DOM references in `public/app.js`**

Remove: `const elSaveContextBtn = document.getElementById('save-context-btn');`

Add:
```javascript
const elAutosaveIndicator = document.getElementById('autosave-indicator');
const elAutosaveIcon      = document.getElementById('autosave-icon');
const elAutosaveText      = document.getElementById('autosave-text');
```

- [ ] **Step 4: Add debounce utility and `setAutosaveState()` to `public/app.js`**

Add before `init()`:
```javascript
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function setAutosaveState(s) {
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
    if (res.ok) { setAutosaveState('saved'); await fetchStatus(); }
    else throw new Error();
  } catch { setAutosaveState('error'); }
}, 2000);
```

- [ ] **Step 5: Replace `markContextDirty()` in `public/app.js`**

```javascript
function markContextDirty() {
  state.isContextDirty = true;
  setAutosaveState('unsaved');
  debouncedAutoSave();
}
```

- [ ] **Step 6: Remove old save button listener**

Delete: `elSaveContextBtn.addEventListener('click', saveContext);`

- [ ] **Step 7: Verify** — Add a tech badge. Indicator shows "Unsaved changes" → 2s later "Saving…" → "Saved ✓". No manual save button visible.

- [ ] **Step 8: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "feat: debounced auto-save replaces manual save button"
```

---

### Task 8: Undo Delete

**Files:**
- Modify: `public/index.html` — undo toast HTML
- Modify: `public/style.css` — undo toast styles
- Modify: `public/app.js` — soft-delete logic, `pendingDeletes` Map

- [ ] **Step 1: Add undo toast HTML to `public/index.html`** (after existing toast div)

```html
<div class="undo-toast" id="undo-toast">
  <div class="undo-toast-row">
    <span id="undo-toast-message">Memory deleted</span>
    <button type="button" id="undo-toast-btn">Undo</button>
  </div>
  <div class="undo-progress-bar">
    <div class="undo-progress-fill" id="undo-progress-fill"></div>
  </div>
</div>
```

- [ ] **Step 2: Add undo toast CSS to `public/style.css`**

```css
.undo-toast {
  position: fixed; bottom: 72px; right: 24px;
  background: var(--bg-card); backdrop-filter: blur(12px);
  border: 1px solid rgba(121,213,233,0.15); border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  display: flex; flex-direction: column; gap: 10px;
  z-index: 200; min-width: 240px;
  transform: translateY(120px); opacity: 0;
  transition: transform 0.4s var(--ease-fast), opacity 0.4s ease;
}
.undo-toast.active { transform: translateY(0); opacity: 1; }
.undo-toast-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.undo-toast-row span { font-size: 13px; font-weight: 500; color: var(--text-primary); }
#undo-toast-btn {
  background: rgba(121,213,233,0.1); border: 1px solid rgba(121,213,233,0.25);
  border-radius: 6px; color: var(--accent-primary);
  padding: 4px 10px; font-size: 12px; font-weight: 600;
  font-family: var(--font-display); cursor: pointer; white-space: nowrap;
  transition: background 0.2s ease;
}
#undo-toast-btn:hover { background: rgba(121,213,233,0.2); }
.undo-progress-bar { width: 100%; height: 2px; background: rgba(255,255,255,0.06); border-radius: 1px; overflow: hidden; }
.undo-progress-fill { height: 100%; background: var(--accent-primary); width: 100%; transform-origin: left; }
```

- [ ] **Step 3: Add `pendingDeletes` and undo logic to `public/app.js`**

Add after the `state` object definition:
```javascript
const pendingDeletes = new Map(); // id → { memory, timeoutId }
```

Add DOM references:
```javascript
const elUndoToast        = document.getElementById('undo-toast');
const elUndoToastMessage = document.getElementById('undo-toast-message');
const elUndoToastBtn     = document.getElementById('undo-toast-btn');
const elUndoProgressFill = document.getElementById('undo-progress-fill');
```

Add `showUndoToast()`:
```javascript
function showUndoToast(ids, snapshots, message) {
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
    } catch { showToast('Delete failed — memory may still exist.', 'error'); }
  }, 5000);

  ids.forEach((id, i) => pendingDeletes.set(id, { memory: snapshots[i], timeoutId }));
}

elUndoToastBtn.addEventListener('click', () => {
  pendingDeletes.forEach(({ memory, timeoutId }) => {
    clearTimeout(timeoutId);
    state.memories.push(memory);
  });
  pendingDeletes.clear();
  elUndoToast.classList.remove('active');
  state.memories.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  renderMemories(); renderFilters();
  showToast('Delete undone.', 'success');
});
```

- [ ] **Step 4: Replace `deleteMemory()` in `public/app.js`**

```javascript
async function deleteMemory(id) {
  const snap = state.memories.find(m => m.id === id);
  if (!snap) return;
  state.memories = state.memories.filter(m => m.id !== id);
  const card = elMemoriesGrid.querySelector(`.memory-card[data-id="${id}"]`);
  if (card) { card.classList.add('deleting'); setTimeout(() => { renderMemories(); renderFilters(); }, 300); }
  else { renderMemories(); renderFilters(); }
  showUndoToast([id], [snap], 'Memory deleted');
}
```

- [ ] **Step 5: Verify** — Click delete: card animates out, undo toast slides up with shrinking bar. Click Undo: memory reappears. Wait 5s: memory stays deleted. No `confirm()` dialog ever fires.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "feat: soft-delete with 5s undo toast, remove confirm() dialog"
```

---

### Task 9: Bulk Selection Mode

**Files:**
- Modify: `public/index.html` — select toggle, bulk toolbar
- Modify: `public/style.css` — bulk mode, floating toolbar
- Modify: `public/app.js` — bulk state, handlers

Requires Tasks 5 and 8 complete.

- [ ] **Step 1: Update memories section header HTML in `public/index.html`**

```html
<div class="memories-section-header">
  <div class="section-title-group">
    <h3><i data-lucide="database"></i> Stored Memory Blocks</h3>
    <span class="active-filters-pill" id="filter-status-text">Showing all memories</span>
  </div>
  <div class="memories-header-controls">
    <select id="sort-select" class="sort-select">
      <option value="newest">Newest first</option>
      <option value="oldest">Oldest first</option>
      <option value="category">Category A→Z</option>
      <option value="alpha">Text A→Z</option>
    </select>
    <button type="button" class="btn-secondary btn-select-toggle" id="bulk-select-toggle">
      <i data-lucide="square"></i><span> Select</span>
    </button>
  </div>
</div>
```

Note: sort select is included here; it will be wired in Task 10.

- [ ] **Step 2: Add floating bulk toolbar HTML to `public/index.html`** (before `</main>`)

```html
<div class="bulk-toolbar" id="bulk-toolbar">
  <span class="bulk-count" id="bulk-count">0 selected</span>
  <div class="bulk-actions">
    <div id="mount-bulk-category" class="custom-select-mount bulk-category-select"></div>
    <button type="button" class="bulk-delete-btn" id="bulk-delete-btn">
      <i data-lucide="trash-2"></i> Delete
    </button>
    <button type="button" class="btn-secondary" id="bulk-cancel-btn">Cancel</button>
  </div>
</div>
```

- [ ] **Step 3: Add bulk CSS to `public/style.css`**

```css
.memories-header-controls { display: flex; align-items: center; gap: 8px; }

.memories-bento-grid.bulk-mode .memory-card { cursor: pointer; }
.memory-card-checkbox {
  position: absolute; left: 16px; top: 20px;
  width: 18px; height: 18px;
  border: 1.5px solid rgba(121,213,233,0.25); border-radius: 5px;
  background: transparent; display: none;
  align-items: center; justify-content: center;
  transition: all 0.2s ease; pointer-events: none;
}
.bulk-mode .memory-card-checkbox { display: flex; }
.bulk-mode .memory-card { padding-left: 48px; }
.memory-card.selected .memory-card-checkbox { background: var(--accent-primary); border-color: var(--accent-primary); }
.memory-card.selected .memory-card-checkbox i { width: 11px; height: 11px; color: #0b0e14; }
.memory-card.selected { border-color: rgba(121,213,233,0.25); background: rgba(121,213,233,0.03); }

.bulk-toolbar {
  position: fixed; bottom: -100px; left: 50%; transform: translateX(-50%);
  background: rgba(12,17,26,0.96); backdrop-filter: blur(20px);
  border: 1px solid rgba(121,213,233,0.2); border-radius: 14px;
  padding: 12px 20px;
  display: flex; align-items: center; gap: 16px;
  z-index: 150; min-width: 380px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  transition: bottom 0.4s var(--ease-fast);
}
.bulk-toolbar.active { bottom: 24px; }
.bulk-count { font-size: 13px; font-weight: 600; font-family: var(--font-display); color: var(--accent-primary); white-space: nowrap; }
.bulk-actions { display: flex; align-items: center; gap: 8px; flex: 1; justify-content: flex-end; }
.bulk-category-select { min-width: 140px; }
.bulk-delete-btn {
  background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.25);
  border-radius: 10px; color: var(--neon-rose);
  padding: 8px 14px; font-size: 13px; font-weight: 600;
  font-family: var(--font-display); cursor: pointer;
  display: flex; align-items: center; gap: 6px;
  transition: background 0.2s ease;
}
.bulk-delete-btn:hover { background: rgba(244,63,94,0.2); }
.bulk-delete-btn i { width: 14px; height: 14px; }
.btn-select-toggle.active { border-color: rgba(121,213,233,0.3); color: var(--accent-primary); background: rgba(121,213,233,0.08); }
```

- [ ] **Step 4: Add bulk state and logic to `public/app.js`**

Add after `pendingDeletes`:
```javascript
let bulkMode = false;
const selectedIds = new Set();
let bulkCategoryDropdown = null;

const elBulkSelectToggle = document.getElementById('bulk-select-toggle');
const elBulkToolbar      = document.getElementById('bulk-toolbar');
const elBulkCount        = document.getElementById('bulk-count');
const elBulkDeleteBtn    = document.getElementById('bulk-delete-btn');
const elBulkCancelBtn    = document.getElementById('bulk-cancel-btn');

function updateBulkToolbar() {
  elBulkCount.textContent = `${selectedIds.size} selected`;
  elBulkToolbar.classList.toggle('active', selectedIds.size > 0);
}

function enterBulkMode() {
  bulkMode = true; selectedIds.clear();
  elBulkSelectToggle.classList.add('active');
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
  bulkMode = false; selectedIds.clear();
  elBulkSelectToggle.classList.remove('active');
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
  renderMemories(); renderFilters();
  showUndoToast(ids, snaps, `${ids.length} memories deleted`);
}

async function bulkRecategorize(category) {
  const ids = [...selectedIds];
  try {
    await Promise.all(ids.map(id => {
      const mem = state.memories.find(m => m.id === id);
      return fetch('/api/memories', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, fact: mem?.fact || '', category })
      });
    }));
    await fetchMemories();
    exitBulkMode();
    showToast(`${ids.length} memories moved to ${category}.`, 'success');
  } catch { showToast('Bulk move failed.', 'error'); }
}

elBulkSelectToggle.addEventListener('click', () => bulkMode ? exitBulkMode() : enterBulkMode());
elBulkDeleteBtn.addEventListener('click', bulkDelete);
elBulkCancelBtn.addEventListener('click', exitBulkMode);
```

- [ ] **Step 5: Add checkbox element to card render in `renderMemories()`**

In the `card.innerHTML` template string, prepend a checkbox div as first child:
```javascript
card.innerHTML = `
  <div class="memory-card-checkbox"><i data-lucide="check"></i></div>
  <div class="memory-card-header">
  ...
`;
```

After the existing edit/delete event listeners on the card, add bulk click:
```javascript
card.addEventListener('click', (e) => {
  if (!bulkMode) return;
  if (e.target.closest('.act-edit') || e.target.closest('.act-delete')) return;
  selectedIds.has(m.id) ? selectedIds.delete(m.id) : selectedIds.add(m.id);
  card.classList.toggle('selected', selectedIds.has(m.id));
  updateBulkToolbar();
});
```

- [ ] **Step 6: Verify** — "Select" button toggles bulk mode. Cards show checkboxes on left, clicking selects them (teal highlight). Toolbar slides up from bottom. Delete fires undo toast. Move to category works.

- [ ] **Step 7: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "feat: bulk selection mode with delete and recategorize"
```

---

### Task 10: Sort Control

**Files:**
- Modify: `public/style.css` — sort select styles
- Modify: `public/app.js` — sort logic, localStorage

Note: The sort `<select>` HTML was added in Task 9 Step 1. This task wires the logic.

- [ ] **Step 1: Add sort select CSS to `public/style.css`**

```css
.sort-select {
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--border-glass);
  border-radius: 10px; color: var(--text-secondary);
  padding: 8px 28px 8px 12px;
  font-size: 12px; font-family: var(--font-body);
  cursor: pointer; transition: var(--transition-normal);
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234b5563' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 8px center;
}
.sort-select:focus { border-color: var(--accent-primary); outline: none; }
```

- [ ] **Step 2: Add sort state and logic to `public/app.js`**

Add to `state` object: `sortOrder: localStorage.getItem('memory-sort') || 'newest'`

Add DOM reference: `const elSortSelect = document.getElementById('sort-select');`

Add sort helper (before `renderMemories()`):
```javascript
function sortMemories(arr) {
  const s = [...arr];
  if (state.sortOrder === 'newest')   return s.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  if (state.sortOrder === 'oldest')   return s.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  if (state.sortOrder === 'category') return s.sort((a,b) => a.category.localeCompare(b.category));
  if (state.sortOrder === 'alpha')    return s.sort((a,b) => a.fact.localeCompare(b.fact));
  return s;
}
```

In `renderMemories()`, wrap the filtered array before rendering:
```javascript
const sorted = sortMemories(filtered);
// iterate `sorted` instead of `filtered` when creating cards
```

Add event listener (after other event listener declarations):
```javascript
elSortSelect.addEventListener('change', () => {
  state.sortOrder = elSortSelect.value;
  localStorage.setItem('memory-sort', state.sortOrder);
  renderMemories();
});
```

Initialize select value in `init()` after `fetchMemories()`:
```javascript
elSortSelect.value = state.sortOrder;
```

- [ ] **Step 3: Verify** — Sort dropdown changes card order. Preference survives page refresh.

- [ ] **Step 4: Commit**

```bash
git add public/style.css public/app.js
git commit -m "feat: sort control (newest/oldest/category/alpha) with localStorage"
```

---

### Task 11 [GEMINI]: Search Clear Button

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js`

- [ ] **Step 1: Update search group HTML in `public/index.html`**

```html
<div class="input-glow-group">
  <i data-lucide="search" class="input-icon"></i>
  <input type="text" id="search-input" placeholder="Search facts, tags, or categories...">
  <button type="button" class="search-clear-btn" id="search-clear-btn" aria-label="Clear search" style="display:none">
    <i data-lucide="x"></i>
  </button>
</div>
```

- [ ] **Step 2: Add clear button CSS to `public/style.css`**

```css
.search-clear-btn {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  color: var(--text-muted); display: flex; align-items: center;
  padding: 2px; border-radius: 4px; transition: color 0.2s ease;
}
.search-clear-btn:hover { color: var(--text-primary); }
.search-clear-btn i { width: 13px; height: 13px; }
```

- [ ] **Step 3: Add clear logic to `public/app.js`**

Add DOM reference: `const elSearchClearBtn = document.getElementById('search-clear-btn');`

Update existing search listener:
```javascript
elSearchInput.addEventListener('input', (e) => {
  state.filters.search = e.target.value;
  elSearchClearBtn.style.display = e.target.value ? 'flex' : 'none';
  renderMemories();
});
```

Add clear handler:
```javascript
elSearchClearBtn.addEventListener('click', () => {
  elSearchInput.value = '';
  state.filters.search = '';
  elSearchClearBtn.style.display = 'none';
  elSearchInput.focus();
  renderMemories();
});
```

- [ ] **Step 4: Verify** — Type in search: × appears. Click ×: clears and hides.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "feat: search clear (×) button"
```

---

### Task 12 [GEMINI]: Tag Autocomplete

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] **Step 1: Add datalist and wire to inputs in `public/index.html`**

Add before `</body>`:
```html
<datalist id="tags-datalist"></datalist>
```

Add `list="tags-datalist" autocomplete="off"` to `id="new-tags"` and `id="edit-tags"` inputs.

- [ ] **Step 2: Add `refreshTagsDatalist()` to `public/app.js`**

```javascript
function refreshTagsDatalist() {
  const dl = document.getElementById('tags-datalist');
  if (!dl) return;
  const tags = new Set();
  state.memories.forEach(m => m.tags.forEach(t => tags.add(t)));
  dl.innerHTML = [...tags].sort().map(t => `<option value="${t}">`).join('');
}
```

Call `refreshTagsDatalist()` at the end of `fetchMemories()`.

- [ ] **Step 3: Verify** — In tags input, type a partial tag from existing memories — browser suggests completions.

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/app.js
git commit -m "feat: tag autocomplete via datalist"
```

---

### Task 13 [GEMINI]: Stagger Entrance + Metric Counter

**Files:**
- Modify: `public/index.html` — stagger classes on metric cards
- Modify: `public/style.css` — stagger delays, metric card animation
- Modify: `public/app.js` — counter animation, per-card stagger delay

- [ ] **Step 1: Add stagger classes to metric cards in `public/index.html`**

```html
<div class="metric-card glass-card stagger-1">
<div class="metric-card glass-card stagger-2">
<div class="metric-card glass-card stagger-3">
```

- [ ] **Step 2: Add stagger CSS to `public/style.css`**

```css
.stagger-1 { animation-delay: 100ms; }
.stagger-2 { animation-delay: 200ms; }
.stagger-3 { animation-delay: 300ms; }

.metric-card      { animation: cardFadeIn 0.5s var(--ease-fast) both; }
.context-editor-card { animation: cardFadeIn 0.5s var(--ease-fast) 400ms both; }
.search-filter-card  { animation: cardFadeIn 0.5s var(--ease-fast) 150ms both; }
.add-memory-card     { animation: cardFadeIn 0.5s var(--ease-fast) 250ms both; }
```

- [ ] **Step 3: Add `animateCounter()` to `public/app.js`** (before `init()`)

```javascript
function animateCounter(el, target, duration = 600) {
  const to = parseInt(target, 10) || 0;
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
    el.textContent = Math.round(to * eased);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
```

- [ ] **Step 4: Update `fetchStatus()` to use `animateCounter()`**

Replace the three `elStatX.textContent = data.stats.X` lines with:
```javascript
animateCounter(elStatMemories,   data.stats.memories_count);
animateCounter(elStatCategories, data.stats.categories_count);
animateCounter(elStatTags,       data.stats.tags_count);
```

- [ ] **Step 5: Add per-card stagger in `renderMemories()`**

In the `sorted.forEach((m, index) => {` loop, add after `card.className = ...`:
```javascript
card.style.animationDelay = `${Math.min(index, 7) * 50}ms`;
```

- [ ] **Step 6: Verify** — On load: metric numbers count up from 0. Metric cards appear 100ms apart. Memory cards cascade in 50ms apart (first 8 only).

- [ ] **Step 7: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "feat: staggered entrance animations and metric counter animation"
```

---

### Task 14 [GEMINI]: Sliding Category Tab Indicator

**Files:**
- Modify: `public/style.css`
- Modify: `public/app.js`

- [ ] **Step 1: Update `.category-tabs` CSS for relative positioning**

```css
.category-tabs {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}
```

- [ ] **Step 2: Add tab indicator CSS**

```css
.tab-indicator {
  position: absolute; left: 0; right: 0;
  background: rgba(121,213,233,0.07);
  border: 1px solid rgba(121,213,233,0.18);
  border-radius: 10px; pointer-events: none;
  transition: top 0.25s cubic-bezier(0.16,1,0.3,1), height 0.25s cubic-bezier(0.16,1,0.3,1);
  z-index: 0;
}
.cat-tab {
  position: relative; z-index: 1;
  /* existing styles… */
}
.cat-tab.active {
  background: none;
  border-color: transparent;
  color: var(--accent-primary);
  font-weight: 600;
}
```

- [ ] **Step 3: Add `updateTabIndicator()` to `public/app.js`**

```javascript
function updateTabIndicator() {
  const active = elCategoryTabs.querySelector('.cat-tab.active');
  const indicator = elCategoryTabs.querySelector('.tab-indicator');
  if (!active || !indicator) return;
  indicator.style.top    = `${active.offsetTop}px`;
  indicator.style.height = `${active.offsetHeight}px`;
}
```

- [ ] **Step 4: Inject indicator element and call updater in `renderFilters()`**

After `elCategoryTabs.innerHTML = categoryTabsHtml`, add:
```javascript
if (!elCategoryTabs.querySelector('.tab-indicator')) {
  const ind = document.createElement('div');
  ind.className = 'tab-indicator';
  elCategoryTabs.appendChild(ind);
}
requestAnimationFrame(updateTabIndicator);
```

- [ ] **Step 5: Verify** — Click category tabs: teal pill slides smoothly to new active tab instead of jumping.

- [ ] **Step 6: Commit**

```bash
git add public/style.css public/app.js
git commit -m "feat: sliding pill indicator for category tabs"
```

---

## Self-Review

**Spec coverage:**
- ✅ Teal palette → Tasks 1, 3
- ✅ Syne/DM Sans/JetBrains Mono → Task 1
- ✅ Mesh gradient bg → Task 2
- ✅ Card hover lift + glow → Task 4
- ✅ Spring modal → Task 4
- ✅ Custom dropdown → Task 5
- ✅ Category management panel + inline creation → Task 6
- ✅ Auto-save context → Task 7
- ✅ Undo delete / no confirm() → Task 8
- ✅ Bulk selection + toolbar → Task 9
- ✅ Sort control → Task 10
- ✅ Search clear → Task 11
- ✅ Tag autocomplete → Task 12
- ✅ Stagger entrance + counter → Task 13
- ✅ Sliding tab indicator → Task 14

**Type consistency:**
- `CustomDropdown` defined Task 5, used Tasks 6, 9 ✅
- `getCategoryItems()` defined Task 5, used Tasks 6, 9 ✅
- `addCategory()` defined Task 6, referenced Task 5 (stubbed until Task 6 done) ✅
- `pendingDeletes` defined Task 8, used Task 9 ✅
- `showUndoToast(ids, snaps, msg)` defined Task 8 — Task 9 calls same signature ✅
- `setAutosaveState()` defined Task 7, replaces `markContextDirty()` call pattern ✅
- `sortMemories()` defined Task 10, `state.sortOrder` added to state object ✅
- `animateCounter(el, target)` defined Task 13, called in `fetchStatus()` ✅

**Placeholder scan:** No TBDs, all code steps contain working code ✅

**Prerequisite ordering:**
- Tasks 1–4: independent, run in any order (or give all to Gemini)
- Task 5 must precede Tasks 6, 9
- Task 8 must precede Task 9
- Task 9 HTML (Step 1) adds the sort select; Task 10 wires it
- Tasks 11, 12, 13, 14: independent after Tasks 1–4
