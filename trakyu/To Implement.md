# 📋 To Implement — Trakyu Gantt

Features to implement one by one. Update status when done, then update `contexto.md`.

---

## Status legend
- ⬜ Pending
- 🔄 In progress
- ✅ Done

---

## Features

### 1. ⬜ Columnas dinámicas — resize de columnas
Allow the user to resize all grid columns by dragging.
- All columns should be resizable (none fixed).
- Save column widths per user using `localStorage` (no backend needed, zero cost).
- On load, restore saved widths if they exist.

### 2. ⬜ Pantalla completa
Toggle the Gantt into fullscreen mode.
- **Pending clarification:** triggered by button inside the Gantt or from Bubble? Native browser Fullscreen API or viewport expansion?

### 3. ⬜ Curva S (Planned vs. Actual)
Display an S-curve showing cumulative planned progress vs. cumulative actual progress over time.
- **X axis:** time (dates).
- **Y axis:** cumulative progress % (0–100).
- **Planned line:** derived from task `start_date` / `end_date` (assumes linear daily progress per task).
- **Actual line:** derived from task `progress` field.
- Use DHTMLX's native overlay/chart capability if available; otherwise render as a custom SVG/canvas panel beneath or alongside the Gantt.
- **Open question:** confirm whether DHTMLX Pro exposes a native S-curve or just a resource histogram.

### 4. ⬜ Ocultar / mostrar columnas
Toggle visibility of individual grid columns.
- **`text` / title column is always visible** — all others are toggleable.
- Use DHTMLX native approach if possible (set `hide: true` on column + re-render); otherwise implement toggle UI in Bubble.
- Direct data manipulation → prefer Bubble side if needed.

### 5. ⬜ Dependencias (Finish-to-Start only)
Implement FS task links.
- Use DHTMLX native link drawing and UI.
- On link create/update/delete → call `bubble_fn_createLink`, `bubble_fn_updateLink`, `bubble_fn_deleteLink` (same pattern as tasks).
- Payload should include: `link id`, `source task id`, `target task id`, `type` (always `"0"` for FS).

### 6. ⬜ Actualizar tarea padre + auto-refresh de datos
Parent task update (start/end overflow) will be handled 100% on the Bubble backend.
- The Gantt needs a **data refresh mechanism** so that after Bubble updates the parent, the visual is updated without a full page reload.
- Implement a global `window.refreshGanttData()` function that Bubble can call via `Run JavaScript` to re-fetch `BUBBLE_GANTT_DATA` / `BUBBLE_GANTT_LINKS` and re-parse the Gantt in place.

### 7. ⬜ Baselines
Display task baselines on the Gantt bars (planned vs. actual bar position).
- DHTMLX Pro has a native baselines extension.
- **Blocked:** requires additional data fields and workflow changes on the Bubble side before implementation here.
- Will be scoped once Bubble side is defined.
