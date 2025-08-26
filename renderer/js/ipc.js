// Event listeners for electron events
window.electronAPI.onRecordingStateChanged((state) => {
    isRecording = state;
    updateRecordingUI(isRecording);
});

window.electronAPI.onUrlChanged((event, url) => {
    currentUrl = url;
    urlBar.value = url;
});

window.electronAPI.onActionRecorded((event, action) => {
    actions.push(action);
    updateActionList();
});

window.electronAPI.onActionsRecorded((event, recordedActions) => {
    actions = recordedActions;
    updateActionList();
});

window.electronAPI.onPythonServerStatus((event, status) => {
    updateServerStatus(status);
});

window.electronAPI.onPythonMessage((event, message) => {
    console.log('Python server message:', message);
    // Handle automation feedback here
});

// Initialize current URL
window.electronAPI.getCurrentUrl().then(url => {
    currentUrl = url;
    urlBar.value = url;
});

console.log('IPC module loaded');
