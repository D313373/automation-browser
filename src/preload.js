const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Browser navigation
  navigateTo: (url) => ipcRenderer.invoke('navigate-to', url),
  browserBack: () => ipcRenderer.invoke('browser-back'),
  browserForward: () => ipcRenderer.invoke('browser-forward'),
  browserReload: () => ipcRenderer.invoke('browser-reload'),
  getCurrentUrl: () => ipcRenderer.invoke('get-current-url'),
  
  // Recording controls
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  recordAction: (action) => ipcRenderer.send('record-action', action),
  clearActions: () => ipcRenderer.invoke('clear-actions'),
  
  // Credential management
  storeCredential: (credential) => ipcRenderer.send('store-credential', credential),
  storeCredentials: (credentialData) => ipcRenderer.invoke('store-credentials', credentialData),
  getCredentials: (scriptId) => ipcRenderer.invoke('get-credentials', scriptId),
  updateCredential: (credentialData) => ipcRenderer.invoke('update-credential', credentialData),
  deleteCredential: (credentialKey) => ipcRenderer.invoke('delete-credential', credentialKey),
  
  // Automation execution
  runAutomation: () => ipcRenderer.invoke('run-automation'),
  
  // Event listeners
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