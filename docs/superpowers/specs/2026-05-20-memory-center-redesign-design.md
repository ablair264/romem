# Project Memory Center — Full Redesign & Feature Enhancement

**Date:** 2026-05-20  
**Scope:** Visual redesign + UX features for `public/` frontend (3 files)  
**Backend:** No changes to `gui.js` or `index.js`

---

## 1. Design System

### Palette
Replace all purple/violet/fuchsia tokens. Align with Splitfin teal brand language.

```css
--bg-main:         #0b0e14
--bg-card:         rgba(15, 20, 30, 0.72)
--bg-card-hover:   rgba(18, 25, 38, 0.85)
--border-glass:    rgba(121, 213, 233, 0.08)
--border-active:   rgba(121, 213, 233, 0.3)

--accent-primary:  #79d5e9   /* electric teal */
--accent-deep:     #4daeac   /* deeper teal */
--accent-amber:    #f59e0b   /* TODO/warning */
--neon-emerald:    #10b981   /* success/active */
--neon-rose:       #f43f5e   /* delete/error */

--text-primary:    #ffffff
--text-secondary:  #94a3b8
--text-muted:      #4b5563
```

Background: animated mesh gradient (teal-shifted, `background-size: 300% 300%`, `animation: gradientShift 20s ease infinite`) replacing the blurry purple orbs.

### Typography
```css
--font-display: 'Syne', sans-serif       /* headers, metric values, buttons */
--font-body:    'DM Sans', sans-serif    /* card text, labels, body */
--font-mono:    'JetBrains Mono', monospace  /* tags, paths, category badges */
```
Google Fonts import: `Syne:wght@400;600;700;800` + `DM+Sans:wght@400;500;600` + `JetBrains+Mono:wght@400;500`

### Spacing & Radius
- Cards: `border-radius: 16px` (from 20px)
- Inputs: `border-radius: 10px` (from 12px)
- Tags/badges: `border-radius: 6px`
- Buttons: `border-radius: 10px`

---

## 2. Motion & Animations

### Page Load Stagger
Entrance animation sequence using `animation-delay`:
1. Header: 0ms
2. Metric cards: 100ms, 200ms, 300ms
3. Context panel: 400ms
4. Memory cards: 50ms per card (capped at 8 staggered, rest at 400ms)

### Metric Counter
Numbers count up from 0 on load. Duration: 600ms, `easeOutExpo`. Pure JS `requestAnimationFrame` loop.

### Category Tab Indicator
Sliding teal pill that translates between active tabs. Uses `getBoundingClientRect()` to position. Animates with `transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1)`.

### Memory Cards
- **Enter:** `translateY(16px) opacity(0) → translateY(0) opacity(1)`, staggered
- **Hover:** `translateY(-2px)` + border color → `rgba(121,213,233,0.25)` + glow `0 0 0 1px rgba(121,213,233,0.15)`
- **Delete:** `transform: scaleX(0) → opacity: 0` (300ms), then grid reflow

### Custom Dropdown
`max-height: 0 → max-height: 240px` + `opacity: 0 → 1` on open. `overflow: hidden`. No layout jump.

### Modal
Spring entrance: `scale(0.93) translateY(12px) → scale(1) translateY(0)`, teal border `rgba(121,213,233,0.2)`.

### Undo Toast
Slides up from `translateY(100px)` with 5-second shrinking progress bar (CSS `width` animation). "Undo" button cancels the hard-delete.

### New Card Added
Pop-in at grid top position: `scale(0.85) → scale(1)` + fade.

---

## 3. Features

### 3.1 Custom Dropdown Component
Replaces all 3 native `<select>` elements (add form, edit modal, sort control).

**Behavior:**
- Click trigger → panel opens below with smooth animation
- Keyboard: Arrow keys to navigate, Enter to select, Escape to close
- Click outside → closes
- Selected option shown in trigger with checkmark

**Inline category creation:**
- When user types a value not in the list, a "Create 'xyz' category" option appears at bottom
- Selecting it: adds category to `project_context.categories`, saves via `PUT /api/context`, refreshes dropdown options
- Backend already handles dynamic categories — no backend change needed

