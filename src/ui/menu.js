const { Menu, ipcMain, BrowserWindow, app } = require('electron');
const { logger } = require('../utils/logger');
const recordingManager = require('../recording/recordingManager');

function createMenu(mainWindow) {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            logger.info('Creating new window');
            // TODO: Implement new window creation
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            logger.info('Opening settings');
            // TODO: Implement settings window
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          role: 'quit',
          accelerator: 'CmdOrCtrl+Q'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Recording',
      submenu: [
        {
          id: 'toggle-recording',
          label: 'Start Recording',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            try {
              if (recordingManager.isRecording) {
                logger.info('Stopping recording from menu');
                recordingManager.stopRecording();
              } else {
                logger.info('Starting recording from menu');
                recordingManager.startRecording();
              }
            } catch (error) {
              logger.error('Error toggling recording from menu:', error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Save Recording',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            logger.info('Saving recording');
            // TODO: Implement save recording
          }
        }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/your-org/automation-browser');
          }
        },
        {
          label: 'Report Issue',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/your-org/automation-browser/issues');
          }
        },
        {
          label: 'About',
          click: () => {
            // TODO: Show about dialog
            logger.info('Showing about dialog');
          }
        }
      ]
    }
  ];

  // Add special menu items for macOS
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  return menu;
}

// Update menu items based on recording state
function updateMenuForRecordingState(isRecording) {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;

  const toggleRecordingItem = menu.getMenuItemById('toggle-recording');
  if (toggleRecordingItem) {
    toggleRecordingItem.label = isRecording ? 'Stop Recording' : 'Start Recording';
  }
}

// Listen for recording state changes
ipcMain.on('recording-status', (event, data) => {
  updateMenuForRecordingState(data.isRecording);
});

module.exports = { createMenu, updateMenuForRecordingState };
