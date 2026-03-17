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