const { app, BrowserWindow, BrowserView, ipcMain, dialog, Menu, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const os = require('os');
const fs = require('fs');

// Keep reference to main window and python server
let mainWindow;
let browserView;
let pythonServer;
let wsConnection;
let currentUrl = 'https://www.google.com';
let isRecording = false;
let recordedActions = [];
let storedCredentials = new Map(); // Secure in-memory credential storage
let sessionCredentials = null;
let currentInputBuffer = '';
let currentInputField = null;

// Python server configuration
const PYTHON_SERVER_PORT = 8888;
const WS_PORT = 8889;

// Chrome profile paths for different operating systems
function getChromeProfilePaths() {
  const home = os.homedir();
  const platform = process.platform;
  
  switch (platform) {
    case 'darwin': // macOS
      return [
        path.join(home, 'Library/Application Support/Google/Chrome'),
        path.join(home, 'Library/Application Support/Google/Chrome Canary'),
        path.join(home, 'Library/Application Support/Chromium')
      ];
    case 'win32': // Windows
      return [
        path.join(home, 'AppData/Local/Google/Chrome/User Data'),
        path.join(home, 'AppData/Local/Google/Chrome SxS/User Data'),
        path.join(home, 'AppData/Local/Chromium/User Data')
      ];
    case 'linux': // Linux
      return [
        path.join(home, '.config/google-chrome'),
        path.join(home, '.config/google-chrome-beta'),
        path.join(home, '.config/chromium')
      ];
    default:
      return [];
  }
}

// Secure Chrome profile selection with user consent
async function selectChromeProfile() {
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Chrome Profile Integration',
      message: 'Would you like to use your Chrome profile for stealth automation?\n\nThis will:\n• Keep you logged into Google services\n• Use your existing cookies and sessions\n• Make automation undetectable\n• Maintain your browser preferences',
      detail: 'You can choose which Chrome profile to use, or skip for anonymous browsing.',
      buttons: ['Use Chrome Profile', 'Anonymous Mode', 'Cancel'],
      defaultId: 0,
      cancelId: 2
    });

    const responseIndex = result.response;
    if (responseIndex === 0) {
      // User wants to use Chrome profile
      return await promptChromeProfileSelection();
    } else if (responseIndex === 1) {
      // User wants anonymous mode
      return null;
    } else {
      // User cancelled
      return false;
    }
  } catch (error) {
    console.log('Chrome profile dialog error:', error.message);
    return false;
  }
}

async function promptChromeProfileSelection() {
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Chrome Profile Setup',
      message: 'To use your Chrome profile securely:\n\n1. The automation browser will launch with Chrome profile selection\n2. Choose your desired profile when Chrome opens\n3. Your login sessions will be preserved for automation\n\nThis is much safer than accessing profile files directly.',
      buttons: ['Continue', 'Cancel'],
      defaultId: 0
    });

    const responseIndex = result.response;
    return responseIndex === 0 ? 'user-selected' : false;
  } catch (error) {
    console.log('Chrome profile prompt error:', error.message);
    return false;
  }
}

// Secure Chrome integration - no direct file access
function setupSecureChromeIntegration() {
  console.log('Secure Chrome integration available - user consent required');
  console.log('Use "Automation → Setup Chrome Sign-In" for Google authentication');
}

// Get realistic Chrome user agent
function getRealisticUserAgent() {
  const platform = process.platform;
  const chromeVersion = process.versions.chrome;
  
  switch (platform) {
    case 'darwin':
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    case 'win32':
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    case 'linux':
      return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    default:
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  }
}

