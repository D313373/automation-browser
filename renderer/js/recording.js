// Import shared state
import { state } from './shared-state.js';

// DOM Elements
let toggleRecordingBtn;
let clearBtn;
let recordingOverlay;
let recordingBanner;
let recordingDot;
let recordingText;
let actionList;

// Initialize DOM elements
function initElements() {
    toggleRecordingBtn = document.getElementById('toggle-recording-btn');
    clearBtn = document.getElementById('clear-actions');
    recordingOverlay = document.getElementById('recording-overlay');
    recordingBanner = document.getElementById('recording-banner');
    recordingDot = document.getElementById('recording-dot');
    recordingText = document.getElementById('recording-text');
    
    // Check for required elements
    if (!toggleRecordingBtn || !clearBtn || !recordingOverlay || !recordingBanner || !recordingDot || !recordingText) {
        console.error('One or more required elements not found in the DOM');
        return false;
    }
    return true;
}

// Initialize recording functionality
async function initRecording() {
    // Initialize DOM elements
    if (!initElements()) {
        console.error('Failed to initialize recording: Required elements not found');
        return;
    }
    
    // Set up recording toggle button
    if (toggleRecordingBtn) {
        toggleRecordingBtn.addEventListener('click', toggleRecording);
    } else {
        console.error('Toggle recording button not found');
    }

    // Set up clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            console.log('Clear actions button clicked');
            try {
                if (window.electronAPI && typeof window.electronAPI.clearActions === 'function') {
                    await window.electronAPI.clearActions();
                }
                state.actions = [];
                if (typeof updateActionList === 'function') {
                    updateActionList();
                }
            } catch (error) {
                console.error('Error clearing actions:', error);
            }
        });
    } else {
        console.warn('Could not find clear-actions button');
    }
    
    // Initialize action list element
    actionList = document.getElementById('action-list');
    if (!actionList) {
        console.warn('Action list element not found');
    }

    // Listen for recording status updates
    if (window.electronAPI) {
        console.log('Setting up recording state change listener...');
        
        // Initialize electron API with fallbacks
        const electronAPI = window.electronAPI || {
          startRecording: async () => {
            console.warn('electronAPI.startRecording not available in this context');
            return { success: false, message: 'Not available' };
          },
          stopRecording: async () => {
            console.warn('electronAPI.stopRecording not available in this context');
            return { success: false, message: 'Not available' };
          },
          onRecordingStateChanged: (callback) => {
            console.warn('electronAPI.onRecordingStateChanged not available in this context');
            return () => {};
          }
        };

        // Add debug logging for electronAPI availability
        console.log('electronAPI available:', !!window.electronAPI);
        if (window.electronAPI) {
          console.log('Available electronAPI methods:', Object.keys(window.electronAPI));
        }
        
        // Listen for recording state changes
        if (typeof electronAPI.onRecordingStateChanged === 'function') {
            electronAPI.onRecordingStateChanged((isRecording) => {
                console.log('Recording state changed (via onRecordingStateChanged):', isRecording);
                state.isRecording = isRecording;
                updateRecordingUI(isRecording);
            });
        } else {
            console.warn('onRecordingStateChanged not available on electronAPI');
        }
        
        // Also listen for the old event name for backward compatibility
        if (typeof electronAPI.onRecordingStatus === 'function') {
            electronAPI.onRecordingStatus((event, status) => {
                console.log('Recording status received (via onRecordingStatus):', status);
                if (status && typeof status.isRecording !== 'undefined') {
                    state.isRecording = status.isRecording;
                    updateRecordingUI(status.isRecording);
                }
            });
        }
    } else {
        console.warn('electronAPI not available');
    }
}

// Toggle recording state
async function toggleRecording() {
    try {
        if (state.isRecording) {
            console.log('Stopping recording...');
            const result = await window.electronAPI.stopRecording();
            console.log('Stop recording result:', result);
            state.isRecording = false;
            updateRecordingUI(false);
        } else {
            console.log('Starting recording...');
            const result = await window.electronAPI.startRecording();
            console.log('Start recording result:', result);
            if (result && result.success) {
                state.isRecording = true;
                updateRecordingUI(true);
            }
        }
    } catch (error) {
        console.error('Error toggling recording:', error);
        state.isRecording = false;
        updateRecordingUI(false);
    }
}

function updateRecordingUI(isRecording) {
    if (!recordingOverlay || !recordingBanner || !recordingDot || !recordingText || !toggleRecordingBtn) {
        console.error('One or more recording UI elements not found');
        return;
    }
    
    try {
        if (isRecording) {
            recordingOverlay.classList.remove('hidden');
            recordingBanner.classList.remove('hidden');
            recordingDot.classList.add('recording');
            recordingText.textContent = 'Recording';
            toggleRecordingBtn.textContent = 'Stop Recording';
            toggleRecordingBtn.classList.add('recording');
        } else {
            recordingOverlay.classList.add('hidden');
            recordingBanner.classList.add('hidden');
            recordingDot.classList.remove('recording');
            recordingText.textContent = 'Not Recording';
            toggleRecordingBtn.textContent = 'Start Recording';
            toggleRecordingBtn.classList.remove('recording');
        }
    } catch (error) {
        console.error('Error updating recording UI:', error);
    }
}

