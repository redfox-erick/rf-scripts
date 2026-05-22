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

// --- Bubble call debounce queue ---
// Collects pending Bubble calls and flushes them after 600ms of inactivity.
// Last write wins per key, so rapid updates to the same task collapse into one call.
var _bubbleQueue = {};
var _bubbleTimer = null;
var BUBBLE_DEBOUNCE_MS = 600;
var BUBBLE_LOCK_MS = 1200;

function _showSavingOverlay() {
    if (document.getElementById("gantt-saving-overlay")) return;
    var overlay = document.createElement("div");
    overlay.id = "gantt-saving-overlay";
    overlay.innerHTML = "<span>Guardando…</span>";
    document.getElementById("gantt_here").appendChild(overlay);
}

function _hideSavingOverlay() {
    var el = document.getElementById("gantt-saving-overlay");
    if (el) el.remove();
}

function _flushBubbleQueue() {
    _showSavingOverlay();
    var queue = _bubbleQueue;
    _bubbleQueue = {};
    Object.keys(queue).forEach(function(key) {
        var entry = queue[key];
        if (typeof entry.fn === "function") entry.fn(entry.payload);
    });
    setTimeout(_hideSavingOverlay, BUBBLE_LOCK_MS);
}

function _queueBubble(key, fn, payload) {
    // A delete cancels any pending create/update for the same task
    if (key.indexOf("task_delete_") === 0) {
        var taskId = key.replace("task_delete_", "");
        delete _bubbleQueue["task_create_" + taskId];
        delete _bubbleQueue["task_update_" + taskId];
    }
    _bubbleQueue[key] = { fn: fn, payload: payload };
    clearTimeout(_bubbleTimer);
    _bubbleTimer = setTimeout(_flushBubbleQueue, BUBBLE_DEBOUNCE_MS);
}

// Create Tasks
gantt.attachEvent("onAfterTaskAdd", function(id, item) {
    if (item.is_ghost) return;
    if (typeof bubble_fn_createTask === "function") {
        _queueBubble("task_create_" + id, bubble_fn_createTask, {
            output1: id,
            output2: item.text,
            output3: item.start_date,
            output4: item.end_date,
            outputlist1: [item.parent]
        });
    }
});

// Update Tasks
gantt.attachEvent("onAfterTaskUpdate", function(id, item) {
    if (item.is_ghost) return;
    if (typeof bubble_fn_updateTask === "function") {
        _queueBubble("task_update_" + id, bubble_fn_updateTask, {
            output1: id,
            output2: item.text,
            output3: item.start_date,
            output4: item.end_date,
            outputlist1: [item.parent]
        });
    }
});

// Reorder Tasks
gantt.attachEvent("onAfterRowReorder", function(id) {
    if (typeof bubble_fn_reorderTasks !== "function") return;
    var ids = [];
    gantt.eachTask(function(task) { ids.push(task.id); });
    _queueBubble("task_reorder", bubble_fn_reorderTasks, { outputlist1: ids });
});

// Delete Tasks
gantt.attachEvent("onAfterTaskDelete", function(id, item) {
    if (item && item.is_ghost) return;
    if (typeof bubble_fn_deleteTask === "function") {
        _queueBubble("task_delete_" + id, bubble_fn_deleteTask, id);
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
        _queueBubble("link_create_" + id, bubble_fn_createLink, { output1: id, output2: link.source, output3: link.target, output4: link.type });
    }
});

gantt.attachEvent("onAfterLinkUpdate", function(id, link) {
    if (typeof bubble_fn_updateLink === "function") {
        _queueBubble("link_update_" + id, bubble_fn_updateLink, { output1: id, output2: link.source, output3: link.target, output4: link.type });
    }
});

gantt.attachEvent("onBeforeLinkDelete", function() {
    _linkScroll = saveScrollPosition();
    return true;
});
gantt.attachEvent("onAfterLinkDelete", function(id) {
    restoreScrollPosition(_linkScroll);
    if (typeof bubble_fn_deleteLink === "function") {
        _queueBubble("link_delete_" + id, bubble_fn_deleteLink, { output1: id });
    }
});

// --- Dependency conflict feedback ---

function showGanttToast(msg) {
    var existing = document.getElementById("gantt-toast");
    if (existing) existing.remove();
    var toast = document.createElement("div");
    toast.id = "gantt-toast";
    toast.textContent = msg;
    document.getElementById("gantt_here").appendChild(toast);
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 4000);
}

var _draggedId = null;
var _dragIntendedStart = null;

// Track the user's intended position on each drag frame
gantt.attachEvent("onTaskDrag", function(id, mode, task) {
    _draggedId = id;
    _dragIntendedStart = new Date(task.start_date);
    return true;
});

// Fallback: clear state if auto-scheduling never fires (task has no links)
gantt.attachEvent("onAfterTaskDrag", function() {
    setTimeout(function() {
        _draggedId = null;
        _dragIntendedStart = null;
    }, 200);
});

// onAfterAutoSchedule fires AFTER auto-scheduling adjusts tasks — the correct place to compare
// updatedTasks is an array of IDs of tasks that were actually moved by auto-scheduling
gantt.attachEvent("onAfterAutoSchedule", function(taskId, updatedTasks) {
    if (!_draggedId || !_dragIntendedStart) return;
    var id = _draggedId;
    var intended = _dragIntendedStart;
    _draggedId = null;
    _dragIntendedStart = null;

    if (!gantt.isTaskExists(id)) return;
    var task = gantt.getTask(id);
    // If the dragged task was adjusted by more than 1 day, notify the user
    if (Math.abs(task.start_date - intended) > 86400000) {
        showGanttToast("Esta tarea tiene dependencias — fue ajustada al primer día disponible.");
    }
});

// Circular dependency loop — separate case
gantt.attachEvent("onAutoScheduleCircularLink", function() {
    showGanttToast("No se puede mover: dependencia circular detectada.");
});

// --- Refactored tooltip logic for better readability
var tooltipManager = (function() {
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