async function createWindow() {
  const userAgent = getRealisticUserAgent();
  let usesChromeProfile = false;

  // Create the main window with native browser feel
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Allow cross-origin for automation
    },
    titleBarStyle: 'hiddenInset',
    movable: true,
    resizable: true,
    show: false
  });

  // Configure session with Chrome-like settings
  const ses = session.fromPartition('default');
  
  // Set realistic user agent
  ses.setUserAgent(userAgent);
  
  // Enhanced stealth headers to bypass Cloudflare detection
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    // Remove all automation-specific headers that Cloudflare detects
    delete details.requestHeaders['x-devtools-emulate-network-conditions-client-id'];
    delete details.requestHeaders['chrome-proxy'];
    delete details.requestHeaders['purpose'];
    
    // Set realistic Chrome headers with proper casing
    details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
    details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
    details.requestHeaders['Accept-Encoding'] = 'gzip, deflate, br, zstd';
    details.requestHeaders['Cache-Control'] = 'max-age=0';
    details.requestHeaders['Sec-Fetch-Dest'] = 'document';
    details.requestHeaders['Sec-Fetch-Mode'] = 'navigate';
    details.requestHeaders['Sec-Fetch-Site'] = 'none';
    details.requestHeaders['Sec-Fetch-User'] = '?1';
    details.requestHeaders['Upgrade-Insecure-Requests'] = '1';
    details.requestHeaders['Dnt'] = '1';
    
    // Use latest Chrome sec-ch-ua format
    const chromeVersion = '126';
    details.requestHeaders['sec-ch-ua'] = `"Not/A)Brand";v="8", "Chromium";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}"`;
    details.requestHeaders['sec-ch-ua-mobile'] = '?0';
    details.requestHeaders['sec-ch-ua-platform'] = process.platform === 'darwin' ? '"macOS"' : process.platform === 'win32' ? '"Windows"' : '"Linux"';
    details.requestHeaders['sec-ch-ua-platform-version'] = process.platform === 'darwin' ? '"13.0.0"' : '"10.0.0"';
    
    callback({ requestHeaders: details.requestHeaders });
  });

  // Create the side panel (timeline/controls)
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Create the browser view for web content with enhanced stealth settings
  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      session: ses, // Use the configured session
      additionalArguments: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-ipc-flooding-protection',
        '--no-first-run'
      ]
    }
  });

  // Inject stealth scripts to hide automation indicators
  browserView.webContents.on('did-finish-load', () => {
    browserView.webContents.executeJavaScript(`
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Override plugins length
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Mock chrome runtime
      window.chrome = {
        runtime: {},
      };
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    `);
  });

  mainWindow.setBrowserView(browserView);

  // Position browser view (leaving space for side panel)
  const bounds = mainWindow.getBounds();
  browserView.setBounds({
    x: 350, // Space for side panel
    y: 80,  // Space for custom toolbar
    width: bounds.width - 350,
    height: bounds.height - 80
  });

  // Load initial page
  browserView.webContents.loadURL(currentUrl);

  // Handle window resize
  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds();
    browserView.setBounds({
      x: 350,
      y: 80,
      width: bounds.width - 350,
      height: bounds.height - 80
    });
  });

  // Set up IPC handlers for recording (prevent duplicate registration)
  if (!ipcMain.listenerCount('record-action')) {
    ipcMain.on('record-action', (event, action) => {
      console.log('Recording action received:', action);
      recordAction(action);
    });
  }
  
  // Note: IPC handlers for recording are defined globally at the bottom of the file
  
  // Credential management IPC handlers (prevent duplicate registration)
  if (!ipcMain.listenerCount('store-credential')) {
    ipcMain.on('store-credential', (event, credential) => {
      console.log('Storing credential securely:', { ...credential, value: '[HIDDEN]' });
      storeCredentialSecurely(credential);
    });
  }
  
  // Remove existing handlers before registering new ones
  ipcMain.removeHandler('get-credentials');
  ipcMain.removeHandler('update-credential');
  ipcMain.removeHandler('delete-credential');
  
  ipcMain.handle('get-credentials', (event, scriptId) => {
    return getStoredCredentials(scriptId);
  });
  
  ipcMain.handle('update-credential', (event, credentialData) => {
    return updateStoredCredential(credentialData);
  });
  
  ipcMain.handle('delete-credential', (event, credentialKey) => {
    return deleteStoredCredential(credentialKey);
  });

  ipcMain.handle('store-credentials', (event, credentialData) => {
    console.log('Storing session credentials for automatic replacement');
    // Store session credentials for automatic action replacement
    sessionCredentials = credentialData.credentials;
    return { success: true };
  });

  // Browser view navigation events
  browserView.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('browser-loading', true);
  });

  browserView.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('browser-loading', false);
    const newUrl = browserView.webContents.getURL();
    
    // Record navigation if recording and URL changed
    if (isRecording && newUrl !== currentUrl) {
      recordAction({
        type: 'navigate',
        url: newUrl,
        fromUrl: currentUrl,
        title: browserView.webContents.getTitle(),
        timestamp: Date.now()
      });
    }
    
    currentUrl = newUrl;
    mainWindow.webContents.send('url-changed', currentUrl);
    
    // Re-inject recording script after navigation
    if (isRecording) {
      setTimeout(() => {
        injectRecordingScript();
      }, 1000);
    }
  });

  browserView.webContents.on('page-title-updated', (event, title) => {
    mainWindow.webContents.send('title-changed', title);
  });

  // Recording events - filter out credential keystrokes for security
  browserView.webContents.on('before-input-event', (event, input) => {
    if (isRecording && input.type === 'keyDown') {
      // Skip recording keystrokes in credential fields
      browserView.webContents.executeJavaScript(`
        (function() {
          const activeElement = document.activeElement;
          if (!activeElement) return false;
          
          const type = activeElement.type?.toLowerCase();
          const name = activeElement.name?.toLowerCase() || '';
          const id = activeElement.id?.toLowerCase() || '';
          const placeholder = activeElement.placeholder?.toLowerCase() || '';
          const autocomplete = activeElement.autocomplete?.toLowerCase() || '';
          
          // Check if this is a credential field
          const isPassword = type === 'password' || autocomplete?.includes('password');
          const isUsername = type === 'email' || autocomplete?.includes('username') || 
                           autocomplete?.includes('email') || 
                           /username|user|email|login|account/i.test(name + id + placeholder);
          
          return isPassword || isUsername;
        })();
      `).then(isCredentialField => {
        if (!isCredentialField) {
          // Record non-credential keystrokes
          recordAction({
            type: 'keypress',
            key: input.key,
            code: input.code,
            modifiers: input.modifiers || [],
            timestamp: Date.now(),
            url: currentUrl,
            frameId: 'main',
            isMainFrame: true
          });
        }
      }).catch(err => {
        console.log('Could not check credential field, skipping keystroke recording');
      });
    }
  });

  // Monitor input changes for credential replacement
  browserView.webContents.on('dom-ready', () => {
    if (isRecording && sessionCredentials) {
      browserView.webContents.executeJavaScript(`
        // Monitor all input fields for credential matching
        let inputBuffer = '';
        let lastInputField = null;
        let inputTimer = null;
        
        function checkAndReplaceCredentials(element, value) {
          const credentials = ${JSON.stringify(sessionCredentials)};
          
          // Check if input matches any stored credentials
          if (value === credentials.username || value === credentials.password || 
              (credentials.phone && value === credentials.phone)) {
            
            // Determine credential type
            let credentialType = 'username';
            if (value === credentials.password) credentialType = 'password';
            if (value === credentials.phone) credentialType = 'phone';
            
            // Send credential replacement signal
            window.electronAPI && window.electronAPI.recordAction({
              type: 'credential-detected',
              credentialType: credentialType,
              element: {
                tagName: element.tagName,
                type: element.type,
                name: element.name,
                id: element.id,
                placeholder: element.placeholder,
                className: element.className
              },
              timestamp: Date.now(),
              url: window.location.href
            });
            
            return true;
          }
          return false;
        }
        
        // Listen for input events
        document.addEventListener('input', function(e) {
          if (e.target.matches('input, textarea')) {
            const element = e.target;
            const value = element.value;
            
            // Clear any existing timer
            clearTimeout(inputTimer);
            
            // Set a timer to check for credential matches after typing stops
            inputTimer = setTimeout(() => {
              checkAndReplaceCredentials(element, value);
            }, 500); // Wait 500ms after typing stops
          }
        }, true);
        
        // Also check on paste events
        document.addEventListener('paste', function(e) {
          if (e.target.matches('input, textarea')) {
            setTimeout(() => {
              checkAndReplaceCredentials(e.target, e.target.value);
            }, 100);
          }
        }, true);
      `);
    }
  });

  // Set up custom menu
  createMenu();

  mainWindow.once('ready-to-show', async () => {
    mainWindow.show();
    startPythonServer();
    
    // Prompt user for Chrome profile integration
    setTimeout(async () => {
      try {
        const profileChoice = await selectChromeProfile();
        if (profileChoice === 'user-selected') {
          usesChromeProfile = true;
          console.log('User opted for Chrome profile integration');
        } else if (profileChoice === null) {
          console.log('User selected anonymous mode');
        }
      } catch (error) {
        console.log('Chrome profile selection skipped due to error:', error.message);
      }
    }, 2000); // Give time for UI to load
  });

  mainWindow.on('closed', () => {
    if (pythonServer) {
      pythonServer.kill();
    }
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            browserView.webContents.loadURL('https://www.google.com');
          }
        },
        {
          label: 'Save Recording',
          accelerator: 'CmdOrCtrl+S',
          click: saveRecording
        },
        { type: 'separator' },
        { role: 'quit' }
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
      label: 'Automation',
      submenu: [
        {
          label: 'Start Recording',
          accelerator: 'CmdOrCtrl+R',
          click: startRecording
        },
        {
          label: 'Stop Recording',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: stopRecording
        },
        {
          label: 'Run Automation',
          accelerator: 'CmdOrCtrl+Enter',
          click: runAutomation
        },
        { type: 'separator' },
        {
          label: 'Setup Chrome Sign-In',
          click: async () => {
            const result = await dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Secure Chrome Sign-In Setup',
              message: 'For secure Google login automation:\n\n1. Sign in to Chrome in the automation browser\n2. Complete Google authentication normally\n3. Your login will be preserved for automation\n4. No personal files are accessed\n\nThis approach is much more secure than accessing Chrome profile files directly.',
              buttons: ['Open Chrome Sign-In', 'Cancel'],
              defaultId: 0
            });
            
            if (result.response === 0) {
              // Navigate to Google sign-in
              browserView.webContents.loadURL('https://accounts.google.com/signin');
              
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Chrome Sign-In Ready',
                message: 'Complete your Google sign-in in the browser.\n\nOnce signed in, your authentication will be preserved for automation scripts that use "Sign in with Google".',
                buttons: ['OK']
              });
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Python server management
function startPythonServer() {
  console.log('Starting Python automation server...');
  
  // Try python3 first (better for macOS with pyenv), fallback to python
  let pythonCommand = 'python3';
  if (process.platform === 'win32') {
    pythonCommand = 'python';
  }
  
  pythonServer = spawn(pythonCommand, [
    path.join(__dirname, '../python-server/server.py'),
    '--ws-port', WS_PORT.toString()
  ], {
    stdio: 'pipe',
    shell: true, // Use shell to resolve PATH issues
    env: { ...process.env }
  });

  pythonServer.stdout.on('data', (data) => {
    console.log(`Python Server: ${data}`);
  });

  pythonServer.stderr.on('data', (data) => {
    console.error(`Python Server Error: ${data}`);
  });

  pythonServer.on('close', (code) => {
    console.log(`Python server exited with code ${code}`);
  });

  // Connect WebSocket after a delay
  setTimeout(connectWebSocket, 3000);
}

