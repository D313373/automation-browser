// Global state for recording
let isRecording = false;
let actions = [];

const toggleRecordingBtn = document.getElementById('toggle-recording-btn');
const clearBtn = document.getElementById('clear-actions');

toggleRecordingBtn.addEventListener('click', async () => {
    if (isRecording) {
        await window.electronAPI.stopRecording();
    } else {
        window.hideDashboard();
        await window.electronAPI.startRecording();
    }
});

function updateRecordingUI(isRecording) {
    const message = isRecording ? 'Recording...' : 'Ready to record';
    console.log(`Recording status: ${isRecording}, Message: ${message}`);

    const recordIcon = toggleRecordingBtn.querySelector('.record-icon');
    const recordText = toggleRecordingBtn.querySelector('.record-text');

    if (isRecording) {
        recordingOverlay.classList.remove('hidden');
        recordingBanner.classList.remove('hidden');
        recordingDot.classList.add('recording');
        recordingText.textContent = 'Recording...';
        toggleRecordingBtn.classList.add('stop-btn');
        toggleRecordingBtn.classList.remove('record-btn');
        recordIcon.textContent = '■';
        recordText.textContent = 'Stop';
    } else {
        recordingOverlay.classList.add('hidden');
        recordingBanner.classList.add('hidden');
        recordingDot.classList.remove('recording');
        recordingText.textContent = message || 'Ready to record';
        toggleRecordingBtn.classList.remove('stop-btn');
        toggleRecordingBtn.classList.add('record-btn');
        recordIcon.textContent = '●';
        recordText.textContent = 'Record';
    }
}

clearBtn.addEventListener('click', async () => {
    await window.electronAPI.clearActions();
    actions = [];
    updateActionList();
});


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
