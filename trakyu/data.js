// Archivo para manejar los datos dinámicos del Gantt
console.log("[Gantt] data.js loaded — BUBBLE_GANTT_DATA length:", (window.BUBBLE_GANTT_DATA || []).length);
console.log("[Gantt] BUBBLE_GANTT_DATA sample (first 3):", (window.BUBBLE_GANTT_DATA || []).slice(0, 3));

// Fix: strip duration/$calculate_duration and override type:project so DHTMLX never recalculates end_date
(window.BUBBLE_GANTT_DATA || []).forEach(function(task) {
    delete task.duration;
    delete task.$calculate_duration;
    if (task.type === "project") task.type = "task";
});

window.ganttData = {
  data: window.BUBBLE_GANTT_DATA || [],
  links: window.BUBBLE_GANTT_LINKS || []
};
console.log("[Gantt] window.ganttData set:", window.ganttData);

// Validate Gantt data before parsing
var validateDates = function(tasks) {
  tasks.forEach(task => {
    if (!task.start_date || isNaN(new Date(task.start_date).getTime())) {
      console.error("Invalid start_date for task ID " + task.id + ":", task.start_date);
    }
    if (!task.end_date || isNaN(new Date(task.end_date).getTime())) {
      console.error("Invalid end_date for task ID " + task.id + ":", task.end_date);
    }
  });
};

// Validate data before parsing
gantt.attachEvent("onBeforeParse", function(data) {
  if (data && data.data) validateDates(data.data);
  return true;
});

// gantt.parse() is now called in init.js after gantt.init() — see Fix #4

// --- Data refresh (#6) ---
// Bubble calls this via "Run JavaScript" AFTER a workflow completes (create/update/delete task or link).
// Pass tasks and links directly from Bubble's expression to avoid reading stale window globals.
// Usage: refreshGanttData(BUBBLE_GANTT_DATA, BUBBLE_GANTT_LINKS)
window.refreshGanttData = function(tasks, links) {
    var scroll = gantt.getScrollState();
    var rawData = tasks || window.BUBBLE_GANTT_DATA || [];
    var fresh = {
        data: rawData.map(function(task) {
            var t = Object.assign({}, task);
            delete t.duration;
            delete t.$calculate_duration;
            if (t.type === "project") t.type = "task";
            return t;
        }),
        links: links || window.BUBBLE_GANTT_LINKS || []
    };
    gantt.clearAll();
    gantt.parse(fresh);
    if (typeof restoreOpenTasks === "function") restoreOpenTasks();
    gantt.scrollTo(scroll.x, scroll.y);
};

// Función para manejar la búsqueda dinámica
// Fix #5: track the event id so we can detach the previous handler before adding a new one
var _searchEventId = null;
function applySearch(busqueda) {
  if (busqueda) {
    gantt.eachTask(function(task) {
      if (task.text.toLowerCase().indexOf(busqueda.toLowerCase()) !== -1) {
        var curr = task;
        while (curr.parent && gantt.isTaskExists(curr.parent)) {
          var p = gantt.getTask(curr.parent);
          p.open = true;
          curr = p;
        }
      }
    });
  }
  // Detach previous handler to avoid accumulation
  if (_searchEventId !== null) {
    gantt.detachEvent(_searchEventId);
    _searchEventId = null;
  }
  _searchEventId = gantt.attachEvent("onBeforeTaskDisplay", function(id, task) {
    if (!busqueda) return true;
    if (task.text.toLowerCase().indexOf(busqueda.toLowerCase()) !== -1) return true;
    var hasVisibleChild = false;
    gantt.eachTask(function(child) {
      if (child.text.toLowerCase().indexOf(busqueda.toLowerCase()) !== -1) hasVisibleChild = true;
    }, id);
    return hasVisibleChild;
  });
  gantt.render();
}

// Dispatch at the very end so refreshGanttData is guaranteed to be defined when the listener runs
console.log("[Gantt] dispatching ganttDataReady");
document.dispatchEvent(new CustomEvent("ganttDataReady"));
