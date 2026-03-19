// Lookahead Timeline — vis-timeline
// Owns ONLY the timeline. Sidebar, toolbar, commit, and period controls live in Bubble.
//
// --- Bubble sets these globals before the HTML element loads ---
//   window.BUBBLE_LOOKAHEAD_WEEKS   {number}  e.g. 4
//   window.BUBBLE_LOOKAHEAD_START   {string}  e.g. "2026-03-16"
//   window.BUBBLE_LOOKAHEAD_GROUPS  {array}   [{ id, content, order? }]
//   window.BUBBLE_LOOKAHEAD_ITEMS   {array}   [{ id, taskId, groupId, start, end }]  ← already-placed
//
// --- Bubble makes list items draggable by including inside each cell ---
//   <div class="lookahead-draggable"
//        draggable="true"
//        data-task-id="..."
//        data-task-text="..."
//        data-task-duration="3"
//        data-task-color="#f59e0b"
//        style="position:absolute;inset:0;cursor:grab;">
//   </div>
//
// --- Bubble calls these functions via Run JavaScript ---
//   window.setLookaheadPeriod(weeks)    — update visible window
//   window.setLookaheadLocked(bool)     — lock/unlock editing (call after commit or on load)
//   window.clearLookahead()             — remove all placed items
//   window.refreshLookahead()           — reload from updated globals
//
// --- Callbacks to Bubble ---
//   bubble_fn_placeTask        { output1: itemId, output2: taskId, output3: groupId, output4: start, output5: end }
//   bubble_fn_updatePlacedTask { output1: itemId, output2: groupId, output3: start, output4: end }
//   bubble_fn_removePlacedTask { output1: itemId }
//
// NOTE: commit is a pure Bubble workflow — no JS callback needed.
//   Bubble already has all data via the above callbacks in real-time.
//   After committing, Bubble calls window.setLookaheadLocked(true).

console.log("[Lookahead] lookahead.js loaded");

