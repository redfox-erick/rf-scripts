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
    if (typeof bubble_fn_reorderTask !== "function") return;

    var ordered = [];
    gantt.eachTask(function(t) { ordered.push(t); });

    var pos = -1;
    for (var i = 0; i < ordered.length; i++) {
        if (String(ordered[i].id) === String(id)) { pos = i; break; }
    }
    if (pos === -1) return;

    var prev = pos > 0 ? ordered[pos - 1] : null;
    var next = pos < ordered.length - 1 ? ordered[pos + 1] : null;
    var prevIndex = prev && prev.index != null ? prev.index : null;
    var nextIndex = next && next.index != null ? next.index : null;

    var newIndex;
    if (prevIndex !== null && nextIndex !== null) {
        newIndex = (prevIndex + nextIndex) / 2;
    } else if (prevIndex !== null) {
        newIndex = prevIndex + 1;
    } else if (nextIndex !== null) {
        newIndex = nextIndex - 1;
    } else {
        return;
    }

    var task = gantt.getTask(id);
    _queueBubble("task_reorder", bubble_fn_reorderTask, {
        output1: task.bubble_id,
        output2: newIndex
    });
});

// Delete Tasks
gantt.attachEvent("onAfterTaskDelete", function(id, item) {
    if (item && item.is_ghost) return;
    if (typeof bubble_fn_deleteTask === "function") {
        _queueBubble("task_delete_" + id, bubble_fn_deleteTask, id);
    }
});

// Scroll position preservation
var SCROLL_KEY = "trakyu_scroll";

function saveScrollPosition() {
    var state = gantt.getScrollState();
    return { left: state.x || 0, top: state.y || 0 };
}

function restoreScrollPosition(pos) {
    if (pos) setTimeout(function() { gantt.scrollTo(pos.left, pos.top); }, 0);
}

gantt.attachEvent("onGanttScroll", function(left, top) {
    localStorage.setItem(SCROLL_KEY, JSON.stringify({ left: left, top: top }));
});

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

gantt.attachEvent("onBeforeTaskUpdate", function(id, task) {
    task._scroll_pos = saveScrollPosition();
    return true;
});
gantt.attachEvent("onAfterTaskUpdate", function(id, task) {
    restoreScrollPosition(task._scroll_pos);
});

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

gantt.attachEvent("onTaskDrag", function(id, mode, task) {
    _draggedId = id;
    _dragIntendedStart = new Date(task.start_date);
    return true;
});

gantt.attachEvent("onAfterTaskDrag", function() {
    setTimeout(function() {
        _draggedId = null;
        _dragIntendedStart = null;
    }, 200);
});

gantt.attachEvent("onAfterAutoSchedule", function(taskId, updatedTasks) {
    if (!_draggedId || !_dragIntendedStart) return;
    var id = _draggedId;
    var intended = _dragIntendedStart;
    _draggedId = null;
    _dragIntendedStart = null;

    if (!gantt.isTaskExists(id)) return;
    var task = gantt.getTask(id);
    if (Math.abs(task.start_date - intended) > 86400000) {
        showGanttToast("Esta tarea tiene dependencias — fue ajustada al primer día disponible.");
    }
});

gantt.attachEvent("onAutoScheduleCircularLink", function() {
    showGanttToast("No se puede mover: dependencia circular detectada.");
});

