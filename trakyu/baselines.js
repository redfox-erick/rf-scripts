// Baselines — compare a frozen baseline snapshot against live task dates
// Requires: window.BUBBLE_BASELINE_TASKS set by Bubble before calling initBaselines()

window.initBaselines = function() {
    var isVisible = false;
    var ghostIds  = [];
    var baselineMap = {};  // ref_task_id -> { start_date, end_date, task_name }

    // Internal flag so programmatic ghost deletion bypasses the user-delete guard
    window._bypassGhostProtection = false;

    // ---- Template: style ghost task bars ----
    var _origTaskClass = gantt.templates.task_class;
    gantt.templates.task_class = function(start, end, task) {
        if (task.is_ghost) return "task-ghost";
        return _origTaskClass ? _origTaskClass(start, end, task) : "";
    };

    // ---- Task layer: baseline bar rendered below the live bar ----
    gantt.addTaskLayer(function(task) {
        if (!isVisible || task.is_ghost || !task.baseline_start || !task.baseline_end) return false;

        var sizes  = gantt.getTaskPosition(task, task.baseline_start, task.baseline_end);
        var barTop = Math.floor((gantt.config.row_height - gantt.config.bar_height) / 2);

        var el = document.createElement("div");
        el.className = "baseline-bar";
        el.style.left   = sizes.left + "px";
        el.style.width  = Math.max(sizes.width, 2) + "px";
        el.style.top    = (sizes.top + barTop + gantt.config.bar_height + 2) + "px";
        el.style.height = "6px";
        el.title = "Baseline: " +
            gantt.date.date_to_str("%d/%m/%Y")(task.baseline_start) + " → " +
            gantt.date.date_to_str("%d/%m/%Y")(task.baseline_end);
        return el;
    });

    // ---- Guard: prevent editing/dragging/deleting ghost tasks ----
    gantt.attachEvent("onBeforeTaskUpdate", function(id, task) {
        if (task.is_ghost) return false;
        return true;
    });
    gantt.attachEvent("onBeforeTaskDrag", function(id) {
        return !gantt.getTask(id).is_ghost;
    });
    gantt.attachEvent("onBeforeLightbox", function(id) {
        return !gantt.getTask(id).is_ghost;
    });
    gantt.attachEvent("onBeforeTaskDelete", function(id) {
        if (window._bypassGhostProtection) return true;
        return !gantt.getTask(id).is_ghost;
    });

    // ---- Build lookup map from Bubble data ----
    function buildMap() {
        baselineMap = {};
        (window.BUBBLE_BASELINE_TASKS || []).forEach(function(bt) {
            baselineMap[String(bt.ref_task_id)] = {
                start_date: new Date(bt.start_date),
                end_date:   new Date(bt.end_date),
                task_name:  bt.task_name || "Tarea eliminada"
            };
        });
    }

    // ---- Apply baseline to the current Gantt state ----
    function applyBaseline() {
        var scroll  = gantt.getScrollState();
        var liveIds = {};

        // Set baseline dates on live tasks
        gantt.eachTask(function(task) {
            if (task.is_ghost) return;
            liveIds[String(task.id)] = true;
            var bl = baselineMap[String(task.id)];
            if (bl) {
                task.baseline_start = bl.start_date;
                task.baseline_end   = bl.end_date;
            }
        });

        // Add ghost tasks for tasks deleted from live
        var ghostRefIds = Object.keys(baselineMap).filter(function(id) { return !liveIds[id]; });

        if (ghostRefIds.length > 0) {
            var groupId = "ghost_group";
            if (!gantt.isTaskExists(groupId)) {
                gantt.addTask({
                    id:       groupId,
                    text:     "Tareas eliminadas (baseline)",
                    type:     gantt.config.types.project,
                    is_ghost: true,
                    open:     false,
                    readonly: true
                });
                ghostIds.push(groupId);
            }

            ghostRefIds.forEach(function(refId) {
                var bl      = baselineMap[refId];
                var ghostId = "ghost_" + refId;
                if (!gantt.isTaskExists(ghostId)) {
                    gantt.addTask({
                        id:         ghostId,
                        text:       bl.task_name,
                        start_date: bl.start_date,
                        end_date:   bl.end_date,
                        parent:     groupId,
                        is_ghost:   true,
                        readonly:   true
                    });
                    ghostIds.push(ghostId);
                }
            });
        }

        gantt.render();
        setTimeout(function() { gantt.scrollTo(scroll.x, scroll.y); }, 0);
    }

    // ---- Clear baseline from the Gantt ----
    function clearBaseline() {
        var scroll = gantt.getScrollState();

        window._bypassGhostProtection = true;
        ghostIds.forEach(function(id) {
            if (gantt.isTaskExists(id)) gantt.deleteTask(id);
        });
        window._bypassGhostProtection = false;
        ghostIds = [];

        gantt.eachTask(function(task) {
            delete task.baseline_start;
            delete task.baseline_end;
        });

        gantt.render();
        setTimeout(function() { gantt.scrollTo(scroll.x, scroll.y); }, 0);
    }

    // ---- Toggle button ----
    var container = document.getElementById("gantt_here");
    var btn = document.createElement("button");
    btn.id = "gantt-baseline-btn";
    btn.textContent = "📐 Baseline";
    var slot = document.getElementById("gantt-toolbar-slot");
    if (slot) {
        slot.parentNode.insertBefore(btn, slot);
    } else {
        var tb = document.getElementById("gantt-toolbar");
        if (tb) tb.appendChild(btn);
        else container.appendChild(btn);
    }

    btn.addEventListener("click", function() {
        if (isVisible) {
            clearBaseline();
            isVisible = false;
            btn.classList.remove("active");
        } else {
            buildMap();
            applyBaseline();
            isVisible = true;
            btn.classList.add("active");
        }
    });

    // ---- Public: Bubble calls this after updating BUBBLE_BASELINE_TASKS ----
    window.refreshBaseline = function() {
        buildMap();
        if (isVisible) {
            clearBaseline();
            applyBaseline();
        }
    };

    console.log("[Gantt] Baselines initialized");
};
