// Curva S — planned vs. actual cumulative progress
// Requires: Chart.js 2.7.3, DHTMLX overlay plugin

window.initSCurve = function() {
    if (!gantt.ext || !gantt.ext.overlay) {
        console.warn("[Gantt] overlay plugin not available — Curva S disabled");
        return;
    }

    var overlayControl = gantt.ext.overlay;
    var myChart = null;
    var lineOverlay;
    var dateToStr = gantt.date.date_to_str("%d/%m/%Y");

    // ---- Data helpers ----

    function getChartScaleRange() {
        var tasksRange = gantt.getSubtaskDates();
        var scale = gantt.getScale();
        if (!tasksRange.start_date) return scale.trace_x;

        var cells = [];
        scale.trace_x.forEach(function(date, index) {
            var within = +tasksRange.start_date <= +date && +date <= +tasksRange.end_date;
            var left = index !== scale.trace_x.length - 1 &&
                       +date < +tasksRange.start_date &&
                       +tasksRange.start_date < +scale.trace_x[index + 1];
            var right = index > 0 &&
                        +scale.trace_x[index - 1] < +tasksRange.end_date &&
                        +tasksRange.end_date < +date;
            if (within || left || right) cells.push(date);
        });
        return cells;
    }

    function getProgressLine() {
        var today = new Date();
        var scale = gantt.getScale();
        var step = scale.unit;
        var timegrid = {};
        var totalDuration = 0;

        gantt.eachTask(function(task) {
            if (gantt.isSummaryTask(task) || !task.duration) return;

            var currDate = gantt.date[step + "_start"](new Date(task.start_date));
            while (currDate < task.end_date) {
                var date = currDate;
                currDate = gantt.date.add(currDate, 1, step);
                if (!gantt.isWorkTime({ date: date, task: task, unit: step })) continue;

                var ts = currDate.valueOf();
                if (!timegrid[ts]) timegrid[ts] = { planned: 0, real: 0 };
                timegrid[ts].planned += 1;
                if (date <= today) timegrid[ts].real += 1 * (task.progress || 0);
                totalDuration += 1;
            }
        });

        var chartScale = getChartScaleRange();
        var cumulativePlanned = [], cumulativeReal = [], cumulativePredicted = [];
        var totalPlanned = 0, totalReal = 0;
        var dailyRealProgress = -1, totalPredictedProgress = 0;

        for (var i = 0; i < chartScale.length; i++) {
            var cell = timegrid[chartScale[i].valueOf()] || { planned: 0, real: 0 };
            totalPlanned += cell.planned;
            cumulativePlanned.push(totalPlanned);

            if (chartScale[i] <= today) {
                totalReal += (cell.real || 0);
                cumulativeReal.push(totalReal);
                cumulativePredicted.push(null);
            } else {
                if (dailyRealProgress < 0) {
                    dailyRealProgress = cumulativeReal.length ? totalReal / cumulativeReal.length : 0;
                    totalPredictedProgress = totalReal;
                    cumulativePredicted.pop();
                    cumulativePredicted.push(totalPredictedProgress);
                }
                totalPredictedProgress += dailyRealProgress;
                cumulativePredicted.push(totalPredictedProgress);
            }
        }

        if (totalPlanned > 0) {
            for (var j = 0; j < cumulativePlanned.length; j++) {
                cumulativePlanned[j] = Math.round(cumulativePlanned[j] / totalPlanned * 100);
                if (cumulativeReal[j] !== undefined)
                    cumulativeReal[j] = Math.round(cumulativeReal[j] / totalPlanned * 100);
                if (cumulativePredicted[j] !== null && cumulativePredicted[j] !== undefined)
                    cumulativePredicted[j] = Math.round(cumulativePredicted[j] / totalPlanned * 100);
            }
        }

        return { planned: cumulativePlanned, real: cumulativeReal, predicted: cumulativePredicted };
    }

    function getScalePaddings() {
        var scale = gantt.getScale();
        var dataRange = gantt.getSubtaskDates();
        var padding = { left: 0, right: 0, top: 0, bottom: 0 };
        if (dataRange.start_date) {
            var yLabelWidth = 48;
            padding.left   = gantt.posFromDate(dataRange.start_date) - yLabelWidth;
            padding.right  = scale.full_width - gantt.posFromDate(dataRange.end_date) - yLabelWidth;
            padding.top    = gantt.config.row_height - 12;
            padding.bottom = gantt.config.row_height - 12;
        }
        return padding;
    }

    // ---- Overlay ----

    lineOverlay = overlayControl.addOverlay(function(container) {
        var chartScale = getChartScaleRange();
        var scaleLabels = chartScale.map(function(d) { return dateToStr(d); });
        var values = getProgressLine();

        var canvas = document.createElement("canvas");
        container.appendChild(canvas);
        canvas.style.height = container.offsetHeight + "px";
        canvas.style.width  = container.offsetWidth  + "px";

        if (myChart) myChart.destroy();

        myChart = new Chart(canvas.getContext("2d"), {
            type: "line",
            data: {
                datasets: [
                    {
                        label: "Planificado",
                        borderColor: "#2563eb",
                        backgroundColor: "#2563eb",
                        data: values.planned,
                        fill: false,
                        cubicInterpolationMode: "monotone"
                    },
                    {
                        label: "Real",
                        borderColor: "#36ac81",
                        backgroundColor: "#36ac81",
                        data: values.real,
                        fill: false,
                        cubicInterpolationMode: "monotone"
                    },
                    {
                        label: "Proyectado",
                        borderColor: "#36ac81",
                        backgroundColor: "#36ac81",
                        data: values.predicted,
                        borderDash: [5, 10],
                        fill: false,
                        cubicInterpolationMode: "monotone"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: getScalePaddings() },
                onResize: function(chart) {
                    if (gantt.getSubtaskDates().start_date)
                        chart.options.layout.padding = getScalePaddings();
                },
                legend: { display: true, position: "top" },
                tooltips: {
                    mode: "index",
                    intersect: false,
                    callbacks: {
                        label: function(item, data) {
                            var dataset = data.datasets[item.datasetIndex];
                            var val = dataset.data[item.index];
                            return val !== null && val !== undefined
                                ? dataset.label + ": " + val + "%"
                                : null;
                        }
                    }
                },
                scales: {
                    xAxes: [
                        { labels: scaleLabels, gridLines: { display: false }, ticks: { display: false } },
                        { position: "top", labels: scaleLabels, gridLines: { display: false }, ticks: { display: false } }
                    ],
                    yAxes: [
                        {
                            gridLines: { display: false },
                            ticks: { min: 0, max: 100, stepSize: 10, callback: function(v) { return v <= 100 ? v + "%" : ""; } }
                        },
                        {
                            position: "right",
                            gridLines: { display: false },
                            ticks: { min: 0, max: 100, stepSize: 10, callback: function(v) { return v <= 100 ? v + "%" : ""; } }
                        }
                    ]
                }
            }
        });

        return canvas;
    });

    // ---- Toggle button ----

    var ganttContainer = document.getElementById("gantt_here");
    var btn = document.createElement("button");
    btn.id = "gantt-scurve-btn";
    btn.textContent = "📈 Curva S";
    ganttContainer.appendChild(btn);

    btn.addEventListener("click", function() {
        if (overlayControl.isOverlayVisible(lineOverlay)) {
            overlayControl.hideOverlay(lineOverlay);
            gantt.$root.classList.remove("overlay_visible");
            btn.classList.remove("active");
        } else {
            overlayControl.showOverlay(lineOverlay);
            gantt.$root.classList.add("overlay_visible");
            btn.classList.add("active");
        }
    });

    console.log("[Gantt] Curva S initialized");
};
