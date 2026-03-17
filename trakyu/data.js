// Archivo para manejar los datos dinámicos del Gantt

// Esperar que Bubble proporcione los datos dinámicamente
const ganttData = {
  data: window.BUBBLE_GANTT_DATA || [], // Bubble debe definir esta variable global
  links: window.BUBBLE_GANTT_LINKS || [] // Bubble debe definir esta variable global
};

gantt.parse(ganttData);

// Función para manejar la búsqueda dinámica
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

  gantt.attachEvent("onBeforeTaskDisplay", function(id, task) {
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