### 3.2 Custom Category Management Panel
Fourth box in the "High-Level Project Context" grid.

**Layout:**
```
[ Tech Stack ] [ Key Rules ] [ Architecture ] [ Categories ]
```

**Content:**
- Chip list of current categories with × to delete
- Text input to add new category (Enter to confirm)
- Deleting a category: shows count of affected memories, confirms inline (not `confirm()`), orphans reassign to General
- "general" category is protected — no × button shown

### 3.3 Bulk Selection Mode
**Toggle:** "Select" button in memories section header (shows checkbox icon + "Select").

**UX flow:**
1. Click "Select" → cards show checkboxes, cursor changes, mode indicator appears
2. Click cards to check/uncheck
3. Floating action toolbar appears at bottom of viewport when ≥1 selected:
   - "Delete X memories" (rose)
   - "Move to: [category dropdown]" (teal)
   - "Cancel" (neutral)
4. Bulk delete uses undo pattern (single undo toast for the batch)
5. Deselect all → toolbar hides, checkboxes hide

### 3.4 Auto-Save Context
Replace manual "Save Context changes" button with debounced auto-save.

**Behavior:**
- Any context change (tech badge add/remove, rule add/remove, architecture add/remove, category add/remove) triggers 2-second debounce timer
- During debounce: subtle status indicator shows "Unsaved changes"
- On save: shows "Saved ✓" for 2s then fades
- On error: shows "Save failed — retry" with retry button

**Status indicator location:** Top-right of the context panel header (replaces current "Save Context changes" button).

### 3.5 Undo Delete (Single Memory)
Replace `confirm()` browser dialog with soft-delete + undo toast.

**Flow:**
1. User clicks delete icon
2. Card immediately removes from DOM (optimistic UI)
3. Toast appears: "Memory deleted — Undo (5s)" with shrinking progress bar
4. If Undo clicked within 5s: memory re-inserts with pop-in animation, DELETE API call cancelled
5. If timer expires: `DELETE /api/memories?id=X` fires

**State:** `pendingDeletes` Map in app state (`id → { memory, timeoutId }`).

### 3.6 Search Clear Button
`×` button inside search input, visible only when `value.length > 0`. Clears input and resets search filter. Positioned right-aligned inside input using `position: absolute`.

### 3.7 Tag Autocomplete
`<datalist>` element populated with all unique tags from `state.memories`. Attached to tag inputs in both add form and edit modal. Refreshed on memory fetch.

### 3.8 Sort Control
Small custom dropdown in memories section header (right side).

**Options:** Newest first (default) / Oldest first / Category A→Z / Text A→Z

Sort applied client-side before `renderMemories()`. Sort preference persisted in `localStorage`.

---

## 4. File Change Map

| File | Scope of changes |
|---|---|
| `public/index.html` | Font imports (Syne, DM Sans, JetBrains Mono), sort dropdown HTML, bulk toolbar HTML, categories context box HTML, custom dropdown wrapper markup |
| `public/style.css` | Full palette swap, font vars, mesh gradient bg, all animation keyframes, custom dropdown styles, bulk toolbar styles, auto-save indicator, category chips, card hover/delete animations |
| `public/app.js` | `CustomDropdown` component class, `pendingDeletes` undo logic, `autoSaveContext` debounce, `bulkSelection` state + handlers, sort logic, category management handlers, tag datalist refresh, search clear, counter animation, stagger logic |
| `gui.js` | No changes |
| `index.js` | No changes |

---

## 5. Gemini-Safe Task Separation

Tasks marked **[GEMINI]** are self-contained, no shared state with other in-progress tasks, and safe to hand off.

**Not Gemini-safe (requires full context / inter-task dependencies):**
- Custom dropdown component (referenced by category management, add form, edit modal, sort)
- Auto-save debounce (depends on knowing the dirty-state model)
- Undo delete (requires knowing card render lifecycle)

---

## 6. Non-Goals

- No backend changes
- No responsive/mobile layout overhaul (keep existing breakpoint)
- No import/export feature
- No duplicate detection
- No keyboard shortcuts (`Cmd+K` quick-add) — out of scope for this pass
