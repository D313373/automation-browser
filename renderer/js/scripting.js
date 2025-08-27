console.log('scripting.js is loaded');

// Import shared state
import { state } from './shared-state.js';

// Initialize the scripting module
function initScripting() {
    try {
        console.log('Initializing scripting module...');
        
        // Load saved scripts from localStorage
        if (typeof loadSavedScripts === 'function') {
            loadSavedScripts();
        } else {
            console.warn('loadSavedScripts function not found');
        }
        
        // Set up event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing scripting module:', error);
    }
}

// Set up event listeners for the scripting module
function setupEventListeners() {
    console.log('Setting up event listeners for scripting module...');
    
    // Add any necessary event listeners here
    // For example:
    const runBtn = document.getElementById('run-automation');
    if (runBtn) {
        runBtn.addEventListener('click', () => {
            console.log('Run automation button clicked');
            // Add your run automation logic here
        });
    }
    
    const googleSignInBtn = document.getElementById('google-signin');
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', () => {
            console.log('Google Sign-In button clicked');
            // Add your Google Sign-In logic here
        });
    }
    
    console.log('Event listeners setup complete');
}

// Global state for scripting
// These variables are now declared in the main scope to avoid redeclaration
if (typeof currentScript === 'undefined') {
    var currentScript = null;
}
if (typeof savedScripts === 'undefined') {
    var savedScripts = [];
}
if (typeof isRecording === 'undefined') {
    var isRecording = false;
}

// DOM elements
const runBtn = document.getElementById('run-automation');
const googleSignInBtn = document.getElementById('google-signin');

runBtn.addEventListener('click', async () => {
    await window.electronAPI.runAutomation();
});

// Google Sign-In button
googleSignInBtn.addEventListener('click', async () => {
    await window.electronAPI.navigateTo('https://accounts.google.com/signin');
});

// Script management with conditional branching
function initializeNewScript() {
    const newScript = {
        id: Date.now().toString(),
        name: 'New Script',
        code: '// Write your script here\n// Use the browser object to interact with the page\n// Example: browser.navigateTo(\"https://example.com\");',
        created: new Date().toISOString(),
        modified: new Date().toISOString()
    };
    
    state.currentScript = newScript;
    return newScript;
}

function loadSavedScripts() {
    try {
        const scripts = localStorage.getItem('automation-scripts');
        if (scripts) {
            savedScripts = JSON.parse(scripts);
            console.log('Loaded saved scripts:', savedScripts);
        }
    } catch (error) {
        console.error('Error loading saved scripts:', error);
        savedScripts = [];
    }
    return savedScripts;
}

