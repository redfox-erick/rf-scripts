// Configuración inicial del Gantt
console.log("[Gantt] init.js loaded");

// Fix #1: Single plugins() call — second call was overwriting the first, losing quick_info/tool_tip/marker/export_api
gantt.plugins({ quick_info: true, tool_tip: true, marker: true, export_api: true, auto_scheduling: true, undo: true });

var today = new Date();
gantt.addMarker({
  start_date: today,
  css: "today",
  text: "Hoy",
  title: "Hoy: " + gantt.date.date_to_str(gantt.config.task_date)(today)
});

gantt.i18n.setLocale("es");
gantt.config.grid_width = 920;
gantt.config.keep_grid_width = false; // allow individual column resizing
gantt.config.row_height = 35;
gantt.config.bar_height = 20;
gantt.config.date_format = "%Y-%m-%d %H:%i";
gantt.config.work_time = false;

// --- Column width persistence ---
var COL_WIDTHS_KEY = "trakyu_col_widths";

function saveColWidths() {
  var widths = {};
  gantt.config.columns.forEach(function(col) {
    if (col.name) widths[col.name] = col.width;
  });
  localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(widths));
}

function applyColWidths() {
  var saved = localStorage.getItem(COL_WIDTHS_KEY);
  if (!saved) return;
  try {
    var widths = JSON.parse(saved);
    gantt.config.columns.forEach(function(col) {
      if (col.name && widths[col.name] !== undefined) {
        col.width = widths[col.name];
      }
    });
  } catch(e) {
    localStorage.removeItem(COL_WIDTHS_KEY); // discard corrupt data
  }
}

gantt.attachEvent("onColumnResizeEnd", function(index, column, newWidth) {
  saveColWidths();
  return true;
});

// --- Column visibility persistence ---
var COL_VISIBILITY_KEY = "trakyu_col_visibility";

// Columns the user can toggle (text is always visible)
var TOGGLEABLE_COLS = [
  { name: "start_date", label: "Inicio" },
  { name: "end_date",   label: "Fin" },
  { name: "avance",     label: "Avance" },
  { name: "add",        label: "Agregar" }
];

function saveColVisibility() {
  var state = {};
  gantt.config.columns.forEach(function(col) {
    if (col.name) state[col.name] = !col.hide;
  });
  localStorage.setItem(COL_VISIBILITY_KEY, JSON.stringify(state));
}

function applyColVisibility() {
  var saved = localStorage.getItem(COL_VISIBILITY_KEY);
  if (!saved) return;
  try {
    var state = JSON.parse(saved);
    gantt.config.columns.forEach(function(col) {
      if (col.name && state[col.name] !== undefined) {
        col.hide = !state[col.name];
      }
    });
  } catch(e) {
    localStorage.removeItem(COL_VISIBILITY_KEY);
  }
}

// --- Open task state persistence ---
var OPEN_TASKS_KEY = "trakyu_open_tasks";

function saveOpenTasks() {
  var openIds = [];
  gantt.eachTask(function(task) {
    if (task.$open) openIds.push(String(task.id));
  });
  localStorage.setItem(OPEN_TASKS_KEY, JSON.stringify(openIds));
}

function restoreOpenTasks() {
  var saved = localStorage.getItem(OPEN_TASKS_KEY);
  if (!saved) return;
  try {
    var openIds = JSON.parse(saved);
    var openSet = {};
    openIds.forEach(function(id) { openSet[id] = true; });
    gantt.eachTask(function(task) {
      if (gantt.hasChild(task.id)) {
        task.$open = !!openSet[String(task.id)];
      }
    });
    gantt.render();
  } catch(e) {
    localStorage.removeItem(OPEN_TASKS_KEY);
  }
}

gantt.attachEvent("onTaskOpened", function() { saveOpenTasks(); });
gantt.attachEvent("onTaskClosed", function() { saveOpenTasks(); });

gantt.config.layout = {
  css: "gantt_container",
  rows: [
    {
      cols: [
        { view: "grid", group: "vertical", scrollY: "scrollVer" },
        { resizer: true, width: 1 },
        {
          // Fix #2: scrollbar must come after the timeline, not before
          rows: [
            { view: "timeline", scrollX: "scrollHor", scrollY: "scrollVer" },
            { view: "scrollbar", id: "scrollHor", group: "horizontal" }
          ]
        },
        { view: "scrollbar", id: "scrollVer" }
      ]
    }
  ]
};

