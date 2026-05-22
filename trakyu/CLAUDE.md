# Project Context — Trakyu Gantt

## Language conventions
- **Frontend UI** (button labels, tooltips, messages shown to users): **Spanish**
- **Code** (variable names, function names, comments, console logs): **English**
- **Conversations with the agent**: **English**

---

## Problem

We have a **Bubble** application implementing a Gantt chart using the **DHTMLX Gantt Pro** plugin. Bubble's built-in code editor is uncomfortable for maintaining non-trivial JavaScript, making the codebase hard to scale.

---

## Solution

All Gantt logic lives in **external static files** (JS/CSS) hosted outside Bubble. Bubble is only responsible for:
- Rendering the container div (`#gantt_here`)
- Passing dynamic data via `window.BUBBLE_GANTT_DATA` and `window.BUBBLE_GANTT_LINKS`
- Calling `bubble_fn_*` functions when the Gantt signals a change

---

## File structure

| File | Purpose |
|---|---|
| `init.js` | Gantt configuration, column setup, toolbar, `initGantt()` entry point |
| `data.js` | Sets `window.ganttData`, dispatches `ganttDataReady`, search/filter logic, `refreshGanttData()` |
| `functions.js` | Bubble callback wrappers, debounce queue, scroll preservation, dependency toast, tooltips |
| `styles.css` | All custom styles (toolbar, columns, overlays, toasts) |
| `scurve.js` | S-curve overlay logic |
| `baselines.js` | Baseline bar rendering |
| `dhtmlxgantt.js` / `dhtmlxgantt.css` | DHTMLX Gantt Pro library files |

---

## Architecture — how Bubble connects

```html
<!-- Bubble sets data before scripts run -->
<script>
  window.BUBBLE_GANTT_DATA  = [/* tasks from Bubble expression */];
  window.BUBBLE_GANTT_LINKS = [/* links from Bubble expression */];
  document.dispatchEvent(new CustomEvent("ganttDataReady"));
</script>

<!-- External files loaded via Bubble HTML elements -->
<script src="https://.../init.js"></script>
<script src="https://.../functions.js"></script>
```

Bubble workflows call `window.refreshGanttData(tasks, links)` after create/update/delete operations to re-parse fresh data without re-initializing.

---

## Lessons learned

### 1. Bubble re-renders HTML elements when their data source changes
When `bubble_fn_updateTask` triggers a workflow that saves a Thing, Bubble detects the data changed and re-renders the HTML element that has that Thing as its data source. This re-executes the scripts, causing:
- Full Gantt re-initialization (init, parse, S-curve, baselines)
- `SyntaxError: Identifier already declared` for any top-level `const` or `let`

**Rule: all top-level identifiers in scripts Bubble may re-execute must use `var`, never `const` or `let`.**

### 2. Load order between Bubble HTML elements is not guaranteed
When code is split across multiple HTML elements (e.g. `data.js` and `init.js`), both execute simultaneously with no guaranteed order. The correct pattern is a **custom event handshake**:
- The data element sets `window.ganttData` then dispatches `ganttDataReady`
- The init element checks if `window.ganttData` already exists (data arrived first) or listens for the event (init arrived first)
- A 3-second timeout fallback attempts initialization with `window.BUBBLE_GANTT_DATA` directly if the event never fires

### 3. `onAfterTaskUpdate` fires twice when auto-scheduling is active
When a user drags a task that has dependencies, DHTMLX fires `onAfterTaskUpdate` twice:
1. With the position where the user dropped the task
2. With the position corrected by auto-scheduling

The second call sends the correct data to Bubble, but both calls go through. This is mitigated by the debounce queue (last-write-wins collapses them into one).

### 4. Rapid user changes saturate Bubble workflows
Repeated drags, resizes, or quick edits fire multiple `bubble_fn_updateTask` calls in a short window, slowing Bubble down significantly.

**Solution: `_queueBubble(key, fn, payload)` debounce queue with a 600ms window. Updates to the same task ID collapse into one call. On flush, a "Guardando…" overlay blocks interaction for 1.2s.**

---

## Implemented features

1. **DHTMLX Gantt Pro integration** — auto-scheduling, undo/redo enabled; Pro library files in repo.

2. **Data validation** — `data.js` validates `start_date` / `end_date` on every parse; errors logged to console.

3. **Tooltip refactor** — `tooltipManager` in `functions.js` lazily initializes and handles show/hide with delay.

4. **Dynamic columns with resize** — `keep_grid_width = false`, per-column `resize: true`. Widths persisted in localStorage under `trakyu_col_widths`, restored before `gantt.init()`.

5. **Fullscreen** — native browser `requestFullscreen` / `exitFullscreen`. Button label toggles; `gantt.render()` called on `fullscreenchange`.

6. **S-curve overlay** — `scurve.js` uses DHTMLX overlay plugin + Chart.js 2.7.3. Shows Planned, Actual, Projected lines. Gantt bars fade to 40% opacity when active.

7. **Column show/hide** — toolbar dropdown with checkboxes. `text` always visible; toggleable: `start_date`, `end_date`, `duration`, `avance`, `add`. State persisted in localStorage under `trakyu_col_visibility`.

8. **Finish-to-Start dependencies** — `drag_links = true`, `drag_progress = false`. `onBeforeLinkAdd` rejects non-FS types. Link create/update/delete sync to Bubble via `bubble_fn_createLink`, `bubble_fn_updateLink`, `bubble_fn_deleteLink`.

9. **Dependency conflict toast** — `showGanttToast(msg)` injects `#gantt-toast` into `#gantt_here`. Top-right, red background, auto-removes after 4s. Fires on `onAfterAutoSchedule` (task adjusted > 1 day) and `onAutoScheduleCircularLink`.

10. **Bubble call debounce queue** — `_queueBubble(key, fn, payload)` wraps all `bubble_fn_*` calls. 600ms debounce window, last-write-wins per task ID. Delete cancels any pending create/update for the same ID. Flush shows "Guardando…" overlay for 1.2s. Covers: `createTask`, `updateTask`, `deleteTask`, `createLink`, `updateLink`, `deleteLink`.

11. **data.js / init.js load coordination** — `data.js` dispatches `ganttDataReady` after setting `window.ganttData`. `init.js` checks for existing data or waits for the event. 3-second fallback if event never fires.

---

## Pending tasks

_None._

---

## Completed tasks

### ✅ P1 — MS Project `sort_order` import and persistence

- Bubble: `index` field (decimal) added to Task type, populated from MS Project `ID` on import.
- Bubble queries sort by `index` ascending.
- `gantt.sort()` removed — order comes entirely from the data array order.
- `order_branch = true` enables drag-to-reorder within the same parent level.
- `onAfterRowReorder` uses fractional indexing (midpoint between neighbors) so only the moved task needs a Bubble update.
- Bubble function: `bubble_fn_reorderTask(output1: bubble_id, output2: new_index)`.
- Tasks include `bubble_id` field in `BUBBLE_GANTT_DATA` for the reorder callback.