window.initLookahead = function() {
    if (typeof vis === "undefined") {
        console.error("[Lookahead] vis-timeline not loaded");
        return;
    }

    // ---- Read Bubble globals ----
    var periodWeeks = window.BUBBLE_LOOKAHEAD_WEEKS || 4;
    var startDate   = window.BUBBLE_LOOKAHEAD_START
        ? new Date(window.BUBBLE_LOOKAHEAD_START)
        : _thisMonday();

    startDate.setHours(0, 0, 0, 0);

    var endDate = _addDays(startDate, periodWeeks * 7);

    // ---- DataSets ----
    var visGroups = new vis.DataSet(
        (window.BUBBLE_LOOKAHEAD_GROUPS || []).map(function(g, i) {
            return { id: g.id, content: g.content, order: g.order != null ? g.order : i };
        })
    );

    var visItems = new vis.DataSet(
        (window.BUBBLE_LOOKAHEAD_ITEMS || []).map(function(item) {
            return _buildItem(item.id, item.taskId, item.groupId,
                              new Date(item.start), new Date(item.end),
                              item.text, item.color);
        })
    );

    // ---- Timeline ----
    var options = {
        groupOrder: "order",
        stack: false,
        start: startDate,
        end: endDate,
        min: _addDays(startDate, -7),
        max: _addDays(endDate,   7),
        zoomMin: 7   * 86400000,
        zoomMax: 16  * 7 * 86400000,
        orientation: { axis: "top" },
        showCurrentTime: true,
        margin: { item: { horizontal: 2, vertical: 4 } },
        snap: function(date) {
            var d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d;
        },
        editable: { updateTime: true, updateGroup: true, remove: true },
        onMove: function(item, callback) {
            callback(item);
            if (typeof bubble_fn_updatePlacedTask === "function") {
                bubble_fn_updatePlacedTask({
                    output1: item.id,
                    output2: String(item.group),
                    output3: item.start,
                    output4: item.end
                });
            }
        },
        onRemove: function(item, callback) {
            callback(item);
            if (typeof bubble_fn_removePlacedTask === "function") {
                bubble_fn_removePlacedTask({ output1: item.id });
            }
        }
    };

    var container = document.getElementById("lookahead-timeline");
    var timeline  = new vis.Timeline(container, visItems, visGroups, options);

    // ---- Drop target: accept drags from Bubble's .lookahead-draggable elements ----
    container.addEventListener("dragover", function(e) {
        if (_locked) { e.dataTransfer.dropEffect = "none"; return; }
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        container.classList.add("drop-active");
    });

    container.addEventListener("dragleave", function(e) {
        if (!container.contains(e.relatedTarget)) {
            container.classList.remove("drop-active");
        }
    });

    container.addEventListener("drop", function(e) {
        e.preventDefault();
        container.classList.remove("drop-active");

        var taskId   = e.dataTransfer.getData("taskId");
        var taskText = e.dataTransfer.getData("taskText");
        var duration = parseInt(e.dataTransfer.getData("taskDuration")) || 1;
        var color    = e.dataTransfer.getData("taskColor") || "#36ac81";

        if (!taskId) return;

        var props = timeline.getEventProperties(e);
        if (!props.group) {
            console.warn("[Lookahead] Dropped outside a group — ignored");
            return;
        }

        var start = new Date(props.snappedTime || props.time);
        start.setHours(0, 0, 0, 0);
        var end = _addDays(start, duration);

        var itemId = "placed_" + taskId + "_" + Date.now();
        visItems.add(_buildItem(itemId, taskId, props.group, start, end, taskText, color));

        console.log("[Lookahead] Placed:", { itemId, taskId, group: props.group, start, end });

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

    // Listen for dragstart on document so Bubble's draggable items are picked up
    document.addEventListener("dragstart", function(e) {
        var el = e.target.closest ? e.target.closest(".lookahead-draggable") : null;
        if (!el) return;
        e.dataTransfer.setData("taskId",       el.dataset.taskId       || "");
        e.dataTransfer.setData("taskText",     el.dataset.taskText     || "");
        e.dataTransfer.setData("taskDuration", el.dataset.taskDuration || "1");
        e.dataTransfer.setData("taskColor",    el.dataset.taskColor    || "#36ac81");
        e.dataTransfer.effectAllowed = "copy";
    });

    // ---- Lock state ----
    var _locked = window.BUBBLE_LOOKAHEAD_LOCKED === true;

    function _applyLock(locked) {
        _locked = locked;
        timeline.setOptions({
            editable: locked ? false : { updateTime: true, updateGroup: true, remove: true }
        });
        container.classList.toggle("lookahead-locked", locked);
        console.log("[Lookahead] " + (locked ? "Locked — editing disabled" : "Unlocked — editing enabled"));
    }

    // Apply initial lock state if Bubble set it before init
    if (_locked) _applyLock(true);

    // ---- Public API (called by Bubble via Run JavaScript) ----

    window.setLookaheadPeriod = function(weeks) {
        var newEnd = _addDays(startDate, weeks * 7);
        timeline.setWindow(startDate, newEnd, { animation: { duration: 400 } });
    };

    window.setLookaheadLocked = function(locked) {
        _applyLock(!!locked);
    };

    window.clearLookahead = function() {
        if (_locked) { console.warn("[Lookahead] Locked — clear blocked"); return; }
        visItems.clear();
    };

    window.refreshLookahead = function() {
        visGroups.clear();
        visGroups.add(
            (window.BUBBLE_LOOKAHEAD_GROUPS || []).map(function(g, i) {
                return { id: g.id, content: g.content, order: g.order != null ? g.order : i };
            })
        );
        visItems.clear();
        visItems.add(
            (window.BUBBLE_LOOKAHEAD_ITEMS || []).map(function(item) {
                return _buildItem(item.id, item.taskId, item.groupId,
                                  new Date(item.start), new Date(item.end),
                                  item.text, item.color);
            })
        );
    };

    console.log("[Lookahead] Timeline initialized — " + periodWeeks + " weeks from " + startDate.toDateString());

    // ---- Helpers ----
    function _buildItem(id, taskId, groupId, start, end, text, color) {
        color = color || "#36ac81";
        return {
            id:      id,
            group:   groupId,
            content: text || taskId,
            start:   start,
            end:     end,
            title:   (text || taskId) + " — " + Math.round((end - start) / 86400000) + " días",
            style:   "background:" + color + ";border-color:" + color + ";color:#fff;",
            taskId:  taskId
        };
    }

    function _addDays(date, days) {
        var d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    function _thisMonday() {
        var d = new Date();
        var day = d.getDay();
        d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        return d;
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", window.initLookahead);
} else {
    window.initLookahead();
}
