// Archivo para manejar los datos dinámicos del Gantt
console.log("[Gantt] data.js loaded — BUBBLE_GANTT_DATA length:", (window.BUBBLE_GANTT_DATA || []).length);

window.ganttData = {
  data: window.BUBBLE_GANTT_DATA || [],
  links: window.BUBBLE_GANTT_LINKS || []
};

// Signal init.js that data is ready (handles the case where data.js loads after init.js)
console.log("[Gantt] dispatching ganttDataReady");
document.dispatchEvent(new CustomEvent("ganttDataReady"));

// Validate Gantt data before parsing
var validateDates = function(tasks) {
  tasks.forEach(task => {
    if (!task.start_date || isNaN(new Date(task.start_date).getTime())) {
      console.error(`Invalid start_date for task ID ${task.id}:`, task.start_date);
    }
    if (!task.end_date || isNaN(new Date(task.end_date).getTime())) {
      console.error(`Invalid end_date for task ID ${task.id}:`, task.end_date);
    }
  });
};

// Validate data before parsing
gantt.attachEvent("onBeforeParse", function(data) {
  if (data && data.data) validateDates(data.data);
  return true; // Continue parsing
});

// gantt.parse() is now called in init.js after gantt.init() — see Fix #4

// --- Data refresh (#6) ---
// Bubble calls this via "Run JavaScript" AFTER a workflow completes (create/update/delete task or link).
// Pass tasks and links directly from Bubble's expression to avoid reading stale window globals.
// Usage: refreshGanttData(BUBBLE_GANTT_DATA, BUBBLE_GANTT_LINKS)
window.refreshGanttData = function(tasks, links) {
    var scroll = gantt.getScrollState();
    var fresh = {
        data:  tasks || window.BUBBLE_GANTT_DATA  || [],
        links: links || window.BUBBLE_GANTT_LINKS || []
    };

    gantt.clearAll();
    gantt.parse(fresh);

    if (typeof restoreOpenTasks === "function") restoreOpenTasks();
    // Restore scroll after restoreOpenTasks (which calls gantt.render internally)
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