function connectWebSocket() {
  try {
    wsConnection = new WebSocket(`ws://localhost:${WS_PORT}`);
    
    wsConnection.on('open', () => {
      console.log('WebSocket connected to Python server');
      // Check if mainWindow still exists before sending message
      if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('python-server-status', 'connected');
      }
    });

    wsConnection.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        // Check if mainWindow still exists before sending message
        if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('python-message', message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    wsConnection.on('error', (error) => {
      console.error('WebSocket error:', error);
      // Check if mainWindow still exists before sending message
      if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('python-server-status', 'error');
      }
    });

    wsConnection.on('close', () => {
      console.log('WebSocket connection closed');
      // Check if mainWindow still exists before sending message
      if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('python-server-status', 'disconnected');
      }
    });
  } catch (error) {
    console.error('Failed to connect WebSocket:', error);
  }
}

// Recording functions
function startRecording() {
  isRecording = true;
  recordedActions = [];
  
  // Check if mainWindow still exists before sending message
  if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('recording-status', true);
  }
  
  // Inject recording script
  injectRecordingScript();
}

function injectRecordingScript() {
  if (!browserView || !browserView.webContents) return;
  
  console.log('Injecting recording script with iframe support...');
  
  // Inject comprehensive recording script into browser view
  browserView.webContents.executeJavaScript(`
    (function() {
      if (window.automationRecording) return;
      window.automationRecording = true;
      
      console.log('Automation recording started with iframe support');
      
      // Generate unique frame identifier
      const frameId = window === window.top ? 'main' : generateFrameId();
      console.log('Frame ID:', frameId);
      
      function generateFrameId() {
        // Create unique identifier for this frame
        const frameUrl = window.location.href;
        const frameOrigin = window.location.origin;
        const parentUrl = window.parent ? window.parent.location.href : 'unknown';
        
        // Find the iframe element in parent that contains this frame
        try {
          if (window.parent && window.parent.document) {
            const iframes = window.parent.document.querySelectorAll('iframe');
            for (let i = 0; i < iframes.length; i++) {
              if (iframes[i].contentWindow === window) {
                // Use iframe attributes for identification
                const id = iframes[i].id || \`iframe-\${i}\`;
                const name = iframes[i].name || '';
                const src = iframes[i].src || '';
                return \`\${id}|\${name}|\${src.substring(0, 50)}\`;
              }
            }
          }
        } catch (e) {
          console.log('Cross-origin iframe, using URL-based ID');
        }
        
        // Fallback to URL-based identification
        return \`frame-\${btoa(frameUrl).substring(0, 10)}\`;
      }
      
      // Inject identifiers into all iframes in this frame
      function injectIframeIdentifiers() {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((iframe, index) => {
          try {
            // Set unique identifiers on iframe elements
            if (!iframe.id) {
              iframe.id = \`auto-iframe-\${index}-\${Date.now()}\`;
            }
            if (!iframe.dataset.automationId) {
              iframe.dataset.automationId = \`frame-\${frameId}-child-\${index}\`;
            }
            
            console.log('Tagged iframe:', iframe.id, iframe.dataset.automationId);
            
            // Inject recording script into iframe when it loads
            iframe.addEventListener('load', function() {
              try {
                if (iframe.contentWindow && iframe.contentWindow.document) {
                  iframe.contentWindow.eval(\`
                    if (!window.automationRecording) {
                      console.log('Injecting into child iframe:', '\${iframe.dataset.automationId}');
                      \${arguments.callee.toString().replace('function () {', '(function() {')}
                    }
                  \`);
                }
              } catch (e) {
                console.log('Cannot inject into cross-origin iframe:', e.message);
              }
            });
          } catch (e) {
            console.log('Error tagging iframe:', e.message);
          }
        });
      }
      
      // Run iframe identification immediately and on DOM changes
      injectIframeIdentifiers();
      
      // Watch for new iframes
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(function(node) {
              if (node.tagName === 'IFRAME') {
                console.log('New iframe detected, injecting identifier');
                injectIframeIdentifiers();
              }
            });
          }
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      function recordClick(e) {
        console.log('Click recorded in frame:', frameId, e.target);
        const rect = e.target.getBoundingClientRect();
        const locators = generateAllLocators(e.target);
        
        // Calculate both relative and absolute coordinates
        const absoluteX = rect.left + rect.width / 2;
        const absoluteY = rect.top + rect.height / 2;
        const relativeX = absoluteX / window.innerWidth;
        const relativeY = absoluteY / window.innerHeight;
        
        console.log('Click coordinates:', { absoluteX, absoluteY, relativeX, relativeY });
        
        const action = {
          type: 'click',
          locators: locators,
          x: relativeX,
          y: relativeY,
          absoluteX: rect.left + rect.width / 2,
          absoluteY: rect.top + rect.height / 2,
          text: e.target.textContent?.substring(0, 50) || '',
          tagName: e.target.tagName.toLowerCase(),
          className: e.target.className || '',
          id: e.target.id || '',
          frameId: frameId,
          frameUrl: window.location.href,
          isMainFrame: window === window.top,
          timestamp: Date.now(),
          url: window.location.href
        };
        
        console.log('Sending click action with frame info:', action);
        
        // Send to Electron main process
        if (window.electronAPI && window.electronAPI.recordAction) {
          window.electronAPI.recordAction(action);
        }
      }
      
      function recordInput(e) {
        console.log('Input recorded in frame:', frameId, e.target, e.target.value);
        const locators = generateAllLocators(e.target);
        const credentialInfo = detectCredentialField(e.target);
        
        let action;
        
        if (credentialInfo.isCredential) {
          // Handle credential input securely
          action = {
            type: credentialInfo.type, // 'enter-credential-username' or 'enter-credential-password'
            locators: locators,
            credentialKey: credentialInfo.key,
            tagName: e.target.tagName.toLowerCase(),
            frameId: frameId,
            frameUrl: window.location.href,
            isMainFrame: window === window.top,
            timestamp: Date.now(),
            url: window.location.href
          };
          
          // Store the actual credential securely (send to main process)
          if (window.electronAPI && window.electronAPI.storeCredential) {
            window.electronAPI.storeCredential({
              key: credentialInfo.key,
              value: e.target.value,
              type: credentialInfo.credentialType,
              url: window.location.href,
              frameId: frameId,
              timestamp: Date.now()
            });
          }
          
          console.log('Sending credential action (value hidden):', { ...action, credentialValue: '[HIDDEN]' });
        } else {
          // Regular input recording
          action = {
            type: 'type',
            locators: locators,
            value: e.target.value,
            tagName: e.target.tagName.toLowerCase(),
            frameId: frameId,
            frameUrl: window.location.href,
            isMainFrame: window === window.top,
            timestamp: Date.now(),
            url: window.location.href
          };
          
          console.log('Sending regular input action:', action);
        }
        
        if (window.electronAPI && window.electronAPI.recordAction) {
          window.electronAPI.recordAction(action);
        }
      }
      
      function detectCredentialField(element) {
        const inputType = element.type?.toLowerCase() || '';
        const name = element.name?.toLowerCase() || '';
        const id = element.id?.toLowerCase() || '';
        const placeholder = element.placeholder?.toLowerCase() || '';
        const autocomplete = element.autocomplete?.toLowerCase() || '';
        const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
        const className = element.className?.toLowerCase() || '';
        
        // Enhanced password field detection
        if (inputType === 'password' || 
            autocomplete === 'current-password' || 
            autocomplete === 'new-password' ||
            autocomplete === 'new-password' ||
            /password|pwd|pass|secret|pin/i.test(name + id + placeholder + ariaLabel + className)) {
          return {
            isCredential: true,
            type: 'enter-credential-password',
            credentialType: 'password',
            key: generateCredentialKey('password', element),
            confidence: 'high'
          };
        }
        
        // Enhanced username/email field detection  
        if (inputType === 'email' ||
            inputType === 'tel' ||
            autocomplete === 'username' ||
            autocomplete === 'email' ||
            autocomplete === 'tel' ||
            /username|user|email|login|account|signin|membre|usuario|utilizador|mail/i.test(name + id + placeholder + ariaLabel + className)) {
          return {
            isCredential: true,
            type: 'enter-credential-username',
            credentialType: 'username',
            key: generateCredentialKey('username', element),
            confidence: 'high'
          };
        }

        // Phone number detection
        if (inputType === 'tel' || /phone|mobile|numero|telefono|celular/i.test(name + id + placeholder + ariaLabel + className)) {
          return {
            isCredential: true,
            type: 'enter-credential-phone',
            credentialType: 'phone',
            key: generateCredentialKey('phone', element),
            confidence: 'medium'
          };
        }

        // Credit card detection
        if (/card|credit|debit|visa|master|amex|discover|numero.*carte/i.test(name + id + placeholder + ariaLabel + className)) {
          return {
            isCredential: true,
            type: 'enter-credential-card',
            credentialType: 'card',
            key: generateCredentialKey('card', element),
            confidence: 'medium'
          };
        }
        
        return { isCredential: false };
      }
      
      function generateCredentialKey(type, element) {
        const domain = window.location.hostname;
        const elementId = element.id || element.name || element.className?.split(' ')[0] || 'field';
        return \`\${domain}:\${type}:\${elementId}\`;
      }
      
      function recordNavigation() {
        const action = {
          type: 'navigate',
          url: window.location.href,
          title: document.title,
          frameId: frameId,
          frameUrl: window.location.href,
          isMainFrame: window === window.top,
          timestamp: Date.now()
        };
        
        console.log('Navigation recorded in frame:', frameId, action);
        
        if (window.electronAPI && window.electronAPI.recordAction) {
          window.electronAPI.recordAction(action);
        }
      }
      
      function recordScroll(e) {
        const action = {
          type: 'scroll',
          x: window.scrollX,
          y: window.scrollY,
          frameId: frameId,
          frameUrl: window.location.href,
          isMainFrame: window === window.top,
          timestamp: Date.now(),
          url: window.location.href
        };
        
        if (window.electronAPI && window.electronAPI.recordAction) {
          window.electronAPI.recordAction(action);
        }
      }
      
      function generateAllLocators(element) {
        const locators = [];
        
        // 1. ID locator (highest priority)
        if (element.id && element.id.trim()) {
          locators.push(['id', element.id.trim()]);
        }
        
        // 2. Name attribute
        if (element.name && element.name.trim()) {
          locators.push(['name', element.name.trim()]);
        }
        
        // 3. CSS Selector by class
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.trim().split(/\\s+/);
          if (classes.length > 0 && classes[0]) {
            locators.push(['css', '.' + classes[0]]);
            // Also try with tag + class for more specificity
            locators.push(['css', element.tagName.toLowerCase() + '.' + classes[0]]);
          }
        }
        
        // 4. XPath by text content (for buttons, links, etc.)
        const textContent = element.textContent?.trim();
        if (textContent && textContent.length > 0 && textContent.length < 50) {
          // Exact text match
          locators.push(['xpath', \`//\${element.tagName.toLowerCase()}[normalize-space(text())="\${textContent}"]\`]);
          // Partial text match
          locators.push(['xpath', \`//\${element.tagName.toLowerCase()}[contains(normalize-space(text()), "\${textContent}")]\`]);
        }
        
        // 5. XPath by attributes
        ['placeholder', 'title', 'alt', 'value', 'href', 'src'].forEach(attr => {
          const attrValue = element.getAttribute(attr);
          if (attrValue && attrValue.trim()) {
            locators.push(['xpath', \`//\${element.tagName.toLowerCase()}[@\${attr}="\${attrValue.trim()}"]\`]);
          }
        });
        
        // 6. CSS selector by attribute
        ['data-testid', 'data-test', 'data-id', 'role', 'type'].forEach(attr => {
          const attrValue = element.getAttribute(attr);
          if (attrValue && attrValue.trim()) {
            locators.push(['css', \`[\${attr}="\${attrValue.trim()}"]\`]);
          }
        });
        
        // 7. Link text for <a> tags
        if (element.tagName.toLowerCase() === 'a' && textContent) {
          locators.push(['link_text', textContent]);
          locators.push(['partial_link_text', textContent]);
        }
        
        // 8. CSS nth-child selector (fallback)
        const parent = element.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(element);
          if (index >= 0) {
            locators.push(['css', \`\${element.tagName.toLowerCase()}:nth-child(\${index + 1})\`]);
          }
        }
        
        // 9. XPath position-based (last resort)
        const xpath = getXPath(element);
        if (xpath) {
          locators.push(['xpath', xpath]);
        }
        
        console.log('Generated locators for element:', element, locators);
        return locators;
      }
      
      function getXPath(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return '';
        
        if (element.id) {
          return \`//*[@id="\${element.id}"]\`;
        }
        
        const parts = [];
        let current = element;
        
        while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName) {
          let tagName = current.tagName.toLowerCase();
          let index = 1;
          
          // Count preceding siblings with same tag name
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName && sibling.tagName.toLowerCase() === tagName) {
              index++;
            }
            sibling = sibling.previousElementSibling;
          }
          
          parts.unshift(\`\${tagName}[\${index}]\`);
          current = current.parentElement;
        }
        
        return parts.length > 0 ? '/' + parts.join('/') : '';
      }
      
      // Add comprehensive event listeners with debugging
      console.log('Setting up event listeners for recording...');
      document.addEventListener('click', recordClick, true);
      document.addEventListener('input', recordInput, true);
      document.addEventListener('change', recordInput, true);
      
      // Enhanced keystroke recording
      document.addEventListener('keydown', function(e) {
        console.log('Keydown captured:', e.key, e.code, e.ctrlKey, e.altKey, e.shiftKey);
        
        const action = {
          type: 'keypress',
          key: e.key,
          code: e.code,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
          metaKey: e.metaKey,
          timestamp: Date.now(),
          url: window.location.href,
          frameId: frameId,
          isMainFrame: window === window.top
        };
        
        if (window.electronAPI && window.electronAPI.recordAction) {
          console.log('Sending keystroke action:', action);
          window.electronAPI.recordAction(action);
        }
      }, true);

      // Element highlighting system with locator display
      let highlightOverlay = null;
      let locatorTooltip = null;
      let isRecordingMode = false;

      function createHighlightOverlay() {
        if (highlightOverlay) return highlightOverlay;
        
        highlightOverlay = document.createElement('div');
        highlightOverlay.style.cssText = \`
          position: absolute;
          pointer-events: none;
          z-index: 999999;
          border: 3px solid;
          border-radius: 4px;
          transition: all 0.1s ease;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
        \`;
        document.body.appendChild(highlightOverlay);
        return highlightOverlay;
      }

      function createLocatorTooltip() {
        if (locatorTooltip) return locatorTooltip;
        
        locatorTooltip = document.createElement('div');
        locatorTooltip.style.cssText = \`
          position: absolute;
          background: rgba(0,0,0,0.9);
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 11px;
          line-height: 1.4;
          max-width: 400px;
          z-index: 1000000;
          pointer-events: none;
          white-space: pre-wrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        \`;
        document.body.appendChild(locatorTooltip);
        return locatorTooltip;
      }

      function getElementType(element) {
        const tag = element.tagName.toLowerCase();
        const type = element.type?.toLowerCase();
        const role = element.getAttribute('role')?.toLowerCase();

        // Credential fields
        if (type === 'password' || element.autocomplete?.includes('password')) {
          return 'password';
        }
        if (type === 'email' || element.autocomplete?.includes('email') || 
            element.autocomplete?.includes('username') || 
            /username|user|email|login/i.test(element.name + element.id + element.placeholder)) {
          return 'username';
        }

        // Interactive elements
        if (tag === 'button' || type === 'submit' || type === 'button' || role === 'button') {
          return 'button';
        }
        if (tag === 'a' || role === 'link') {
          return 'link';
        }
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          return 'input';
        }
        if (['div', 'span', 'li', 'td'].includes(tag) && (element.onclick || role === 'button' || 
            element.style.cursor === 'pointer' || window.getComputedStyle(element).cursor === 'pointer')) {
          return 'clickable';
        }

        return 'element';
      }

      function getElementColors(elementType) {
        const colors = {
          'password': '#dc3545',     // Red for password fields
          'username': '#007bff',     // Blue for username fields  
          'button': '#28a745',       // Green for buttons
          'link': '#6f42c1',         // Purple for links
          'input': '#fd7e14',        // Orange for inputs
          'clickable': '#20c997',    // Teal for clickable elements
          'element': '#6c757d'       // Gray for other elements
        };
        return colors[elementType] || colors.element;
      }

      function formatLocatorsDisplay(locators, elementType) {
        let display = \`Element Type: \${elementType.toUpperCase()}\\n\`;
        display += \`Total Locators: \${locators.length}\\n\\n\`;
        
        locators.forEach((locator, index) => {
          const [type, value] = locator;
          display += \`[\${index + 1}] \${type}: \${value}\\n\`;
        });
        
        return display;
      }

      function highlightElement(element) {
        if (!element || element === document.body || element === document.documentElement) return;
        
        const rect = element.getBoundingClientRect();
        const elementType = getElementType(element);
        const color = getElementColors(elementType);
        const locators = generateAllLocators(element);
        
        const overlay = createHighlightOverlay();
        const tooltip = createLocatorTooltip();
        
        // Position highlight
        overlay.style.left = (rect.left + window.scrollX) + 'px';
        overlay.style.top = (rect.top + window.scrollY) + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        overlay.style.borderColor = color;
        overlay.style.background = \`\${color}15\`; // 15% opacity fill
        overlay.style.display = 'block';
        
        // Position tooltip
        const tooltipX = Math.min(rect.right + window.scrollX + 10, window.innerWidth - 420);
        const tooltipY = rect.top + window.scrollY;
        
        tooltip.style.left = tooltipX + 'px';
        tooltip.style.top = tooltipY + 'px';
        tooltip.style.borderLeft = \`4px solid \${color}\`;
        tooltip.textContent = formatLocatorsDisplay(locators, elementType);
        tooltip.style.display = 'block';
      }

      function hideHighlight() {
        if (highlightOverlay) {
          highlightOverlay.style.display = 'none';
        }
        if (locatorTooltip) {
          locatorTooltip.style.display = 'none';
        }
      }

      // Mouse tracking for highlighting
      document.addEventListener('mousemove', function(e) {
        if (!isRecordingMode) return;
        
        const element = e.target;
        if (element && element !== highlightOverlay && element !== locatorTooltip) {
          highlightElement(element);
        }
      });

      document.addEventListener('mouseleave', hideHighlight);
      
      // Listen for recording state changes
      window.addEventListener('message', function(event) {
        if (event.data.type === 'recording-state-changed') {
          isRecordingMode = event.data.isRecording;
          if (!isRecordingMode) {
            hideHighlight();
          }
        }
      });
      
      // Record navigation events
      window.addEventListener('beforeunload', recordNavigation);
      window.addEventListener('load', recordNavigation);
      
      // Record scroll events (throttled)
      let scrollTimeout;
      window.addEventListener('scroll', function(e) {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => recordScroll(e), 250);
      });
      
      console.log('Recording event listeners attached');
      
      // Notify that recording is active
      if (window.electronAPI && window.electronAPI.recordAction) {
        window.electronAPI.recordAction({
          type: 'recording-started',
          url: window.location.href,
          frameId: frameId,
          frameUrl: window.location.href,
          isMainFrame: window === window.top,
          timestamp: Date.now()
        });
      }
    })();
  `).then(() => {
    console.log('Recording script injected successfully');
  }).catch(error => {
    console.error('Failed to inject recording script:', error);
  });
}