function loadSavedScriptsList() {
    const scriptList = document.getElementById('script-list');
    const savedScripts = loadSavedScripts();
    
    if (savedScripts.length === 0) {
        scriptList.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: #666;">
                <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                <div style="font-size: 18px; margin-bottom: 8px;">Welcome to Automation Browser</div>
                <div style="font-size: 14px; margin-bottom: 20px;">Create your first automation script to get started</div>
            </div>
        `;
        return;
    }

    scriptList.innerHTML = '';
    savedScripts.forEach((script, index) => {
        const scriptItem = document.createElement('div');
        scriptItem.className = 'script-item';
        scriptItem.innerHTML = `
            <div class="script-name">${script.name || 'Unnamed Script'}</div>
            <div class="script-meta">
                ${script.phases.main_actions.actions.length} actions • 
                ${script.lastModified ? new Date(script.lastModified).toLocaleDateString() : 'Unknown date'}
                ${script.credentials && (script.credentials.username || script.credentials.password) ? ' • 🔐 Has credentials' : ''}
            </div>
        `;
        scriptItem.addEventListener('click', () => loadScript(script, index));
        scriptList.appendChild(scriptItem);
    });
}

function loadScript(script, index) {
    currentScript = script;
    document.getElementById('script-name-input').value = script.name || '';
    
    document.querySelectorAll('.script-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.script-item')[index].classList.add('active');
    
    updateActionEditor();
}

function updateActionEditor() {
    const actionEditor = document.getElementById('action-editor');
    actionEditor.innerHTML = '';

    if (!currentScript || !currentScript.name) {
        actionEditor.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                <div style="font-size: 16px; margin-bottom: 5px;">Select or create a script to begin editing.</div>
            </div>
        `;
        return;
    }

    const actions = currentScript.phases.main_actions.actions;

    if (!actions || actions.length === 0) {
        actionEditor.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 10px;">▶️</div>
                <div style="font-size: 16px; margin-bottom: 5px;">No recorded actions in this script.</div>
                <div style="font-size: 14px;">Click 'Start Recording' to add steps.</div>
            </div>
        `;
        return;
    }

    actions.forEach((action, index) => {
        const actionItem = document.createElement('div');
        actionItem.className = 'action-item-editor';
        actionItem.setAttribute('draggable', 'true');
        actionItem.dataset.index = index;
        
        let detailsHtml = '';
        for (const [key, value] of Object.entries(action)) {
            detailsHtml += `<div class="action-detail-row">
                              <strong class="action-detail-key">${key}:</strong> 
                              <span class="action-detail-value">${JSON.stringify(value)}</span>
                           </div>`;
        }

        actionItem.innerHTML = `
            <div class="action-header">
                <span class="action-type">${action.type}</span>
                <div class="action-controls">
                    <button class="action-btn" data-action="edit" data-index="${index}">Edit</button>
                    <button class="action-btn" data-action="delete" data-index="${index}">Delete</button>
                </div>
            </div>
            <div class="action-details-editor">${detailsHtml}</div>
        `;
        actionEditor.appendChild(actionItem);
    });

    actionEditor.querySelectorAll('[data-action="delete"]').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            deleteAction(index);
        });
    });

    actionEditor.querySelectorAll('[data-action="edit"]').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            showActionEditorForm(index);
        });
    });

    let draggedIndex = null;

    actionEditor.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('action-item-editor')) {
            draggedIndex = parseInt(e.target.dataset.index, 10);
            e.target.classList.add('dragging');
        }
    });

    actionEditor.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('action-item-editor')) {
            e.target.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        }
    });

    actionEditor.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.target.closest('.action-item-editor');
        if (target && draggedIndex !== null) {
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            target.classList.add('drag-over');
        }
    });

    actionEditor.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target.closest('.action-item-editor');
        if (target && draggedIndex !== null) {
            const droppedIndex = parseInt(target.dataset.index, 10);
            const draggedAction = currentScript.phases.main_actions.actions.splice(draggedIndex, 1)[0];
            currentScript.phases.main_actions.actions.splice(droppedIndex, 0, draggedAction);
            updateActionEditor();
        }
        draggedIndex = null;
    });
}

function deleteAction(index) {
    currentScript.phases.main_actions.actions.splice(index, 1);
    updateActionEditor();
}

function showActionEditorForm(index) {
    const action = currentScript.phases.main_actions.actions[index];
    const actionEditor = document.getElementById('action-editor');
    const actionItemNode = actionEditor.querySelectorAll('.action-item-editor')[index];

    let formHtml = `<div class="action-header">
                        <span class="action-type">${action.type}</span>
                    </div>
                    <div class="action-edit-form">`;

    for (const [key, value] of Object.entries(action)) {
        if (key === 'locators') {
            formHtml += `<div class="action-detail-row">
                            <strong class="action-detail-key">locators:</strong>
                            <div id="locators-list-${index}" style="width: 100%;">`;
            value.forEach((locator, locatorIndex) => {
                formHtml += `<div class="locator-edit-row">
                                <input type="text" class="locator-input" value="${locator[0]}" placeholder="Strategy">
                                <input type="text" class="locator-input" value="${locator[1]}" placeholder="Value">
                                <button class="action-btn" onclick="removeLocator(this)">Remove</button>
                             </div>`;
            });
            formHtml += `</div></div><button class="action-btn" onclick="addLocator(${index})">Add Locator</button>`;
        } else if (key === 'timestamp' || key === 'id' || key === 'type') {
             formHtml += `<div class="action-detail-row">
                             <strong class="action-detail-key">${key}:</strong>
                             <span class="action-detail-value">${JSON.stringify(value)}</span>
                          </div>`;
        } else {
            const isObject = typeof value === 'object' && value !== null;
            formHtml += `<div class="action-detail-row">
                            <label class="action-detail-key" for="edit-${key}-${index}">${key}:</label>
                            <textarea id="edit-${key}-${index}" class="action-edit-input" rows="${isObject ? 3 : 1}">${isObject ? JSON.stringify(value, null, 2) : value}</textarea>
                         </div>`;
        }
    }

    formHtml += `<div class="action-controls" style="margin-top: 10px;">
                    <button class="action-btn primary" data-action="save" data-index="${index}">Save</button>
                    <button class="action-btn" data-action="cancel">Cancel</button>
                 </div></div>`;

    actionItemNode.innerHTML = formHtml;

    actionItemNode.querySelector('[data-action="save"]').addEventListener('click', () => saveAction(index, actionItemNode));
    actionItemNode.querySelector('[data-action="cancel"]').addEventListener('click', () => updateActionEditor());
}

function saveAction(index, actionItemNode) {
    const newAction = { ...currentScript.phases.main_actions.actions[index] };

    actionItemNode.querySelectorAll('textarea.action-edit-input').forEach(input => {
        const key = input.id.split('-')[1];
        try {
            newAction[key] = JSON.parse(input.value);
        } catch (e) {
            newAction[key] = input.value;
        }
    });

    const locators = [];
    actionItemNode.querySelectorAll('.locator-edit-row').forEach(row => {
        const inputs = row.querySelectorAll('.locator-input');
        if (inputs.length === 2 && inputs[0].value && inputs[1].value) {
            locators.push([inputs[0].value, inputs[1].value]);
        }
    });
    newAction.locators = locators;

    currentScript.phases.main_actions.actions[index] = newAction;
    updateActionEditor();
}

window.addLocator = (index) => {
    const list = document.getElementById(`locators-list-${index}`);
    const newRow = document.createElement('div');
    newRow.className = 'locator-edit-row';
    newRow.innerHTML = `
        <input type="text" class="locator-input" placeholder="Strategy (e.g., css)">
        <input type="text" class="locator-input" placeholder="Value (e.g., #my-id)">
        <button class="action-btn" onclick="removeLocator(this)">Remove</button>
    `;
    list.appendChild(newRow);
};

window.removeLocator = (button) => {
    button.parentElement.remove();
};

document.getElementById('save-script').addEventListener('click', () => {
    const scriptName = document.getElementById('script-name-input').value.trim();
    if (!scriptName) {
        alert('Please enter a script name');
        return;
    }

    currentScript.name = scriptName;
    currentScript.lastModified = new Date().toISOString();
    
    if (actions.length > 0) {
        currentScript.phases.main_actions.actions = [...actions];
    }

    const savedScripts = loadSavedScripts();
    
    const existingIndex = savedScripts.findIndex(s => s.name === scriptName);
    if (existingIndex >= 0) {
        savedScripts[existingIndex] = currentScript;
    } else {
        savedScripts.push(currentScript);
    }
    
    localStorage.setItem('automation-scripts', JSON.stringify(savedScripts));
    loadSavedScriptsList();
    
    alert('Script saved successfully with conditional branching!');
});

// Set up event listeners
// Set up event listeners for the new script button
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, setting up event listeners...');
    
    // Log all elements with ID 'new-script' for debugging
    const newScriptButtons = document.querySelectorAll('#new-script');
    console.log(`Found ${newScriptButtons.length} elements with ID 'new-script'`, newScriptButtons);
    
    // Event delegation for new script button
    document.addEventListener('click', function(event) {
        console.log('Document click event triggered');
        
        // Check if the clicked element or its parent is the new-script button
        const newScriptBtn = event.target.closest('#new-script');
        if (newScriptBtn) {
            console.log('New Script button clicked via delegation', {
                element: newScriptBtn,
                id: newScriptBtn.id,
                class: newScriptBtn.className,
                text: newScriptBtn.textContent.trim(),
                isConnected: newScriptBtn.isConnected
            });
            
            try {
                console.log('Initializing new script...');
                const script = initializeNewScript();
                console.log('New script initialized:', script);
                
                console.log('Showing new script modal...');
                showNewScriptModal();
            } catch (error) {
                console.error('Error handling new script button click:', error);
                alert('Error creating new script: ' + error.message);
            }
        }
    });
    
    // Initialize the scripting module
    console.log('Initializing scripting module...');
    initScripting();
    
    console.log('Event listeners setup complete');
});

function showNewScriptModal() {
    console.log('showNewScriptModal() called');
    try {
        console.log('Looking for new-script-modal element...');
        const modal = document.getElementById('new-script-modal');
        console.log('Modal element found:', modal);
        
        if (!modal) {
            throw new Error('Could not find new-script-modal element');
        }
        
        // Log current state
        const currentDisplay = window.getComputedStyle(modal).display;
        console.log('Current modal display style:', currentDisplay);
        
        // Force the modal to be visible
        console.log('Setting modal display to flex');
        modal.style.display = 'flex';
        
        // Add a small delay to ensure the display change takes effect
        setTimeout(() => {
            console.log('Modal display style after setting to flex:', window.getComputedStyle(modal).display);
            
            // Focus the script name input
            const scriptNameInput = modal.querySelector('#script-name');
            if (scriptNameInput) {
                scriptNameInput.focus();
                console.log('Focused script name input');
            } else {
                console.warn('Could not find script name input in modal');
            }
            
            // Log the modal's position and visibility
            const rect = modal.getBoundingClientRect();
            console.log('Modal position and size:', {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                isInViewport: rect.top >= 0 && 
                             rect.left >= 0 && 
                             rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && 
                             rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            });
            
            console.log('Modal should now be visible');
        }, 50);
        
    } catch (error) {
        console.error('Error showing new script modal:', error);
        alert('Error showing script modal: ' + error.message);
    }
}

function hideNewScriptModal() {
    const modal = document.getElementById('new-script-modal');
    modal.style.display = 'none';
    document.getElementById('new-script-name').value = '';
    document.getElementById('new-script-username').value = '';
    document.getElementById('new-script-password').value = '';
    document.getElementById('new-script-phone').value = '';
}

document.getElementById('create-script-and-start').addEventListener('click', async () => {
    const scriptName = document.getElementById('new-script-name').value.trim();
    if (!scriptName) {
        alert('Please enter a script name');
        return;
    }
    
    const credentials = {
        username: document.getElementById('new-script-username').value || null,
        password: document.getElementById('new-script-password').value || null,
        phone: document.getElementById('new-script-phone').value || null
    };
    
    createNewScript(scriptName, credentials);
    hideNewScriptModal();
    hideDashboard();
    
    if (credentials.username || credentials.password || credentials.phone) {
        await window.electronAPI.storeCredentials(credentials);
    }
    
    await window.electronAPI.startRecording();
});

document.getElementById('create-script-only').addEventListener('click', () => {
    const scriptName = document.getElementById('new-script-name').value.trim();
    if (!scriptName) {
        alert('Please enter a script name');
        return;
    }
    
    const credentials = {
        username: document.getElementById('new-script-username').value || null,
        password: document.getElementById('new-script-password').value || null,
        phone: document.getElementById('new-script-phone').value || null
    };
    
    createNewScript(scriptName, credentials);
    hideNewScriptModal();
    showEditorForScript();
});

document.getElementById('cancel-new-script').addEventListener('click', hideNewScriptModal);

function createNewScript(name, credentials) {
    currentScript = {
        name: name,
        credentials: credentials,
        phases: {
            initialization: { actions: [{ type: 'navigate', url: '', conditions: [] }] },
            authentication: {
                conditions: [{
                    type: 'if_logged_in',
                    check: { element: '.user-avatar', exists: true },
                    then: [],
                    else: [{
                        type: 'choose_login_method',
                        options: {
                            google: [{ type: 'click', locators: [['css', '.google-login-btn']] }],
                            credentials: [
                                { type: 'enter-credential-username', locators: [['id', 'username']] },
                                { type: 'enter-credential-password', locators: [['id', 'password']] },
                                { type: 'click', locators: [['css', 'button[type="submit"]']] }
                            ]
                        }
                    }]
                }]
            },
            main_actions: { actions: [] }
        }
    };
    
    document.getElementById('script-name-input').value = name;
}

function showEditorForScript() {
    document.getElementById('editor-toolbar').style.display = 'flex';
    updateActionEditor();
}

document.getElementById('view-json').addEventListener('click', () => {
    updateActionEditor();
});

document.getElementById('cred-save').addEventListener('click', async () => {
    const credentials = {
        username: document.getElementById('cred-username').value || null,
        password: document.getElementById('cred-password').value || null,
        phone: document.getElementById('cred-phone').value || null
    };

    if (credentials.username || credentials.password || credentials.phone) {
        await window.electronAPI.storeCredentials(credentials);
    }

    hideCredentialModal();
    await window.electronAPI.startRecording();
});

document.getElementById('cred-skip').addEventListener('click', async () => {
    hideCredentialModal();
    await window.electronAPI.startRecording();
});

console.log('Scripting module loaded');