// Action list management
function updateActionList(actions = state.actions) {
    if (!actionList) {
        console.warn('Action list element not found');
        return;
    }

    // Clear existing actions
    actionList.innerHTML = '';

    if (!actions || actions.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'No actions recorded yet. Start recording to capture actions.';
        actionList.appendChild(emptyMessage);
        return;
    }

    // Add each action to the list
    actions.forEach((action, index) => {
        const actionElement = document.createElement('div');
        actionElement.className = 'action-item';
        actionElement.dataset.actionId = action.id || `action-${index}`;
        
        // Create action header
        const header = document.createElement('div');
        header.className = 'action-header';
        
        const actionType = document.createElement('span');
        actionType.className = 'action-type';
        actionType.textContent = action.type || 'Unknown Action';
        
        const actionTime = document.createElement('span');
        actionTime.className = 'action-time';
        actionTime.textContent = formatTimestamp(action.timestamp);
        
        header.appendChild(actionType);
        header.appendChild(actionTime);
        
        // Create action details
        const details = document.createElement('div');
        details.className = 'action-details';
        
        try {
            // Format action details based on type
            let detailsText = '';
            switch(action.type) {
                case 'navigate':
                    detailsText = `URL: ${action.url || 'N/A'}`;
                    break;
                case 'click':
                    detailsText = `Selector: ${action.selector || 'N/A'}`;
                    break;
                case 'type':
                    detailsText = `Text: ${action.text ? '•••••' : 'N/A'}`; // Mask sensitive text
                    break;
                default:
                    detailsText = JSON.stringify(action, null, 2);
            }
            details.textContent = detailsText;
        } catch (e) {
            console.error('Error formatting action details:', e);
            details.textContent = 'Error displaying action details';
        }
        
        actionElement.appendChild(header);
        actionElement.appendChild(details);
        actionList.appendChild(actionElement);
    });
}

// Format timestamp for display
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    } catch (e) {
        console.error('Error formatting timestamp:', e);
        return '';
    }
}

// Initialize recording when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM fully loaded, initializing recording...');
        initRecording();
        
        // Set up action recording listener
        if (window.electronAPI) {
            window.electronAPI.onActionRecorded((action) => {
                console.log('Action recorded in renderer:', action);
                if (action) {
                    state.actions = state.actions || [];
                    state.actions.push(action);
                    updateActionList();
                }
            });
            
            // Listen for actions cleared event
            window.electronAPI.on('actions-cleared', () => {
                console.log('Actions cleared in renderer');
                state.actions = [];
                updateActionList();
            });
        }
    });
} else {
    console.log('DOM already loaded, initializing recording...');
    initRecording();
    
    // Set up action recording listener if DOM is already loaded
    if (window.electronAPI) {
        window.electronAPI.onActionRecorded((action) => {
            console.log('Action recorded in renderer (late binding):', action);
            if (action) {
                state.actions = state.actions || [];
                state.actions.push(action);
                updateActionList();
            }
        });
        
        // Listen for actions cleared event
        window.electronAPI.on('actions-cleared', () => {
            console.log('Actions cleared in renderer (late binding)');
            state.actions = [];
            updateActionList();
        });
    }
}

// Export functions for other modules to use
window.recording = {
    start: async () => {
        if (window.electronAPI && typeof window.electronAPI.startRecording === 'function') {
            try {
                console.log('Starting recording via window.recording.start()');
                const result = await window.electronAPI.startRecording();
                if (result && result.success) {
                    state.isRecording = true;
                    updateRecordingUI(true);
                } else {
                    console.error('Failed to start recording:', result?.message || 'Unknown error');
                }
                return result;
            } catch (error) {
                console.error('Error in window.recording.start():', error);
                state.isRecording = false;
                updateRecordingUI(false);
                throw error;
            }
        } else {
            const error = 'electronAPI.startRecording is not available';
            console.error(error);
            throw new Error(error);
        }
    },
    stop: async () => {
        if (window.electronAPI && typeof window.electronAPI.stopRecording === 'function') {
            try {
                console.log('Stopping recording via window.recording.stop()');
                const result = await window.electronAPI.stopRecording();
                if (result && result.success) {
                    state.isRecording = false;
                    updateRecordingUI(false);
                } else {
                    console.error('Failed to stop recording:', result?.message || 'Unknown error');
                }
                return result;
            } catch (error) {
                console.error('Error in window.recording.stop():', error);
                state.isRecording = false;
                updateRecordingUI(false);
                throw error;
            }
        } else {
            const error = 'electronAPI.stopRecording is not available';
            console.error(error);
            throw new Error(error);
        }
    },
    isRecording: () => {
        return state.isRecording || false;
    }
};

// Log when the recording module is ready
console.log('Recording module initialized');


const startRecordingBtn = document.getElementById('start-recording-btn');

if (startRecordingBtn) {
    startRecordingBtn.addEventListener('click', async () => {
        if (!isRecording) {
            window.hideDashboard();
            await window.electronAPI.startRecording();
        }
    });
}

console.log('Recording module loaded');