function stopRecording() {
  isRecording = false;
  
  // Check if mainWindow still exists before sending messages
  if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('recording-status', false);
    
    // Clean up recordedActions to prevent cloning errors - only send serializable data
    const cleanActions = recordedActions.map(action => {
      if (typeof action === 'object' && action !== null) {
        return {
          type: action.type || 'unknown',
          selector: action.selector || '',
          value: action.value || '',
          timestamp: action.timestamp || Date.now(),
          url: action.url || ''
        };
      }
      return action;
    });
    
    mainWindow.webContents.send('actions-recorded', cleanActions);
  }
  
  // Remove recording listeners
  browserView.webContents.executeJavaScript(`
    window.automationRecording = false;
    // Listeners are automatically removed when page reloads
  `);
}

function recordAction(action) {
  if (isRecording) {
    // Handle credential detection and replacement
    if (action.type === 'credential-detected') {
      // Remove recent keystroke actions that match this credential input
      const credentialValue = sessionCredentials[action.credentialType];
      if (credentialValue) {
        // Remove recent keystroke actions for this credential
        const recentActions = recordedActions.slice(-credentialValue.length * 2);
        let keystrokesToRemove = 0;
        
        // Count keystrokes that should be replaced
        for (let i = recentActions.length - 1; i >= 0; i--) {
          const recentAction = recentActions[i];
          if (recentAction.type === 'keypress' && 
              recentAction.timestamp > (action.timestamp - 5000)) { // Within 5 seconds
            keystrokesToRemove++;
          }
        }
        
        // Remove the keystroke actions
        if (keystrokesToRemove > 0) {
          recordedActions.splice(-keystrokesToRemove, keystrokesToRemove);
          console.log(`Removed ${keystrokesToRemove} keystroke actions, replacing with credential action`);
        }
        
        // Add credential action instead
        const credentialAction = {
          type: `enter-credential-${action.credentialType}`,
          credentialType: action.credentialType,
          element: action.element,
          locators: generateAllLocatorsFromElement(action.element),
          timestamp: action.timestamp,
          url: action.url,
          secureValue: true // Indicates this uses stored credentials
        };
        
        recordedActions.push(credentialAction);
        mainWindow.webContents.send('action-recorded', credentialAction);
        console.log(`Recorded credential action: ${action.credentialType}`);
      }
    } else {
      recordedActions.push(action);
      mainWindow.webContents.send('action-recorded', action);
    }
  }
}

