const { BrowserWindow, BrowserView } = require('electron');
const path = require('path');

class WindowManager {
  constructor() {
    this.mainWindow = null;
  }

  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js'),
        devTools: true,
        webSecurity: false
      },
    });
    
    // Open DevTools for main window
    this.mainWindow.webContents.openDevTools();

    // Load the main app shell
    this.mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));

    // Explicitly show the window
    this.mainWindow.show();

    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: false,
        preload: path.join(__dirname, '../preload.js'),
        devTools: true,
        webSecurity: false
      }
    });
    
    // Open DevTools for browser view
    view.webContents.openDevTools({ mode: 'detach' });

    // Defer setting the browser view until the user is ready.
    // this.mainWindow.setBrowserView(view);
    const [width, height] = this.mainWindow.getContentSize();
    const sidePanelWidth = 350;
    const topBarHeight = 80;
    view.setBounds({
      x: sidePanelWidth,
      y: topBarHeight,
      width: width - sidePanelWidth,
      height: height - topBarHeight
    });

    view.webContents.loadURL('https://www.google.com');


    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return { window: this.mainWindow, view };
  }
}

module.exports = new WindowManager();
