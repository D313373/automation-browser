const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  // Browser navigation
  navigateTo: (url) => ipcRenderer.invoke('navigate-to', url),
  browserBack: () => ipcRenderer.invoke('browser-back'),
  browserForward: () => ipcRenderer.invoke('browser-forward'),
  browserReload: () => ipcRenderer.invoke('browser-reload'),
  showBrowserView: () => ipcRenderer.send('show-browser-view'),
  hideBrowserView: () => ipcRenderer.send('hide-browser-view'),
  getCurrentUrl: () => ipcRenderer.invoke('get-current-url'),
  
  // Recording controls
  startRecording: async () => {
    try {
      console.log('[preload] Starting recording...');
      const result = await ipcRenderer.invoke('start-recording');
      console.log('[preload] Start recording result:', result);
      return result;
    } catch (error) {
      console.error('[preload] Error in startRecording:', error);
      throw error;
    }
  },
  stopRecording: async () => {
    try {
      console.log('[preload] Stopping recording...');
      const result = await ipcRenderer.invoke('stop-recording');
      console.log('[preload] Stop recording result:', result);
      return result;
    } catch (error) {
      console.error('[preload] Error in stopRecording:', error);
      throw error;
    }
  },
  recordAction: (action) => {
    console.log('[preload] Recording action:', action?.type || 'unknown');
    ipcRenderer.send('record-action', action);
  },
  clearActions: async () => {
    try {
      console.log('[preload] Clearing recorded actions');
      return await ipcRenderer.invoke('clear-actions');
    } catch (error) {
      console.error('[preload] Error clearing actions:', error);
      throw error;
    }
  },
  
  // Credential management
  storeCredential: (credential) => ipcRenderer.send('store-credential', credential),
  storeCredentials: (credentialData) => ipcRenderer.invoke('store-credentials', credentialData),
  getCredentials: (scriptId) => ipcRenderer.invoke('get-credentials', scriptId),
  updateCredential: (credentialData) => ipcRenderer.invoke('update-credential', credentialData),
  deleteCredential: (credentialKey) => ipcRenderer.invoke('delete-credential', credentialKey),
  
  // Automation execution
  runAutomation: () => ipcRenderer.invoke('run-automation'),
  
  // Event listeners
  onRecordingStateChanged: (callback) => {
    const handler = (event, isRecording) => {
      console.log(`[preload] Recording state changed: ${isRecording ? 'STARTED' : 'STOPPED'}`);
      try {
        callback(isRecording);
      } catch (error) {
        console.error('[preload] Error in recording state change handler:', error);
      }
    };
    
    ipcRenderer.on('recording-state-changed', handler);
    
    // Return cleanup function
    return () => {
      ipcRenderer.off('recording-state-changed', handler);
    };
  },
  
  onBrowserLoading: (callback) => {
    ipcRenderer.on('browser-loading', callback);
  },
  
  onUrlChanged: (callback) => {
    ipcRenderer.on('url-changed', callback);
  },
  
  onTitleChanged: (callback) => {
    ipcRenderer.on('title-changed', callback);
  },
  
  onRecordingStatus: (callback) => {
    ipcRenderer.on('recording-status', callback);
  },
  
  onActionRecorded: (callback) => {
    ipcRenderer.on('action-recorded', callback);
  },
  
  onActionsRecorded: (callback) => {
    ipcRenderer.on('actions-recorded', callback);
  },
  
  onPythonServerStatus: (callback) => {
    ipcRenderer.on('python-server-status', callback);
  },
  
  onPythonMessage: (callback) => {
    ipcRenderer.on('python-message', callback);
  },
  
  // Utility
  platform: process.platform
});

console.log('Automation Browser preload script loaded');