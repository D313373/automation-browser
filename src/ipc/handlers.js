const { ipcMain } = require('electron');
const { logger } = require('../utils/logger');
const recordingManager = require('../recording/recordingManager');

function setupIPCHandlers(mainWindow, browserView) {

  ipcMain.handle('get-recorded-actions', async () => {
    try {
      return recordingManager.getRecordedActions();
    } catch (error) {
      logger.error('Error getting recorded actions:', error);
      throw error;
    }
  });

  ipcMain.handle('clear-recorded-actions', async () => {
    try {
      recordingManager.clearRecordedActions();
      return { success: true };
    } catch (error) {
      logger.error('Error clearing recorded actions:', error);
      throw error;
    }
  });

  ipcMain.on('hide-browser-view', () => {
    if (mainWindow) {
      mainWindow.setBrowserView(null);
      logger.info('BrowserView hidden.');
    }
  });

  ipcMain.on('show-browser-view', () => {
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
  ipcMain.handle('navigate-to', async (event, url) => {
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

  // Error handling for unresponsive handlers
  ipcMain.on('error', (event, error) => {
    logger.error('IPC Error:', error);
  });

  ipcMain.handle('get-current-url', async () => {
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
  ipcMain.handle('store-credentials', (event, credentialData) => {
    console.log('Storing session credentials for automatic replacement');
    // This needs to be stored in a way that the main process can access it.
    // For now, we'll attach it to a global or a dedicated config module.
    global.sessionCredentials = credentialData.credentials;
    return { success: true };
  });

  ipcMain.on('store-credential', (event, credential) => {
    console.log('Storing credential securely:', { ...credential, value: '[HIDDEN]' });
    // Implement secure storage logic here (e.g., using electron-store or keytar)
  });

  ipcMain.handle('get-credentials', (event, scriptId) => {
    // Implement logic to retrieve stored credentials
    return {};
  });

  ipcMain.handle('update-credential', (event, credentialData) => {
    // Implement logic to update a stored credential
    return { success: true };
  });

  ipcMain.handle('delete-credential', (event, credentialKey) => {
    // Implement logic to delete a stored credential
    return { success: true };
  });
}

module.exports = { setupIPCHandlers };
