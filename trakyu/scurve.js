// Curva S — planned vs. actual cumulative progress
// Renders as a full-coverage panel over the entire Gantt container
// Requires: Chart.js 2.7.3

window.initSCurve = function() {
    if (typeof Chart === "undefined") {
        console.warn("[Gantt] Chart.js not loaded — Curva S disabled");
        return;
    }

    var myChart = null;
    var panel   = null;
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

    function getBaselineLine() {
        if (!window.BUBBLE_BASELINE_TASKS || !window.BUBBLE_BASELINE_TASKS.length) return null;

        var scale = gantt.getScale();
        var step  = scale.unit;
        var timegrid = {};

        window.BUBBLE_BASELINE_TASKS.forEach(function(bt) {
            var startDate = new Date(bt.start_date);
            var endDate   = new Date(bt.end_date);
            if (!startDate || !endDate || startDate >= endDate) return;

            var currDate = gantt.date[step + "_start"](new Date(startDate));
            while (currDate < endDate) {
                currDate = gantt.date.add(currDate, 1, step);
                var ts = currDate.valueOf();
                if (!timegrid[ts]) timegrid[ts] = 0;
                timegrid[ts] += 1;
            }
        });

        var chartScale = getChartScaleRange();
        var cumulative = [];
        var total = 0;
        chartScale.forEach(function(d) {
            total += (timegrid[d.valueOf()] || 0);
            cumulative.push(total);
        });

        if (total > 0) {
            for (var i = 0; i < cumulative.length; i++) {
                cumulative[i] = Math.round(cumulative[i] / total * 100);
            }
        }
        return cumulative;
    }

    // ---- Panel show/hide ----

    function showSCurve() {
        var ganttContainer = document.getElementById("gantt_here");

        panel = document.createElement("div");
        panel.id = "scurve-panel";

        var header = document.createElement("div");
        header.id = "scurve-header";

        var title = document.createElement("span");
        title.textContent = "Curva S — Progreso acumulado";

        var closeBtn = document.createElement("button");
        closeBtn.id = "scurve-close-btn";
        closeBtn.textContent = "✕ Cerrar";
        closeBtn.addEventListener("click", hideSCurve);

        header.appendChild(title);
        header.appendChild(closeBtn);

        var canvas = document.createElement("canvas");
        canvas.id = "scurve-canvas";

        panel.appendChild(header);
        panel.appendChild(canvas);
        ganttContainer.appendChild(panel);

        var chartScale = getChartScaleRange();
        var scaleLabels = chartScale.map(function(d) { return dateToStr(d); });
        var values   = getProgressLine();
        var baseline = getBaselineLine();

        var datasets = [];

        if (baseline) {
            datasets.push({
                label: "Baseline",
                borderColor: "#f59e0b",
                backgroundColor: "transparent",
                data: baseline,
                borderDash: [6, 4],
                fill: false,
                cubicInterpolationMode: "monotone",
                pointRadius: 0
            });
        }

        datasets.push(
            {
                label: "Teórico",
                borderColor: "#2563eb",
                backgroundColor: "rgba(37,99,235,0.08)",
                data: values.planned,
                fill: true,
                cubicInterpolationMode: "monotone",
                pointRadius: 0
            },
            {
                label: "Real",
                borderColor: "#36ac81",
                backgroundColor: "rgba(54,172,129,0.08)",
                data: values.real,
                fill: true,
                cubicInterpolationMode: "monotone",
                pointRadius: 0
            },
            {
                label: "Proyectado",
                borderColor: "#36ac81",
                backgroundColor: "transparent",
                data: values.predicted,
                borderDash: [6, 4],
                fill: false,
                cubicInterpolationMode: "monotone",
                pointRadius: 0
            }
        );

        if (myChart) myChart.destroy();

        myChart = new Chart(canvas.getContext("2d"), {
            type: "line",
            data: {
                labels: scaleLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: {
                    display: true,
                    position: "top",
                    labels: { fontSize: 11, boxWidth: 12, padding: 8 }
                },
                tooltips: {
                    mode: "index",
                    intersect: false,
                    bodyFontSize: 11,
                    titleFontSize: 11,
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
                    xAxes: [{
                        ticks: {
                            maxRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 20,
                            fontSize: 10
                        },
                        gridLines: { color: "rgba(0,0,0,0.05)" }
                    }],
                    yAxes: [{
                        ticks: {
                            min: 0,
                            max: 100,
                            stepSize: 10,
                            fontSize: 10,
                            callback: function(v) { return v + "%"; }
                        },
                        gridLines: { color: "rgba(0,0,0,0.05)" }
                    }]
                }
            }
        });
    }

    function hideSCurve() {
        if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
        if (myChart) { myChart.destroy(); myChart = null; }
        panel = null;
        toggleBtn.textContent = "📈 Curva S";
        toggleBtn.classList.remove("active");
    }

    // ---- Toggle button ----

    var ganttContainer = document.getElementById("gantt_here");
    var toggleBtn = document.createElement("button");
    toggleBtn.id = "gantt-scurve-btn";
    toggleBtn.textContent = "📈 Curva S";
    ganttContainer.appendChild(toggleBtn);

    toggleBtn.addEventListener("click", function() {
        if (panel) {
            hideSCurve();
        } else {
            showSCurve();
            toggleBtn.textContent = "📈 Curva S";
            toggleBtn.classList.add("active");
        }
    });

    console.log("[Gantt] Curva S initialized");
};
