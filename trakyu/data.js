// Archivo para manejar los datos dinámicos del Gantt

// Esperar que Bubble proporcione los datos dinámicamente
// Fix #4: exposed as window.ganttData so init.js can call gantt.parse() after gantt.init()
window.ganttData = {
  data: window.BUBBLE_GANTT_DATA || [], // Bubble debe definir esta variable global
  links: window.BUBBLE_GANTT_LINKS || [] // Bubble debe definir esta variable global
};

// Validate Gantt data before parsing
const validateDates = (tasks) => {
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
// This avoids the race condition where refreshing the HTML element re-parses stale data.
window.refreshGanttData = function() {
    var scroll = gantt.getScrollState();

    var fresh = {
        data:  window.BUBBLE_GANTT_DATA  || [],
        links: window.BUBBLE_GANTT_LINKS || []
    };

    gantt.clearAll();
    gantt.parse(fresh);

    // Restore open task state and scroll position after re-parse
    if (typeof restoreOpenTasks === "function") restoreOpenTasks();
    setTimeout(function() { gantt.scrollTo(scroll.x, scroll.y); }, 0);
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