const { app, ipcMain, Menu, BrowserWindow, dialog, session } = require('electron');
const path = require('path');
const windowManager = require('./browser/windowManager');
const recordingManager = require('./recording/recordingManager');
const { createMenu } = require('./ui/menu');
const { setupIPCHandlers } = require('./ipc/handlers');
const { setupErrorHandling, handleRendererCrash } = require('./utils/errorHandling');
const { logger } = require('./utils/logger');
const { startPythonServer } = require('./python/server');
const fs = require('fs');

// Global state
let mainWindow;
let browserView;
let isRecording = false;
let recordedActions = [];
let pythonServer;
let isInitialized = false; // Guard to prevent re-initialization
let currentUrl = 'https://www.google.com';

// Configure error handling first
setupErrorHandling();

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Initialize the application
app.whenReady().then(initializeApp).catch(err => {
  logger.error('Unhandled error during app initialization:', err);
  dialog.showErrorBox('Fatal Error', 'An unhandled error occurred during startup. The application will now close.');
  app.quit();
});

async function initializeApp() {
  if (isInitialized) {
    logger.warn('Initialization already completed. Skipping.');
    return;
  }
  isInitialized = true;
  logger.info('Performing one-time application setup...');

  // Initialize recording manager
  recordingManager.initialize();

  // Start Python server
  try {
    pythonServer = await startPythonServer(app.getAppPath());
  } catch (error) {
    logger.error('Failed to start Python server:', error);
    dialog.showErrorBox('Backend Error', 'The Python backend server failed to start. The application will now close.');
    app.quit();
    return; // Stop initialization
  }

  logger.info('Python server started. Creating main window...');
  // Create the main window
  const result = windowManager.createMainWindow();
    if (!result || !result.window || !result.view) {
      logger.error('windowManager.createMainWindow() failed to return window and view.');
      app.quit();
      return;
  }
  const { window, view } = result;
  mainWindow = window;
  browserView = view;

  logger.info('Main window and browser view created successfully.');

  // Set up IPC handlers
  setupIPCHandlers(mainWindow, browserView);

  // Setup menu for the new window
  createMenu(mainWindow);

  logger.info('IPC handlers and menu created. Setting up event listeners...');
  // Set up event listeners that depend on the window and view
  setupEventListeners();

  logger.info('Application fully initialized.');
}


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Gracefully shut down the Python server before the app quits
app.on('before-quit', (event) => {
  if (pythonServer) {
    logger.info('Shutting down Python server before quitting...');
    pythonServer.kill();
    pythonServer = null;
  }
});

// Handle app activation (macOS) - register once
app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    initializeApp();
  }
});