gantt.templates.task_class = function(start, end, task) {
  if (isCompleted(task)) return "task_completed";
  return "";
};

gantt.config.columns = [
  {name: "text", align: "left", label: "Descripción", tree: true, width: "*", min_width: 250, resize: true},
  {name: "start_date", label: "Inicio", width: 125, align: "center", resize: true},
  {name: "end_date", label: "Fin", width: 125, align: "center", resize: true},
  {
    name: "avance", label: "Avance", align: "center", width: 130, resize: true,
    template: function(task){
      const porcentaje = calcularAvance(task);
      return porcentaje + "%";
    }
  },
{name: "add", label:"", width: 40}
];

gantt.templates.task_text = function(start, end, task){
  return task.text;
};

(function () {
  var zoomLevels = [
    { name: "day", scales: [{ unit: "month", format: "%F - %Y" }, { unit: "day", format: "%D %j" }]},
    { name: "week", scales: [{ unit: "month", format: "%F - %Y" }, { unit: "week", format: "Sem %W" }]},
    { name: "month", scales: [{ unit: "year", format: "%Y" }, { unit: "month", format: "%M" }]}
  ];
  var zoomIndex = 0;
  window.applyZoom = function(i){
    zoomIndex = Math.max(0, Math.min(zoomLevels.length - 1, i));
    gantt.config.scales = zoomLevels[zoomIndex].scales;
    gantt.render();
  };
  window.zoom_in  = function() { applyZoom(zoomIndex - 1); };
  window.zoom_out = function() { applyZoom(zoomIndex + 1); };

  window.fitGantt = function() {
    var range = gantt.getSubtaskDates();
    if (!range.start_date || !range.end_date) return;

    var timelineEl = gantt.$task;
    if (!timelineEl) return;
    var timelineWidth = timelineEl.offsetWidth;

    var durationDays = Math.max(1, Math.ceil((range.end_date - range.start_date) / 86400000));

    // Pick the scale level that fits best
    var unit, levelIndex;
    if (durationDays <= 90) {
      unit = "day"; levelIndex = 0;
    } else if (durationDays <= 730) {
      unit = "week"; levelIndex = 1;
    } else {
      unit = "month"; levelIndex = 2;
    }

    // Count how many units span the project
    var numUnits = 0;
    var curr = gantt.date[unit + "_start"](new Date(range.start_date));
    while (curr < range.end_date) {
      curr = gantt.date.add(curr, 1, unit);
      numUnits++;
    }

    var colWidth = Math.max(1, Math.floor(timelineWidth / Math.max(numUnits, 1)));
    zoomIndex = levelIndex;
    gantt.config.scales = zoomLevels[levelIndex].scales;
    gantt.config.min_column_width = colWidth;
    gantt.render();
    // Reset min_column_width so manual zoom works normally afterward
    gantt.config.min_column_width = 80;
  };
})();

gantt.templates.timeline_cell_class = function (item, date) {
  if (date.getDay() == 0 || date.getDay() == 6) return "weekend";
};

gantt.attachEvent("onBeforeTaskDrag", function(id){ return !isCompleted(gantt.getTask(id)); });
gantt.attachEvent("onBeforeLightbox", function(id) { return !isCompleted(gantt.getTask(id)); });

// Add the license key for dhtmlX Gantt Pro
gantt.license = "40762312";

// Enable Pro features
gantt.config.auto_scheduling = true;
gantt.config.undo = true;

