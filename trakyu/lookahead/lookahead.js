// Lookahead Timeline — vis-timeline based
// Reads window.BUBBLE_LOOKAHEAD_* globals, calls bubble_fn_* callbacks (same pattern as Gantt)
console.log("[Lookahead] lookahead.js loaded");

window.initLookahead = function() {
    // ---- Config from Bubble globals ----
    var periodWeeks  = window.BUBBLE_LOOKAHEAD_WEEKS  || 4;
    var startRaw     = window.BUBBLE_LOOKAHEAD_START;
    var groups       = window.BUBBLE_LOOKAHEAD_GROUPS || [];  // [{ id, content, order? }]
    var taskPool     = window.BUBBLE_LOOKAHEAD_TASKS  || [];  // [{ id, text, duration, category, color }]
    var placedRaw    = window.BUBBLE_LOOKAHEAD_ITEMS  || [];  // already placed [{ id, taskId, groupId, start, end }]

    var startDate = startRaw ? new Date(startRaw) : (function() {
        var d = new Date(); d.setHours(0,0,0,0);
        // roll back to Monday
        var day = d.getDay(); var diff = (day === 0 ? -6 : 1 - day);
        d.setDate(d.getDate() + diff);
        return d;
    })();

    var endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + periodWeeks * 7);

    // ---- Build sidebar task list ----
    var taskList = document.getElementById("lookahead-task-list");
    var placedCounts = {}; // taskId -> count placed

    placedRaw.forEach(function(item) {
        placedCounts[item.taskId] = (placedCounts[item.taskId] || 0) + 1;
    });

    function renderSidebar() {
        taskList.innerHTML = "";
        taskPool.forEach(function(task) {
            var card = document.createElement("div");
            card.className = "lookahead-task-card";
            card.draggable = true;
            card.dataset.taskId = task.id;
            card.style.borderLeftColor = task.color || "#36ac81";

            var count = placedCounts[task.id] || 0;

            card.innerHTML = [
                '<div class="task-card-category">' + (task.category || "") + "</div>",
                '<div class="task-card-name">' + task.text + "</div>",
                '<div class="task-card-meta">',
                '  <span class="task-card-duration">⏱ ' + task.duration + " d</span>",
                '  <span class="task-card-placed' + (count > 0 ? " visible" : "") + '">✓ ' + count + " colocada" + (count !== 1 ? "s" : "") + "</span>",
                "</div>"
            ].join("");

            card.addEventListener("dragstart", function(e) {
                e.dataTransfer.setData("taskId", task.id);
                e.dataTransfer.effectAllowed = "copy";
                card.classList.add("dragging");
                document.getElementById("drop-hint").classList.add("visible");
            });
            card.addEventListener("dragend", function() {
                card.classList.remove("dragging");
                document.getElementById("drop-hint").classList.remove("visible");
            });

            taskList.appendChild(card);
        });
    }

    renderSidebar();

    // ---- vis-timeline DataSets ----
    var visGroups = new vis.DataSet(
        groups.map(function(g, i) {
            return { id: g.id, content: g.content, order: g.order || i };
        })
    );

    var visItems = new vis.DataSet(
        placedRaw.map(function(item) {
            var task = taskPool.find(function(t) { return t.id === item.taskId; });
            return buildVisItem(item.id, item.taskId, item.groupId, new Date(item.start), new Date(item.end), task);
        })
    );

    function buildVisItem(id, taskId, groupId, start, end, task) {
        var color = (task && task.color) ? task.color : "#36ac81";
        var label = (task && task.text) ? task.text : taskId;
        return {
            id:      id,
            group:   groupId,
            content: label,
            start:   start,
            end:     end,
            style:   "background:" + color + "; border-color:" + color + "; color:#fff;",
            title:   label + " — " + Math.round((end - start) / 86400000) + " días",
            taskId:  taskId
        };
    }

    // ---- vis-timeline options ----
    var options = {
        groupOrder: "order",
        stack: false,
        start: startDate,
        end: endDate,
        min: new Date(startDate.getTime() - 7 * 86400000),
        max: new Date(endDate.getTime() + 7 * 86400000),
        zoomMin: 7 * 86400000,
        zoomMax: 16 * 7 * 86400000,
        orientation: { axis: "top" },
        showCurrentTime: true,
        margin: { item: { horizontal: 2, vertical: 4 } },
        snap: function(date) {
            var d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d;
        },
        editable: {
            updateTime:  true,
            updateGroup: true,
            remove:      true
        },
        onMove: function(item, callback) {
            callback(item);
            _notifyUpdate(item);
        },
        onRemove: function(item, callback) {
            callback(item);
            // update placed count badge
            placedCounts[item.taskId] = Math.max(0, (placedCounts[item.taskId] || 1) - 1);
            renderSidebar();
            if (typeof bubble_fn_removePlacedTask === "function") {
                bubble_fn_removePlacedTask({ output1: item.id });
            }
        },
        format: {
            minorLabels: { day: "D", week: "w" },
            majorLabels: { week: "MMMM YYYY", month: "YYYY" }
        },
        timeAxis: { scale: "day", step: 1 }
    };

    var container = document.getElementById("lookahead-timeline");
    var timeline = new vis.Timeline(container, visItems, visGroups, options);

    // ---- External drag: sidebar → timeline ----
    container.addEventListener("dragover", function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    });

    container.addEventListener("dragleave", function() {
        document.getElementById("drop-hint").classList.remove("visible");
    });

    container.addEventListener("drop", function(e) {
        e.preventDefault();
        document.getElementById("drop-hint").classList.remove("visible");

        var taskId = e.dataTransfer.getData("taskId");
        var task   = taskPool.find(function(t) { return t.id === taskId; });
        if (!task) return;

        var props = timeline.getEventProperties(e);
        if (!props.group) {
            console.warn("[Lookahead] Drop outside a group — ignored");
            return;
        }

        var start = props.snappedTime || props.time;
        start = new Date(start);
        start.setHours(0, 0, 0, 0);

        var end = new Date(start);
        end.setDate(end.getDate() + task.duration);

        var itemId = "placed_" + taskId + "_" + Date.now();
        visItems.add(buildVisItem(itemId, taskId, props.group, start, end, task));

        placedCounts[taskId] = (placedCounts[taskId] || 0) + 1;
        renderSidebar();

        console.log("[Lookahead] Task placed:", { itemId, taskId, group: props.group, start, end });

        if (typeof bubble_fn_placeTask === "function") {
            bubble_fn_placeTask({
                output1: itemId,
                output2: taskId,
                output3: String(props.group),
                output4: start,
                output5: end
            });
        }
    });

    // ---- Notify Bubble on move/resize ----
    function _notifyUpdate(item) {
        var updated = visItems.get(item.id);
        if (!updated) return;
        console.log("[Lookahead] Task updated:", updated);
        if (typeof bubble_fn_updatePlacedTask === "function") {
            bubble_fn_updatePlacedTask({
                output1: updated.id,
                output2: String(updated.group),
                output3: updated.start,
                output4: updated.end
            });
        }
    }

    // ---- Commit button ----
    document.getElementById("lookahead-commit-btn").addEventListener("click", function() {
        var all = visItems.get();
        console.log("[Lookahead] Committing", all.length, "items:", all);
        if (typeof bubble_fn_commitLookahead === "function") {
            bubble_fn_commitLookahead({
                outputlist1: all.map(function(i) { return i.id; }),
                outputlist2: all.map(function(i) { return i.taskId; }),
                outputlist3: all.map(function(i) { return String(i.group); }),
                outputlist4: all.map(function(i) { return i.start; }),
                outputlist5: all.map(function(i) { return i.end; })
            });
        }
    });

    // ---- Period selector ----
    var periodSelect = document.getElementById("lookahead-period-select");
    if (periodSelect) {
        periodSelect.value = periodWeeks;
        periodSelect.addEventListener("change", function() {
            var weeks = parseInt(this.value);
            var newEnd = new Date(startDate);
            newEnd.setDate(newEnd.getDate() + weeks * 7);
            timeline.setWindow(startDate, newEnd, { animation: { duration: 400 } });
        });
    }

    // ---- Public refresh (Bubble calls after data update) ----
    window.refreshLookahead = function() {
        taskPool  = window.BUBBLE_LOOKAHEAD_TASKS || [];
        placedRaw = window.BUBBLE_LOOKAHEAD_ITEMS || [];
        placedCounts = {};
        placedRaw.forEach(function(item) {
            placedCounts[item.taskId] = (placedCounts[item.taskId] || 0) + 1;
        });
        renderSidebar();
        visItems.clear();
        visItems.add(placedRaw.map(function(item) {
            var task = taskPool.find(function(t) { return t.id === item.taskId; });
            return buildVisItem(item.id, item.taskId, item.groupId, new Date(item.start), new Date(item.end), task);
        }));
    };

    console.log("[Lookahead] Timeline initialized — period:", periodWeeks, "weeks");
};

// Auto-init when DOM is ready (same pattern as Gantt)
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", window.initLookahead);
} else {
    window.initLookahead();
}
