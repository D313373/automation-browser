// Import shared state
import { state } from './shared-state.js';

// Function to update server status in the UI
function updateServerStatus(status) {
    const statusElement = document.getElementById('server-status');
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = `status-${status.toLowerCase()}`;
    }
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    if (!window.electronAPI) {
        console.error('window.electronAPI is not available');
        return;
    }

    const urlBar = document.getElementById('url-bar');
    
    // Set up IPC handlers
    try {
        // Recording state handler
        if (window.electronAPI.onRecordingStateChanged) {
            window.electronAPI.onRecordingStateChanged((isRecording) => {
                console.log('Recording state changed:', isRecording);
                state.isRecording = isRecording;
                // Update UI or trigger other actions as needed
            });
        } else {
            console.warn('onRecordingStateChanged IPC handler not available');
        }

        // URL change handler
        if (window.electronAPI.onUrlChanged) {
            window.electronAPI.onUrlChanged((event, url) => {
                console.log('URL changed:', url);
                if (urlBar) {
                    urlBar.value = url;
                }
                // Update any UI elements that depend on the URL
            });
        } else {
            console.warn('onUrlChanged IPC handler not available');
        }

        // Action recorder handler
        if (window.electronAPI.onActionRecorded) {
            window.electronAPI.onActionRecorded((event, action) => {
                console.log('Action recorded:', action);
                state.actions.push(action);
                // Update UI if needed
                if (typeof updateActionList === 'function') {
                    updateActionList();
                }
            });
        } else {
            console.warn('onActionRecorded IPC handler not available');
        }

        // Multiple actions recorded handler
        if (window.electronAPI.onActionsRecorded) {
            window.electronAPI.onActionsRecorded((event, recordedActions) => {
                console.log('Multiple actions recorded:', recordedActions);
                state.actions = Array.isArray(recordedActions) ? recordedActions : [];
                if (typeof updateActionList === 'function') {
                    updateActionList();
                }
            });
        }
        
        // Python server status handler
        if (window.electronAPI.onPythonServerStatus) {
            window.electronAPI.onPythonServerStatus((event, status) => {
                console.log('Python server status:', status);
                updateServerStatus(status);
            });
        }
        
        // Python message handler
        if (window.electronAPI.onPythonMessage) {
            window.electronAPI.onPythonMessage((event, message) => {
                console.log('Python server message:', message);
            });
        }
        
        // Initialize current URL
        if (window.electronAPI.getCurrentUrl) {
            window.electronAPI.getCurrentUrl().then(url => {
                console.log('Current URL:', url);
                if (urlBar) {
                    urlBar.value = url;
                }
            }).catch(error => {
                console.error('Error getting current URL:', error);
            });
        }
        
    } catch (error) {
        console.error('Error setting up IPC handlers:', error);
    }
});

console.log('IPC module loaded');
