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
    return {
        name: '',
        phases: {
            initialization: {
                actions: [
                    { type: 'navigate', url: '', conditions: [] }
                ]
            },
            authentication: {
                conditions: [
                    {
                        type: 'if_logged_in',
                        check: { element: '.user-avatar', exists: true },
                        then: [],
                        else: [
                            {
                                type: 'choose_login_method',
                                options: {
                                    google: [
                                        { type: 'click', locators: [['css', '.google-login-btn']] }
                                    ],
                                    credentials: [
                                        { type: 'enter-credential-username', locators: [['id', 'username']] },
                                        { type: 'enter-credential-password', locators: [['id', 'password']] },
                                        { type: 'click', locators: [['css', 'button[type="submit"]']] }
                                    ]
                                }
                            }
                        ]
                    }
                ]
            },
            main_actions: {
                actions: []
            }
        }
    };
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

// Debug: Check if button exists
const newScriptBtn = document.getElementById('new-script');
if (!newScriptBtn) {
    console.error('Error: Could not find new-script button in the DOM');
} else {
    console.log('Found new-script button, adding click handler');
    newScriptBtn.addEventListener('click', function(e) {
        console.log('New Script button clicked. Event:', e);
        try {
            console.log('Initializing new script...');
            currentScript = initializeNewScript();
            console.log('New script initialized:', currentScript);
            console.log('Showing new script modal...');
            showNewScriptModal();
            console.log('After showNewScriptModal() call');
        } catch (error) {
            console.error('Error in new script button handler:', error);
            alert('Error creating new script: ' + error.message);
        }
    });
    console.log('Click handler added to new-script button');
}

function showNewScriptModal() {
    console.log('showNewScriptModal() called');
    try {
        console.log('Looking for new-script-modal element...');
        const modal = document.getElementById('new-script-modal');
        console.log('Modal element:', modal);
        
        if (!modal) {
            throw new Error('Could not find new-script-modal element');
        }
        
        console.log('Setting modal display to flex');
        modal.style.display = 'flex';
        
        console.log('Setting focus to new-script-name input');
        const nameInput = document.getElementById('new-script-name');
        if (nameInput) {
            nameInput.focus();
        } else {
            console.error('Could not find new-script-name input');
        }
        
        console.log('Modal should now be visible');
    } catch (error) {
        console.error('Error in showNewScriptModal:', error);
        throw error; // Re-throw to be caught by the caller
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
