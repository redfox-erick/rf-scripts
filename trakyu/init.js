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
gantt.config.row_height = 40;
gantt.config.bar_height = 24;
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
  window.zoom_in = function () { applyZoom(zoomIndex - 1); };
  window.zoom_out = function () { applyZoom(zoomIndex + 1); };
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

    applyColWidths(); // restore saved column widths before rendering

    try {
        gantt.init("gantt_here");
        console.log("[Gantt] gantt.init() OK");
    } catch(e) {
        console.error("[Gantt] gantt.init() FAILED:", e);
        return;
    }

    // --- Fullscreen button ---
    (function() {
        var container = document.getElementById("gantt_here");
        container.style.position = "relative"; // needed for absolute button positioning

        var btn = document.createElement("button");
        btn.id = "gantt-fullscreen-btn";
        btn.textContent = "⛶ Pantalla completa";
        container.appendChild(btn);

        btn.addEventListener("click", function() {
            if (!document.fullscreenElement) {
                container.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        });

        document.addEventListener("fullscreenchange", function() {
            btn.textContent = document.fullscreenElement ? "✕ Salir" : "⛶ Pantalla completa";
            gantt.render(); // reflow after resize
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
}

console.log("[Gantt] readyState at script execution:", document.readyState);
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGantt);
} else {
    initGantt();
}