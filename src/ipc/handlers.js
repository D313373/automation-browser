const { ipcMain } = require('electron');
const { logger } = require('../utils/logger');
const recordingManager = require('../recording/recordingManager');

let isInitialized = false;

// Track registered handlers to prevent duplicates
const registeredHandlers = new Set();

function safeRegisterHandler(channel, handler) {
  if (registeredHandlers.has(channel)) {
    logger.warn(`[IPC] Handler for '${channel}' already registered, skipping duplicate registration`);
    return;
  }
  
  logger.debug(`[IPC] Registering handler for '${channel}'`);
  registeredHandlers.add(channel);
  ipcMain.handle(channel, handler);
}

function setupIPCHandlers(mainWindow, browserView) {
  if (isInitialized) {
    logger.warn('setupIPCHandlers called more than once! This should not happen.');
    return;
  }
  isInitialized = true;
  
  logger.info('Initializing IPC handlers...');
  
  // Initialize recording manager
  recordingManager.initialize();

  // Forward recording manager events to renderer
  recordingManager.on('recording-state-changed', (isRecording) => {
    browserView?.webContents?.send('recording-state-changed', isRecording);
  });

  recordingManager.on('recording-status', (status) => {
    browserView?.webContents?.send('recording-status', status);
  });

  recordingManager.on('action-recorded', (action) => {
    browserView?.webContents?.send('action-recorded', action);
  });

  recordingManager.on('actions-cleared', () => {
    browserView?.webContents?.send('actions-cleared');
  });

  // Browser navigation handlers
  safeRegisterHandler('navigate-to', async (event, url) => {
    try {
      logger.info(`[IPC] Navigating to: ${url}`);
      await browserView.webContents.loadURL(url);
      return { success: true };
    } catch (error) {
      logger.error(`[IPC] Error navigating to ${url}:`, error);
      return { success: false, error: error.message };
    }
  });

  safeRegisterHandler('browser-back', async () => {
    try {
      logger.info('[IPC] Navigating back');
      await browserView.webContents.goBack();
      return { success: true };
    } catch (error) {
      logger.error('[IPC] Error navigating back:', error);
      return { success: false, error: error.message };
    }
  });

  safeRegisterHandler('browser-forward', async () => {
    try {
      logger.info('[IPC] Navigating forward');
      await browserView.webContents.goForward();
      return { success: true };
    } catch (error) {
      logger.error('[IPC] Error navigating forward:', error);
      return { success: false, error: error.message };
    }
  });

  safeRegisterHandler('browser-reload', async () => {
    try {
      logger.info('[IPC] Reloading page');
      await browserView.webContents.reload();
      return { success: true };
    } catch (error) {
      logger.error('[IPC] Error reloading page:', error);
      return { success: false, error: error.message };
    }
  });

  // Recording management handlers
  safeRegisterHandler('start-recording', async () => {
    try {
      logger.info('[IPC] Starting recording...');
      const result = recordingManager.startRecording();
      return result;
    } catch (error) {
      logger.error('[IPC] Error starting recording:', error);
      throw error;
    }
  });

  safeRegisterHandler('stop-recording', async () => {
    try {
      logger.info('[IPC] Stopping recording...');
      const result = recordingManager.stopRecording();
      return result;
    } catch (error) {
      logger.error('[IPC] Error stopping recording:', error);
      throw error;
    }
  });

  safeRegisterHandler('get-recorded-actions', async () => {
    try {
      return recordingManager.getRecordedActions();
    } catch (error) {
      logger.error('[IPC] Error getting recorded actions:', error);
      throw error;
    }
  });

  safeRegisterHandler('clear-recorded-actions', async () => {
    try {
      recordingManager.clearRecordedActions();
      return { success: true };
    } catch (error) {
      logger.error('Error clearing recorded actions:', error);
      throw error;
    }
  });

  // Safe event listener registration
  function safeOn(channel, handler) {
    if (registeredHandlers.has(`on:${channel}`)) {
      logger.warn(`[IPC] Event listener for '${channel}' already registered, skipping duplicate`);
      return;
    }
    logger.debug(`[IPC] Registering event listener for '${channel}'`);
    registeredHandlers.add(`on:${channel}`);
    ipcMain.on(channel, handler);
  }

  safeOn('hide-browser-view', () => {
    if (mainWindow) {
      mainWindow.setBrowserView(null);
      logger.info('BrowserView hidden.');
    }
  });

  safeOn('show-browser-view', () => {
    if (mainWindow && browserView) {
      mainWindow.setBrowserView(browserView);
      const [width, height] = mainWindow.getContentSize();
      const sidePanelWidth = 350;
      const topBarHeight = 80;
      browserView.setBounds({
        x: sidePanelWidth,
        y: topBarHeight,
        width: width - sidePanelWidth,
        height: height - topBarHeight
      });
      logger.info('BrowserView shown and bounds set.');
    }
  });

  // Navigation handlers
  safeRegisterHandler('navigate-to', async (event, url) => {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      if (browserView) {
        await browserView.webContents.loadURL(url);
      }
      logger.info(`Navigating to: ${url}`);
      return { success: true, url };
    } catch (error) {
      logger.error('Navigation error:', error);
      throw error;
    }
  });

  // Record action handler
  ipcMain.on('record-action', (event, action) => {
    try {
      logger.debug('Received recorded action:', action?.type || 'unknown', action);
      
      // Forward the action to the recording manager
      if (recordingManager.isRecording) {
        recordingManager.recordAction(action);
        
        // Broadcast the updated actions list to all windows
        const actions = recordingManager.getRecordedActions();
        mainWindow?.webContents?.send('actions-updated', actions);
        
        // Also send individual action for real-time updates
        mainWindow?.webContents?.send('action-recorded', action);
      }
    } catch (error) {
      logger.error('Error handling record-action:', error);
    }
  });

  // Error handling for unresponsive handlers
  safeOn('error', (event, error) => {
    logger.error('IPC Error:', error);
  });

  safeRegisterHandler('get-current-url', async () => {
    try {
      if (browserView) {
        return browserView.webContents.getURL();
      }
      return null;
    } catch (error) {
      logger.error('Error getting current URL:', error);
      throw error;
    }
  });

  // Credential management handlers
  safeRegisterHandler('store-credentials', (event, credentialData) => {
    console.log('Storing session credentials for automatic replacement');
    // This needs to be stored in a way that the main process can access it.
    // For now, we'll attach it to a global or a dedicated config module.
    global.sessionCredentials = credentialData.credentials;
    return { success: true };
  });

  safeOn('store-credential', (event, credential) => {
    console.log('Storing credential securely:', { ...credential, value: '[HIDDEN]' });
    // Implement secure storage logic here (e.g., using electron-store or keytar)
  });

  safeRegisterHandler('get-credentials', (event, scriptId) => {
    // Implement logic to retrieve stored credentials
    return {};
  });

  safeRegisterHandler('update-credential', (event, credentialData) => {
    // Implement logic to update a stored credential
    return { success: true };
  });

  safeRegisterHandler('delete-credential', (event, credentialKey) => {
    // Implement logic to delete a stored credential
    return { success: true };
  });
}

module.exports = { setupIPCHandlers };