// In Bubble, DOMContentLoaded has already fired by the time HTML elements execute.
// Check readyState and run immediately if the DOM is already ready.
function initGantt() {
    console.log("[Gantt] initGantt() called");
    console.log("[Gantt] document.readyState:", document.readyState);
    console.log("[Gantt] #gantt_here exists:", !!document.getElementById("gantt_here"));
    console.log("[Gantt] window.ganttData:", window.ganttData);
    console.log("[Gantt] BUBBLE_GANTT_DATA:", window.BUBBLE_GANTT_DATA);
    console.log("[Gantt] BUBBLE_GANTT_LINKS:", window.BUBBLE_GANTT_LINKS);

    applyColWidths();      // restore saved column widths before rendering
    applyColVisibility(); // restore saved column visibility before rendering

    try {
        gantt.init("gantt_here");
        console.log("[Gantt] gantt.init() OK");
    } catch(e) {
        console.error("[Gantt] gantt.init() FAILED:", e);
        return;
    }

    // --- Floating controls ---
    (function() {
        var container = document.getElementById("gantt_here");
        container.style.position = "relative";

        // Fullscreen button
        var fsBtn = document.createElement("button");
        fsBtn.id = "gantt-fullscreen-btn";
        fsBtn.textContent = "⛶ Pantalla completa";
        container.appendChild(fsBtn);

        fsBtn.addEventListener("click", function() {
            if (!document.fullscreenElement) {
                container.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        });

        document.addEventListener("fullscreenchange", function() {
            fsBtn.textContent = document.fullscreenElement ? "✕ Salir" : "⛶ Pantalla completa";
            gantt.render();
        });

        // Zoom button group
        var zoomGroup = document.createElement("div");
        zoomGroup.id = "gantt-zoom-group";

        var zoomOut = document.createElement("button");
        zoomOut.className = "gantt-zoom-btn";
        zoomOut.textContent = "−";
        zoomOut.title = "Alejar";
        zoomOut.addEventListener("click", window.zoom_out);

        var zoomFit = document.createElement("button");
        zoomFit.className = "gantt-zoom-btn";
        zoomFit.textContent = "↔";
        zoomFit.title = "Ajustar a ventana";
        zoomFit.addEventListener("click", window.fitGantt);

        var zoomIn = document.createElement("button");
        zoomIn.className = "gantt-zoom-btn";
        zoomIn.textContent = "+";
        zoomIn.title = "Acercar";
        zoomIn.addEventListener("click", window.zoom_in);

        zoomGroup.appendChild(zoomOut);
        zoomGroup.appendChild(zoomFit);
        zoomGroup.appendChild(zoomIn);
        container.appendChild(zoomGroup);

        // Columns toggle button + dropdown
        var colBtn = document.createElement("button");
        colBtn.id = "gantt-col-btn";
        colBtn.textContent = "☰ Columnas";
        container.appendChild(colBtn);

        var colDropdown = document.createElement("div");
        colDropdown.id = "gantt-col-dropdown";
        colDropdown.style.display = "none";

        TOGGLEABLE_COLS.forEach(function(def) {
            var col = gantt.config.columns.find(function(c) { return c.name === def.name; });
            if (!col) return;

            var row = document.createElement("label");
            row.className = "gantt-col-row";

            var checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = !col.hide;
            checkbox.dataset.colName = def.name;

            checkbox.addEventListener("change", function() {
                var target = gantt.config.columns.find(function(c) { return c.name === this.dataset.colName; }, this);
                if (target) {
                    target.hide = !this.checked;
                    gantt.render();
                    saveColVisibility();
                }
            });

            row.appendChild(checkbox);
            row.appendChild(document.createTextNode(" " + def.label));
            colDropdown.appendChild(row);
        });

        container.appendChild(colDropdown);

        colBtn.addEventListener("click", function(e) {
            e.stopPropagation();
            colDropdown.style.display = colDropdown.style.display === "none" ? "block" : "none";
        });

        document.addEventListener("click", function() {
            colDropdown.style.display = "none";
        });
    })();

    // Fall back to raw Bubble globals if data.js hasn't set window.ganttData yet
    var dataToLoad = window.ganttData || {
        data: window.BUBBLE_GANTT_DATA || [],
        links: window.BUBBLE_GANTT_LINKS || []
    };
    console.log("[Gantt] dataToLoad:", dataToLoad);

    try {
        gantt.parse(dataToLoad);
        console.log("[Gantt] gantt.parse() OK — tasks loaded:", gantt.getTaskCount());
    } catch(e) {
        console.error("[Gantt] gantt.parse() FAILED:", e);
    }

    restoreOpenTasks();
    if (typeof initSCurve === "function") initSCurve();
}

console.log("[Gantt] readyState at script execution:", document.readyState);
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGantt);
} else {
    initGantt();
}