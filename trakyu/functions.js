// Create Tasks
gantt.attachEvent("onAfterTaskAdd", function(id, item) {
    // Create a JSON object with all necessary task information
    let taskData = {
        output1: id,
        output2: item.text, // Task name
        output3: item.start_date, // Start date
        output4: item.duration, // Duration
        outputlist1: [item.parent] // Parent Id
    };

    // Ensure the "JavaScript to Bubble" function is available
    if (typeof bubble_fn_createTask === "function") {
        // Convert the taskData to a JSON string and pass it to Bubble
        bubble_fn_createTask(taskData); 
    }
});

// Update Tasks
gantt.attachEvent("onAfterTaskUpdate", function(id, item) {
    // Create a JSON object with all necessary task information
    let updatedTaskData = {
        output1: id,
        output2: item.text, // Updated task name
        output3: item.start_date, // Updated start date
        output4: item.duration, // Updated duration
        outputlist1: [item.parent]
        // You can substitute or add fields as per what's being updated
    };

    // Ensure the "JavaScript to Bubble" function is available
    if (typeof bubble_fn_updateTask === "function") {
        // Pass the updated taskData object to Bubble
        bubble_fn_updateTask(updatedTaskData);
    }
});
    
// Delete Tasks
gantt.attachEvent("onAfterTaskDelete", function(id, item) {
    if (typeof bubble_fn_deleteTask === "function") {
    	bubble_fn_deleteTask(id);
    }
});

// Maintain scroll position after update
// Function to save the current scroll position
function saveScrollPosition() {
    return {
        left: gantt.scrollLeft,
        top: gantt.scrollTop
    };
}

// Function to restore the saved scroll position
function restoreScrollPosition(position) {
    gantt.scrollTo(position.left, position.top);
}

// Subscribe to onBeforeTaskUpdate to save scroll position before an update
gantt.attachEvent("onBeforeTaskUpdate", function(id, task) {
    task._scroll_pos = saveScrollPosition();
    return true; // Allow the update to proceed
});

// Subscribe to onAfterTaskUpdate to restore scroll position after an update
gantt.attachEvent("onAfterTaskUpdate", function(id, task) {
    restoreScrollPosition(task._scroll_pos);
});

// Lógica para gestionar el tooltip en Bubble
document.addEventListener('DOMContentLoaded', () => {
    const targetId = "tooltip-no-acceso";
    const targetElement = document.getElementById(targetId);

    // Verificar si el elemento objetivo existe
    if (!targetElement) {
        console.warn(`[Bubble Tooltip] No se encontró el elemento con ID: ${targetId}. Asegúrate de que existe en la página.`);
        return;
    }

    // Crear el elemento Tooltip si no existe
    let tooltip = document.getElementById('bubble-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'bubble-tooltip';
        tooltip.innerHTML = '¡Acceso Denegado!<br/>No tienes permisos para esta acción.';
        document.body.appendChild(tooltip);
    }

    let hideTimeout;

    // Función para mostrar el Tooltip
    const showTooltip = (event) => {
        clearTimeout(hideTimeout);

        const rect = targetElement.getBoundingClientRect();
        const tooltipWidth = tooltip.offsetWidth;

        let topPosition = rect.top + window.scrollY - tooltip.offsetHeight - 10;
        let leftPosition = rect.left + window.scrollX + (rect.width / 2) - (tooltipWidth / 2);

        if (topPosition < 0) {
            topPosition = rect.bottom + window.scrollY + 10;
            tooltip.style.setProperty('--tooltip-arrow-top', '-5px');
            tooltip.style.setProperty('--tooltip-arrow-bottom', 'auto');
        } else {
            tooltip.style.setProperty('--tooltip-arrow-top', '100%');
            tooltip.style.setProperty('--tooltip-arrow-bottom', 'auto');
        }

        tooltip.style.top = `${topPosition}px`;
        tooltip.style.left = `${leftPosition}px`;
        tooltip.classList.add('tooltip-visible');
    };

    // Función para ocultar el Tooltip
    const hideTooltip = () => {
        hideTimeout = setTimeout(() => {
            tooltip.classList.remove('tooltip-visible');
        }, 100);
    };

    // Adjuntar los escuchadores de eventos
    targetElement.addEventListener('mouseover', showTooltip);
    targetElement.addEventListener('mouseout', hideTooltip);

    window.addEventListener('scroll', () => {
        if (tooltip.classList.contains('tooltip-visible')) {
            showTooltip();
        }
    });

    console.log(`[Bubble Tooltip] Script cargado y escuchando el ID: ${targetId}`);
});