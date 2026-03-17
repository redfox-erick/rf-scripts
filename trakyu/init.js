// Configuración inicial del Gantt

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
gantt.config.row_height = 40;
gantt.config.bar_height = 24;
gantt.config.date_format = "%Y-%m-%d %H:%i";
gantt.config.work_time = false; 

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
  {name: "text", align: "left", label: "Descripción", tree: true, width: "*", min_width: 250},
  {name: "start_date", label: "Inicio", width: 125, align: "center"},
  {name: "end_date", label: "Fin", width: 125, align: "center"},
  {
    name: "avance", label: "Avance", align: "center", width: 130,
    template: function(task){
      const porcentaje = calcularAvance(task);
      return porcentaje + "%";
    }
  },
  {
    name: "completar", 
    label: "", 
    width: 50, 
    align: "center", 
    template: function(task) {
      if (gantt.hasChild(task.id) || isCompleted(task)) return "";
      return "<div class='completar-container'><button class='btn-check-circle' onclick='confirmCompletion(\"" + task.id + "\")'>✓</button></div>";
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
    gantt.init("gantt_here");
    gantt.parse(window.ganttData);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGantt);
} else {
    initGantt();
}