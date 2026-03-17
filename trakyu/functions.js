// Fix #3: Missing helper functions referenced in init.js

function isCompleted(task) {
  return task.progress >= 1;
}

function calcularAvance(task) {
  return Math.round((task.progress || 0) * 100);
}

function confirmCompletion(id) {
  if (!confirm("¿Marcar esta tarea como completada?")) return;
  var task = gantt.getTask(id);
  task.progress = 1;
  gantt.updateTask(id);
  gantt.render();
}

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

// Links (dependencies) — Bubble callbacks and scroll preservation are handled together below

// Scroll position preservation
var SCROLL_KEY = "trakyu_scroll";

function saveScrollPosition() {
    var state = gantt.getScrollState();
    return { left: state.x || 0, top: state.y || 0 };
}

function restoreScrollPosition(pos) {
    if (pos) setTimeout(function() { gantt.scrollTo(pos.left, pos.top); }, 0);
}

// Persist scroll to localStorage on every scroll event
gantt.attachEvent("onGanttScroll", function(left, top) {
    localStorage.setItem(SCROLL_KEY, JSON.stringify({ left: left, top: top }));
});

// Restore persisted scroll after parse (called from initGantt and refreshGanttData)
function restorePersistedScroll() {
    var saved = localStorage.getItem(SCROLL_KEY);
    if (!saved) return;
    try {
        var pos = JSON.parse(saved);
        setTimeout(function() { gantt.scrollTo(pos.left, pos.top); }, 0);
    } catch(e) {
        localStorage.removeItem(SCROLL_KEY);
    }
}

// Tasks
gantt.attachEvent("onBeforeTaskUpdate", function(id, task) {
    task._scroll_pos = saveScrollPosition();
    return true;
});
gantt.attachEvent("onAfterTaskUpdate", function(id, task) {
    restoreScrollPosition(task._scroll_pos);
});

// Links — use a module-level variable since link objects aren't persisted between before/after
var _linkScroll = null;
gantt.attachEvent("onBeforeLinkAdd", function() {
    _linkScroll = saveScrollPosition();
    return true;
});
gantt.attachEvent("onAfterLinkAdd", function(id, link) {
    restoreScrollPosition(_linkScroll);
    if (typeof bubble_fn_createLink === "function") {
        bubble_fn_createLink({ output1: id, output2: link.source, output3: link.target, output4: link.type });
    }
});

gantt.attachEvent("onAfterLinkUpdate", function(id, link) {
    if (typeof bubble_fn_updateLink === "function") {
        bubble_fn_updateLink({ output1: id, output2: link.source, output3: link.target, output4: link.type });
    }
});

gantt.attachEvent("onBeforeLinkDelete", function() {
    _linkScroll = saveScrollPosition();
    return true;
});
gantt.attachEvent("onAfterLinkDelete", function(id) {
    restoreScrollPosition(_linkScroll);
    if (typeof bubble_fn_deleteLink === "function") {
        bubble_fn_deleteLink({ output1: id });
    }
});

// Refactored tooltip logic for better readability
const tooltipManager = (() => {
    // Fix #6: lazy-initialize so we don't query the DOM before Bubble renders the element
    let _tooltip = null;
    let hideTimeout;

    const getTooltip = () => {
        if (!_tooltip) _tooltip = document.getElementById('bubble-tooltip');
        return _tooltip;
    };

    const showTooltip = (event, targetElement) => {
        const tooltip = getTooltip();
        if (!tooltip) return;
        const rect = targetElement.getBoundingClientRect();
        const tooltipWidth = tooltip.offsetWidth;
        const topPosition = rect.top + window.scrollY - tooltip.offsetHeight - 10;
        const leftPosition = rect.left + window.scrollX + (rect.width / 2) - (tooltipWidth / 2);

        tooltip.style.top = `${topPosition}px`;
        tooltip.style.left = `${leftPosition}px`;
        tooltip.classList.add('tooltip-visible');
    };

    const hideTooltip = () => {
        const tooltip = getTooltip();
        if (!tooltip) return;
        tooltip.classList.remove('tooltip-visible');
    };

    const attachTooltipEvents = (targetId) => {
        const targetElement = document.getElementById(targetId);
        if (!targetElement) return;

        targetElement.addEventListener('mouseenter', (event) => {
            clearTimeout(hideTimeout);
            showTooltip(event, targetElement);
        });

        targetElement.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(hideTooltip, 300);
        });
    };

    return { attachTooltipEvents };
})();

// Example usage
tooltipManager.attachTooltipEvents('tooltip-no-acceso');