function setupEventListeners() {
    // Browser view navigation events
    browserView.webContents.on('did-start-loading', () => {
        mainWindow.webContents.send('browser-loading', true);
    });

    browserView.webContents.on('did-stop-loading', () => {
        mainWindow.webContents.send('browser-loading', false);
        const newUrl = browserView.webContents.getURL();

        if (isRecording && newUrl !== currentUrl) {
            recordingManager.recordAction({
                type: 'navigate',
                url: newUrl,
                fromUrl: currentUrl,
                title: browserView.webContents.getTitle(),
            });
        }

        currentUrl = newUrl;
        mainWindow.webContents.send('url-changed', currentUrl);

        if (isRecording) {
            setTimeout(injectRecordingScript, 500);
        }
    });

    browserView.webContents.on('page-title-updated', (event, title) => {
        mainWindow.webContents.send('title-changed', title);
    });

    // Handle renderer crashes
    browserView.webContents.on('render-process-gone', (event, details) => {
        handleRendererCrash(browserView, details);
    });

    // Handle window resize
    mainWindow.on('resize', () => {
        const bounds = mainWindow.getBounds();
        const sidePanelWidth = 350;
        const topBarHeight = 80;
        browserView.setBounds({
            x: sidePanelWidth,
            y: topBarHeight,
            width: bounds.width - sidePanelWidth,
            height: bounds.height - topBarHeight
        });
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
}


// --- Recording Logic ---

function startRecording() {
  isRecording = true;
  recordingManager.start();
  mainWindow.webContents.send('recording-status', true, recordingManager.getRecordedActions());
  injectRecordingScript();
  logger.info('Recording started.');
}

function stopRecording() {
  isRecording = false;
  recordingManager.stop();
  mainWindow.webContents.send('recording-status', false, recordingManager.getRecordedActions());
  // Optionally remove recording script from pages
  logger.info('Recording stopped.');
}

function getRecordingScriptContent() {
    return `
    (function() {
      if (window.automationRecording) return;
      window.automationRecording = true;
      
      const frameId = window === window.top ? 'main' : Math.random().toString(36).substr(2, 9);

      function generateAllLocators(element) {
        if (!element) return [];
        const locators = [];
        const textContent = element.textContent?.trim();

        // 1. ID locator (highest priority)
        if (element.id && element.id.trim()) {
          locators.push(['id', element.id.trim()]);
        }

        // 2. Name attribute
        if (element.name && element.name.trim()) {
          locators.push(['name', element.name.trim()]);
        }

        // 3. Data attributes for testing (high priority)
        ['data-testid', 'data-test', 'data-id', 'data-cy', 'data-qa'].forEach(attr => {
          const attrValue = element.getAttribute(attr);
          if (attrValue && attrValue.trim()) {
            locators.push(['css', \`[${attr}="\${attrValue.trim()}"]\`]);
          }
        });

        // 4. Role and ARIA labels
        const role = element.getAttribute('role');
        if (role && role.trim()) {
          locators.push(['css', \`[role="\${role.trim()}"]\`]);
        }
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim()) {
          locators.push(['xpath', \`//\${element.tagName.toLowerCase()}[@aria-label="\${ariaLabel.trim()}"]\`]);
        }

        // 5. CSS Selector by class (more specific)
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.trim().split(/\\s+/).filter(c => c);
          if (classes.length > 0) {
            const classSelector = '.' + classes.join('.');
            locators.push(['css', element.tagName.toLowerCase() + classSelector]);
          }
        }

        // 6. Link text for <a> tags
        if (element.tagName.toLowerCase() === 'a' && textContent) {
          locators.push(['link_text', textContent]);
          locators.push(['partial_link_text', textContent]);
        }

        // 7. XPath by text content
        if (textContent && textContent.length > 0 && textContent.length < 60) {
          locators.push(['xpath', \`//\${element.tagName.toLowerCase()}[normalize-space()="\${textContent}"]\`]);
        }

        // 8. Full XPath (last resort)
        const xpath = getXPath(element);
        if (xpath) {
          locators.push(['xpath', xpath]);
        }

        // Remove duplicate locators
        const uniqueLocators = Array.from(new Map(locators.map(l => [l.join('|'), l])).values());
        
        return uniqueLocators;
      }

      function getXPath(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return '';

        const parts = [];
        let current = element;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let part = current.tagName.toLowerCase();
          if (current.id) {
            part += \`[@id='\${current.id}']\`;
            parts.unshift(part);
            break; // ID is unique, no need to go further
          }

          let index = 1;
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === current.tagName) {
              index++;
            }
            sibling = sibling.previousElementSibling;
          }

          const childNodes = current.parentElement ? Array.from(current.parentElement.children) : [];
          const hasSimilarSiblings = childNodes.filter(c => c.tagName === current.tagName).length > 1;
          if (hasSimilarSiblings) {
             part += \`[\${index}]\`;
          }

          parts.unshift(part);
          current = current.parentElement;
        }

        return parts.length ? '//' + parts.join('/') : '';
      }

      function recordClick(e) {
        const action = {
          type: 'click',
          locators: generateAllLocators(e.target),
          tagName: e.target.tagName.toLowerCase(),
          textContent: e.target.textContent?.substring(0, 100).trim(),
          frameId: frameId,
          url: window.location.href,
        };
        window.electronAPI.recordAction(action);
      }

      function recordInput(e) {
        const credentialInfo = detectCredentialField(e.target);
        let action;

        if (credentialInfo.isCredential) {
          action = {
            type: credentialInfo.type,
            locators: generateAllLocators(e.target),
            credentialKey: credentialInfo.key,
            tagName: e.target.tagName.toLowerCase(),
            frameId: frameId,
            url: window.location.href
          };
          
          if (window.electronAPI && window.electronAPI.storeCredential) {
            window.electronAPI.storeCredential({
              key: credentialInfo.key,
              value: e.target.value,
              type: credentialInfo.credentialType,
              url: window.location.href,
            });
          }
        } else {
          action = {
            type: 'type',
            locators: generateAllLocators(e.target),
            value: e.target.value,
            tagName: e.target.tagName.toLowerCase(),
            frameId: frameId,
            url: window.location.href
          };
        }
        
        window.electronAPI.recordAction(action);
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
            autocomplete.includes('password') ||
            /password|pwd|pass|secret|pin|auth|token/i.test(name + id + placeholder + ariaLabel + className)) {
          return {
            isCredential: true,
            type: 'enter-credential-password',
            credentialType: 'password',
            key: generateCredentialKey('password', element)
          };
        }
        
        // Enhanced username/email field detection
        if (inputType === 'email' ||
            autocomplete.includes('username') ||
            autocomplete.includes('email') ||
            /username|user|email|login|account|signin|membre|usuario|utilizador|mail/i.test(name + id + placeholder + ariaLabel + className)) {
          return {
            isCredential: true,
            type: 'enter-credential-username',
            credentialType: 'username',
            key: generateCredentialKey('username', element)
          };
        }

        // Enhanced phone number field detection
        if (inputType === 'tel' ||
            autocomplete.includes('tel') ||
            /phone|contact|tel/i.test(name + id + placeholder + ariaLabel + className)) {
          return {
            isCredential: true,
            type: 'enter-credential-phone',
            credentialType: 'phone',
            key: generateCredentialKey('phone', element)
          };
        }
        
        return { isCredential: false };
      }
      
      function generateCredentialKey(type, element) {
        const domain = window.location.hostname;
        const elementId = element.id || element.name || 'field';
        return \`\${domain}:\${type}:\${elementId}\`;
      }

      document.addEventListener('click', recordClick, { capture: true });
      document.addEventListener('input', recordInput, { capture: true });
      document.addEventListener('change', recordInput, { capture: true });

      // Inject into existing and new iframes
      function injectIntoFrames() {
          document.querySelectorAll('iframe').forEach(iframe => {
              try {
                  if (iframe.contentWindow && !iframe.contentWindow.automationRecording) {
                      iframe.contentWindow.eval(\`
                          (function() {
                              const script = document.createElement('script');
                              script.textContent = \\\`\${arguments[0]}\\\`;
                              document.documentElement.appendChild(script);
                              script.remove();
                          })();
                      \`, \`${getRecordingScriptContent()}\`);
                  }
              } catch (e) {
                  console.log('Could not inject into cross-origin iframe:', e.message);
              }
          });
      }

      const observer = new MutationObserver(injectIntoFrames);
      observer.observe(document.body, { childList: true, subtree: true });
      injectIntoFrames();
    })();
    `;
}

function injectRecordingScript() {
  if (!browserView || !browserView.webContents) return;
  
  const script = getRecordingScriptContent();
  
  browserView.webContents.executeJavaScript(script).catch(err => {
    logger.error('Failed to inject recording script into main frame:', err);
  });
}

// Global IPC listeners for recording control
ipcMain.on('start-recording', startRecording);
ipcMain.on('stop-recording', stopRecording);