// --- Tooltip ---
var tooltipManager = (function() {
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

tooltipManager.attachTooltipEvents('tooltip-no-acceso');

// --- Edición de avance + completar tarea inline en columna ---
(function() {
    var PENCIL_SVG = '<svg class="avance-pencil-icon" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:4px;cursor:pointer;opacity:0.5;flex-shrink:0;">'
        + '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>'
        + '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'
        + '</svg>';

    var CHECK_SVG = '<svg class="avance-complete-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:6px;cursor:pointer;flex-shrink:0;">'
        + '<polyline points="20 6 9 17 4 12"/>'
        + '</svg>';

    document.addEventListener("ganttDataReady", function() {
        var avanceCol = gantt.config.columns.find(function(c) { return c.name === "avance"; });
        if (!avanceCol) return;

        avanceCol.template = function(task) {
            if (gantt.hasChild(task.id)) {
                var totalDays = 0, weightedSum = 0;
                gantt.eachTask(function(child) {
                    if (gantt.hasChild(child.id)) return;
                    var days = Math.round((child.end_date - child.start_date) / 86400000);
                    totalDays += days;
                    weightedSum += days * (child.progress || 0);
                }, task.id);
                var pct = totalDays > 0 ? Math.round(weightedSum / totalDays * 100) : 0;
                return "<span class='avance-readonly'>" + pct + "%</span>";
            }
            var pct = Math.round((task.progress || 0) * 100);
            if (isCompleted(task)) {
                return "<span class='avance-readonly'>" + pct + "%</span>";
            }
            return "<span class='avance-editable' data-task-id='" + task.id + "' style='display:inline-flex;align-items:center;cursor:default;'>"
                + "<span class='avance-pct'>" + pct + "%</span>"
                + PENCIL_SVG
                + CHECK_SVG
                + "</span>";
        };

        gantt.render();
    }, { once: true });

    // Click en lápiz — abre input de avance
    document.addEventListener("click", function(e) {
        var icon = e.target.closest ? e.target.closest(".avance-pencil-icon") : null;
        if (!icon) return;

        var container = icon.closest(".avance-editable");
        if (!container) return;

        var taskId = container.getAttribute("data-task-id");
        if (!taskId || !gantt.isTaskExists(taskId)) return;

        var task = gantt.getTask(taskId);
        if (isCompleted(task)) return;

        var currentPct = Math.round((task.progress || 0) * 100);

        var input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = "100";
        input.value = currentPct;
        input.className = "avance-input";
        input.style.cssText = "width:60px;text-align:center;border:1px solid #2196f3;border-radius:3px;padding:1px 4px;font-size:12px;";

        input.addEventListener("input", function() {
            if (parseInt(this.value, 10) > 100) this.value = 100;
            if (parseInt(this.value, 10) < 0) this.value = 0;
        });

        container.parentNode.replaceChild(input, container);
        input.focus();
        input.select();

        var committed = false;
        function commitEdit() {
            if (committed) return;
            committed = true;
            var raw = parseInt(input.value, 10);
            if (isNaN(raw)) raw = currentPct;
            raw = Math.max(0, Math.min(100, raw));

            task.progress = raw / 100;
            gantt.updateTask(taskId);
            gantt.render();

            if (typeof bubble_fn_updateProgress === "function") {
                _queueBubble("progress_update_" + taskId, bubble_fn_updateProgress, {
                    output1: Number(taskId),
                    output2: raw
                });
            }
        }

        input.addEventListener("blur", commitEdit);
        input.addEventListener("keydown", function(ev) {
            if (ev.key === "Enter") { input.blur(); }
            if (ev.key === "Escape") {
                committed = true;
                task.progress = currentPct / 100;
                gantt.render();
            }
        });
    });

    // Click en check — confirma y completa la tarea
    document.addEventListener("click", function(e) {
        var icon = e.target.closest ? e.target.closest(".avance-complete-icon") : null;
        if (!icon) return;

        e.stopPropagation();

        var container = icon.closest(".avance-editable");
        if (!container) return;

        var taskId = container.getAttribute("data-task-id");
        if (!taskId || !gantt.isTaskExists(taskId)) return;

        var task = gantt.getTask(taskId);
        if (isCompleted(task)) return;

        if (!confirm("¿Marcar esta tarea como completada? Esta acción no se puede deshacer.")) return;

        task.progress = 1;
        gantt.updateTask(taskId);
        gantt.render();

        if (typeof bubble_fn_completeTask === "function") {
            _queueBubble("task_complete_" + taskId, bubble_fn_completeTask, Number(taskId));
        }
    });
})();