function generateAllLocatorsFromElement(elementInfo) {
  const locators = [];
  
  if (elementInfo.id) {
    locators.push(['id', elementInfo.id]);
  }
  if (elementInfo.name) {
    locators.push(['name', elementInfo.name]);
  }
  if (elementInfo.className) {
    locators.push(['css', `.${elementInfo.className.split(' ').join('.')}`]);
  }
  
  // Add tag-based selector
  let tagSelector = elementInfo.tagName.toLowerCase();
  if (elementInfo.type) {
    tagSelector += `[type="${elementInfo.type}"]`;
  }
  locators.push(['css', tagSelector]);
  
  return locators;
}

async function saveRecording() {
  if (recordedActions.length === 0) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'No Recording',
      message: 'No actions recorded yet. Start recording to capture automation steps.'
    });
    return;
  }

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `automation-recording-${Date.now()}.json`,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (filePath) {
    const fs = require('fs').promises;
    await fs.writeFile(filePath, JSON.stringify({
      version: '1.0',
      timestamp: new Date().toISOString(),
      actions: recordedActions
    }, null, 2));
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Recording Saved',
      message: `Recording saved to ${filePath}`
    });
  }
}

async function runAutomation() {
  if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Server Not Connected',
      message: 'Python automation server is not connected. Please wait for it to start.'
    });
    return;
  }

  if (recordedActions.length === 0) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'No Actions',
      message: 'No actions to run. Record some actions first.'
    });
    return;
  }

  // Send actions to Python server for execution
  wsConnection.send(JSON.stringify({
    command: 'run_automation',
    actions: recordedActions
  }));
}

