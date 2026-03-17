// Archivo para manejar los datos dinámicos del Gantt

// Datos de ejemplo (reemplazar con datos dinámicos de Bubble)
const ganttData = {
  data: [
    // Aquí se deben cargar las tareas dinámicamente desde Bubble
    // Ejemplo:
    // { id: 1, text: "Tarea 1", start_date: "2023-03-01", end_date: "2023-03-05", progress: 0.5 },
  ],
  links: [
    // Aquí se deben cargar los enlaces dinámicamente desde Bubble
    // Ejemplo:
    // { id: 1, source: 1, target: 2, type: "0" },
  ]
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