const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');

class RecordingManager {
  constructor() {
    this.isRecording = false;
    this.recordedActions = [];
  }

  initialize() {
    // The 'record-action' listener is initiated from the renderer, so it's safe to keep here.
    ipcMain.on('record-action', (event, action) => {
      if (!this.isRecording) return;
      
      const timestamp = Date.now();
      const recordedAction = {
        ...action,
        id: `action_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp
      };
      
      this.recordedActions.push(recordedAction);
      this.broadcastToWindows('action-recorded', recordedAction);
    });
  }

  startRecording() {
    if (this.isRecording) return { success: false, message: 'Already recording' };
    
    this.isRecording = true;
    this.recordedActions = [];
    
    this.broadcastToWindows('recording-status', { isRecording: true });
    
    return { success: true, message: 'Recording started' };
  }

  stopRecording() {
    if (!this.isRecording) return { success: false, message: 'Not recording' };
    
    this.isRecording = false;
    
    this.broadcastToWindows('recording-status', { 
      isRecording: false,
      actionCount: this.recordedActions.length
    });
    
    return { 
      success: true, 
      message: 'Recording stopped',
      actionCount: this.recordedActions.length
    };
  }

  broadcastToWindows(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (window.webContents && !window.webContents.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    });
  }

  getRecordedActions() {
    return this.recordedActions;
  }

  clearRecordedActions() {
    this.recordedActions = [];
    this.broadcastToWindows('actions-cleared', {});
  }
}

module.exports = new RecordingManager();