// IPC Handlers
ipcMain.handle('navigate-to', async (event, url) => {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  currentUrl = url;
  browserView.webContents.loadURL(url);
  return url;
});

ipcMain.handle('browser-back', async () => {
  if (browserView.webContents.canGoBack()) {
    browserView.webContents.goBack();
  }
});

ipcMain.handle('browser-forward', async () => {
  if (browserView.webContents.canGoForward()) {
    browserView.webContents.goForward();
  }
});

ipcMain.handle('browser-reload', async () => {
  browserView.webContents.reload();
});

ipcMain.handle('get-current-url', async () => {
  return currentUrl;
});

ipcMain.handle('start-recording', async () => {
  try {
    startRecording();
    return { success: true };
  } catch (error) {
    console.error('Error starting recording:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-recording', async () => {
  try {
    stopRecording();
    // Return a clean copy of actions without any potential circular references
    const cleanActions = recordedActions.map(action => {
      if (typeof action === 'object' && action !== null) {
        return {
          type: action.type || 'unknown',
          selector: action.selector || '',
          value: action.value || '',
          timestamp: action.timestamp || Date.now(),
          url: action.url || ''
        };
      }
      return action;
    });
    return { success: true, actions: cleanActions };
  } catch (error) {
    console.error('Error stopping recording:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-actions', async () => {
  recordedActions = [];
  return true;
});

ipcMain.handle('record-action', async (event, action) => {
  recordAction(action);
});

ipcMain.handle('run-automation', async () => {
  await runAutomation();
});

// App event handlers
app.whenReady().then(() => {
  // Load credentials on startup
  loadCredentialsFromFile();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (pythonServer) {
    pythonServer.kill();
  }
});

// Secure credential management functions
function storeCredentialSecurely(credential) {
  try {
    const key = credential.key;
    const encryptedValue = encrypt(credential.value);
    
    storedCredentials.set(key, {
      value: encryptedValue,
      type: credential.type,
      url: credential.url,
      timestamp: credential.timestamp
    });
    
    console.log(`Credential stored securely for key: ${key}`);
    
    // Also persist to secure storage
    saveCredentialsToFile();
  } catch (error) {
    console.error('Error storing credential:', error);
  }
}

function getStoredCredentials(scriptId) {
  const credentials = {};
  for (const [key, data] of storedCredentials.entries()) {
    credentials[key] = {
      type: data.type,
      url: data.url,
      timestamp: data.timestamp,
      hasValue: !!data.value
    };
  }
  return credentials;
}

function updateStoredCredential(credentialData) {
  const { key, value } = credentialData;
  if (storedCredentials.has(key)) {
    const existing = storedCredentials.get(key);
    existing.value = encrypt(value);
    existing.timestamp = Date.now();
    saveCredentialsToFile();
    return true;
  }
  return false;
}

function deleteStoredCredential(credentialKey) {
  const deleted = storedCredentials.delete(credentialKey);
  if (deleted) {
    saveCredentialsToFile();
  }
  return deleted;
}

function getCredentialValue(credentialKey) {
  const credential = storedCredentials.get(credentialKey);
  if (credential && credential.value) {
    return decrypt(credential.value);
  }
  return null;
}

// Simple encryption for credential storage (in production, use proper crypto)
function encrypt(text) {
  const crypto = require('crypto');
  const algorithm = 'aes-256-cbc';
  const key = crypto.createHash('sha256').update('automation-browser-secret').digest();
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
  try {
    const crypto = require('crypto');
    const algorithm = 'aes-256-cbc';
    const key = crypto.createHash('sha256').update('automation-browser-secret').digest();
    
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting credential:', error);
    return null;
  }
}

function saveCredentialsToFile() {
  try {
    const credentialsData = {};
    for (const [key, data] of storedCredentials.entries()) {
      credentialsData[key] = data;
    }
    
    const credentialsPath = path.join(__dirname, '../credentials.json');
    fs.writeFileSync(credentialsPath, JSON.stringify(credentialsData, null, 2));
    console.log('Credentials saved to secure file');
  } catch (error) {
    console.error('Error saving credentials:', error);
  }
}

function loadCredentialsFromFile() {
  try {
    const credentialsPath = path.join(__dirname, '../credentials.json');
    if (fs.existsSync(credentialsPath)) {
      const credentialsData = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      for (const [key, data] of Object.entries(credentialsData)) {
        storedCredentials.set(key, data);
      }
      console.log('Credentials loaded from secure file');
    }
  } catch (error) {
    console.error('Error loading credentials:', error);
  }
}