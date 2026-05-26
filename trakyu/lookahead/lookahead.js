// lookahead.js — reusable vis-timeline factory
//
// Usage:
//   var tl = window.createLookaheadTimeline({
//       containerId: "lookahead-timeline",   // required
//       weeks:       4,                      // default: 4
//       start:       "2026-03-17",           // Date or ISO string; default: current Monday
//       items:       [],                     // [{id, taskId, start, end, text, color}]
//       locked:      false,
//       onPlace:     function(data) {},      // {output1:itemId, output2:taskId, output3:start, output4:end}
//       onUpdate:    function(data) {},      // {output1:itemId, output2:start, output3:end}
//       onRemove:    function(data) {}       // {output1:itemId}
//   });
//
// Returns: { setPeriod(weeks), setLocked(bool), clear(), refresh(items), scrollTo(date) }
//
// Bubble integration:
//   - Set globals before calling: window.BUBBLE_LOOKAHEAD_* (optional — pass directly via config instead)
//   - The .lookahead-draggable drag source pattern works the same as before
//   - After commit: tl.setLocked(true)
//   - After data refresh: tl.refresh(newItemsArray)

console.log("[Lookahead] lookahead.js loaded");

(function () {

    // dragstart listener is shared across all instances on the same page.
    // Attach it only once.
    var _dragstartAttached = false;

    function _attachDragstart() {
        if (_dragstartAttached) return;
        _dragstartAttached = true;
        document.addEventListener("dragstart", function (e) {
            var el = e.target.closest ? e.target.closest(".lookahead-draggable") : null;
            if (!el) return;
            e.dataTransfer.setData("taskId",       el.dataset.taskId       || "");
            e.dataTransfer.setData("taskText",     el.dataset.taskText     || "");
            e.dataTransfer.setData("taskDuration", el.dataset.taskDuration || "1");
            e.dataTransfer.setData("taskColor",    el.dataset.taskColor    || "#36ac81");
            e.dataTransfer.effectAllowed = "copy";
        });
    }

    // ----------------------------------------------------------------

    window.createLookaheadTimeline = function (config) {

        if (typeof vis === "undefined") {
            console.error("[Lookahead] vis-timeline not loaded");
            return null;
        }

        config = config || {};

        if (!config.containerId) {
            console.error("[Lookahead] createLookaheadTimeline: config.containerId is required");
            return null;
        }

        var container = document.getElementById(config.containerId);
        if (!container) {
            console.error("[Lookahead] Container not found:", config.containerId);
            return null;
        }
        container.classList.add("lookahead-container");

        // ---- Config ----
        var periodWeeks = config.weeks || 4;
        var startDate   = config.start ? new Date(config.start) : _thisMonday();
        startDate.setHours(0, 0, 0, 0);
        var endDate = _addDays(startDate, periodWeeks * 7); // reassigned by setPeriod

        // ---- DataSet ----
        var visItems = new vis.DataSet(
            (config.items || []).map(function (item) {
                return _buildItem(
                    item.id, item.taskId,
                    new Date(item.start), new Date(item.end),
                    item.text, item.color, item.className
                );
            })
        );

        // Period shading — reserved IDs so clear/refresh never removes them
        visItems.add([
            {
                id: "__bg_before", content: "", type: "background",
                className: "period-outside",
                start: _addDays(startDate, -21), end: startDate
            },
            {
                id: "__bg_after", content: "", type: "background",
                className: "period-outside",
                start: endDate, end: _addDays(endDate, 21)
            }
        ]);

        // ---- Timeline options ----
        var options = {
            stack: true,
            start: startDate,
            end:   endDate,
            min:   _addDays(startDate, -7),
            max:   _addDays(endDate,    7),
            zoomMin: 7       * 86400000,   // can't zoom past day level (< 7 days shows hours)
            zoomMax: 16 * 7  * 86400000,
            orientation:     { axis: "top" },
            showCurrentTime: true,
            margin: { item: { horizontal: 2, vertical: 4 } },
            snap: function (date) {
                var d = new Date(date);
                d.setHours(0, 0, 0, 0);
                return d;
            },
            editable: { updateTime: true, updateGroup: false, remove: true },
            onMove: function (item, callback) {
                // Reject move if task would start outside the lookahead period
                if (item.start < startDate || item.start >= endDate) {
                    callback(null);
                    return;
                }
                callback(item);
                if (typeof config.onUpdate === "function") {
                    config.onUpdate({
                        output1: item.id,
                        output2: item.start,
                        output3: item.end
                    });
                }
            },
            onRemove: function (item, callback) {
                callback(item);
                if (typeof config.onRemove === "function") {
                    config.onRemove({ output1: item.id });
                }
            }
        };

        // ---- Create timeline ----
        var timeline = new vis.Timeline(container, visItems, options);

        // ---- Fit to period on load ----
        timeline.setWindow(_addDays(startDate, -1), _addDays(endDate, 1), { animation: false });

        // ---- Period boundary lines ----
        var _startLineId = config.containerId + "-period-start";
        var _endLineId   = config.containerId + "-period-end";
        timeline.addCustomTime(startDate, _startLineId);
        timeline.addCustomTime(endDate,   _endLineId);
        // Lock them — snap back if accidentally dragged
        timeline.on("timechanged", function (props) {
            if (props.id === _startLineId) timeline.setCustomTime(startDate, _startLineId);
            if (props.id === _endLineId)   timeline.setCustomTime(endDate,   _endLineId);
        });

        // ---- Drop target ----
        var _locked = config.locked === true;

        container.addEventListener("dragover", function (e) {
            if (_locked) { e.dataTransfer.dropEffect = "none"; return; }
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            container.classList.add("drop-active");
        });

        container.addEventListener("dragleave", function (e) {
            if (!container.contains(e.relatedTarget)) {
                container.classList.remove("drop-active");
            }
        });

        container.addEventListener("drop", function (e) {
            e.preventDefault();
            container.classList.remove("drop-active");
            if (_locked) return;

            var taskId   = e.dataTransfer.getData("taskId");
            var taskText = e.dataTransfer.getData("taskText");
            var duration = parseInt(e.dataTransfer.getData("taskDuration")) || 1;
            var color    = e.dataTransfer.getData("taskColor") || "#36ac81";

            if (!taskId) return;

            var props = timeline.getEventProperties(e);
            if (!props.time) return;

            var start = new Date(props.snappedTime || props.time);
            start.setHours(0, 0, 0, 0);

            // Reject drop outside the period
            if (start < startDate || start >= endDate) {
                console.warn("[Lookahead] Drop rejected — outside period");
                return;
            }

            var end    = _addDays(start, duration);
            var itemId = "placed_" + taskId + "_" + Date.now();
            visItems.add(_buildItem(itemId, taskId, start, end, taskText, color));

            console.log("[Lookahead] Placed:", { itemId: itemId, taskId: taskId, start: start, end: end });

            if (typeof config.onPlace === "function") {
                config.onPlace({
                    output1: itemId,
                    output2: taskId,
                    output3: start,
                    output4: end
                });
            }
        });

        // ---- Shared dragstart (attached once per page) ----
        _attachDragstart();

        // ---- Lock state ----
        function _applyLock(locked) {
            _locked = locked;
            timeline.setOptions({
                editable: locked ? false : { updateTime: true, updateGroup: false, remove: true }
            });
            container.classList.toggle("lookahead-locked", locked);
            console.log("[Lookahead] " + (locked ? "Locked" : "Unlocked") + " [" + config.containerId + "]");
        }

        if (_locked) _applyLock(true);

        // ---- Helpers ----
        function _buildItem(id, taskId, start, end, text, color, className) {
            color = color || "#36ac81";
            var item = {
                id:        id,
                content:   text || taskId,
                start:     start,
                end:       end,
                title:     (text || taskId) + " — " + Math.round((end - start) / 86400000) + " días",
                style:     "background:" + color + ";border-color:" + color + ";",
                taskId:    taskId
            };
            if (className) item.className = className;
            return item;
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

        console.log("[Lookahead] Initialized — " + periodWeeks + " weeks from " + startDate.toDateString() + " [" + config.containerId + "]");

        // ---- Public API ----
        return {
            setPeriod: function (weeks) {
                endDate = _addDays(startDate, weeks * 7);
                timeline.setWindow(startDate, endDate, { animation: { duration: 400 } });
                visItems.update({ id: "__bg_after", start: endDate, end: _addDays(endDate, 21) });
                timeline.setCustomTime(endDate, _endLineId);
            },
            setLocked: function (locked) {
                _applyLock(!!locked);
            },
            clear: function () {
                if (_locked) { console.warn("[Lookahead] Locked — clear blocked"); return; }
                var toRemove = visItems.getIds().filter(function (id) {
                    return id !== "__bg_before" && id !== "__bg_after";
                });
                visItems.remove(toRemove);
            },
            refresh: function (newItems) {
                var toRemove = visItems.getIds().filter(function (id) {
                    return id !== "__bg_before" && id !== "__bg_after";
                });
                visItems.remove(toRemove);
                visItems.add(
                    (newItems || []).map(function (item) {
                        return _buildItem(
                            item.id, item.taskId,
                            new Date(item.start), new Date(item.end),
                            item.text, item.color, item.className
                        );
                    })
                );
            },
            scrollTo: function (date) {
                timeline.moveTo(date, { animation: { duration: 400 } });
            }
        };
    };

})();
