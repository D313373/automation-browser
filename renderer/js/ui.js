// DOM elements
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const urlBar = document.getElementById('url-bar');
const recordingDot = document.getElementById('recording-dot');
const recordingText = document.getElementById('recording-text');
const actionList = document.getElementById('action-list');
const backToDashboardBtn = document.getElementById('back-to-dashboard');
const recordingOverlay = document.getElementById('recording-overlay');
const recordingBanner = document.getElementById('recording-banner');
const dashboardOverlay = document.getElementById('dashboard-overlay');
const dashboardClose = document.getElementById('dashboard-close');
const mainContainer = document.querySelector('.main-container');
const profileCheckBtn = document.getElementById('profile-check');
const credentialModal = document.getElementById('credential-modal');

// Navigation controls
backBtn.addEventListener('click', () => {
    window.electronAPI.browserBack();
});

forwardBtn.addEventListener('click', () => {
    window.electronAPI.browserForward();
});

reloadBtn.addEventListener('click', () => {
    window.electronAPI.browserReload();
});

urlBar.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        let url = urlBar.value.trim();
        if (url.startsWith('chrome://')) {
            window.electronAPI.navigateTo(url);
        } else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
            url = 'https://' + url;
            window.electronAPI.navigateTo(url);
        } else {
            window.electronAPI.navigateTo(url);
        }
    }
});

// Dashboard visibility
function showDashboard() {
    dashboardOverlay.classList.remove('hidden');
    mainContainer.classList.add('dashboard-active');
    loadSavedScripts();
}

function hideDashboard() {
    dashboardOverlay.classList.add('hidden');
    mainContainer.classList.remove('dashboard-active');
    window.electronAPI.showBrowserView();
}

window.hideDashboard = hideDashboard;

// Initialize dashboard as main view
showDashboard();

// Event listeners for dashboard
backToDashboardBtn.addEventListener('click', () => {
    window.electronAPI.hideBrowserView();
    showDashboard();
});

dashboardClose.addEventListener('click', () => {
    hideDashboard();
});

// Context Menu
document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        e.preventDefault();
        const contextMenu = document.createElement('div');
        contextMenu.style.cssText = `
            position: fixed; top: ${e.clientY}px; left: ${e.clientX}px;
            background: white; border: 1px solid #ccc; border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 10000;
            font-family: Arial, sans-serif; font-size: 14px;
        `;
        
        const menuItems = [
            { label: 'Cut', action: () => { document.execCommand('cut'); } },
            { label: 'Copy', action: () => { document.execCommand('copy'); } },
            { label: 'Paste', action: () => { document.execCommand('paste'); } },
            { label: 'Select All', action: () => { e.target.select(); } }
        ];
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.textContent = item.label;
            menuItem.style.cssText = `
                padding: 8px 16px; cursor: pointer; border-bottom: 1px solid #eee;
            `;
            menuItem.onmouseover = () => menuItem.style.background = '#f0f0f0';
            menuItem.onmouseout = () => menuItem.style.background = 'white';
            menuItem.onclick = () => {
                item.action();
                contextMenu.remove();
            };
            contextMenu.appendChild(menuItem);
        });
        
        document.body.appendChild(contextMenu);
        
        setTimeout(() => {
            document.addEventListener('click', () => contextMenu.remove(), { once: true });
        }, 100);
    }
});

// Profile Status Check
profileCheckBtn.addEventListener('click', async () => {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
        align-items: center; justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white; padding: 20px; border-radius: 8px; 
        max-width: 500px; max-height: 80%; overflow-y: auto;
        color: black; font-family: Arial, sans-serif;
    `;
    
    content.innerHTML = `
        <h3 style="margin-top: 0;">Profile Status Check</h3>
        <p>Click these links to verify sync:</p>
        <ul style="list-style: none; padding: 0;">
            <li><a href="#" onclick="window.electronAPI.navigateTo('https://myaccount.google.com/'); return false;" 
                   style="color: #1976d2; text-decoration: none; display: block; padding: 5px 0;">
                • Google Account: https://myaccount.google.com/</a></li>
            <li><a href="#" onclick="window.electronAPI.navigateTo('chrome://settings/syncSetup'); return false;"
                   style="color: #1976d2; text-decoration: none; display: block; padding: 5px 0;">
                • Chrome Sync: chrome://settings/syncSetup</a></li>
            <li><a href="#" onclick="window.electronAPI.navigateTo('chrome://bookmarks/'); return false;"
                   style="color: #1976d2; text-decoration: none; display: block; padding: 5px 0;">
                • Bookmarks: chrome://bookmarks/</a></li>
            <li><a href="#" onclick="window.electronAPI.navigateTo('chrome://history/'); return false;"
                   style="color: #1976d2; text-decoration: none; display: block; padding: 5px 0;">
                • History: chrome://history/</a></li>
            <li><a href="#" onclick="window.electronAPI.navigateTo('chrome://settings/'); return false;"
                   style="color: #1976d2; text-decoration: none; display: block; padding: 5px 0;">
                • Settings: chrome://settings/</a></li>
        </ul>
        <p><strong>If logged in and synced, you should see:</strong></p>
        <ul>
            <li>✓ Your bookmarks and history</li>
            <li>✓ Saved passwords (with master password)</li>
            <li>✓ Extensions and settings</li>
            <li>✓ Open tabs from other devices</li>
        </ul>
        <button onclick="this.closest('div').parentElement.remove()" 
                style="background: #1976d2; color: white; border: none; padding: 8px 16px; 
                       border-radius: 4px; cursor: pointer; margin-top: 10px;">Close</button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
});

// Server Status
function updateServerStatus(status) {
    const statusText = {
        'connected': 'Python server connected',
        'disconnected': 'Python server disconnected', 
        'error': 'Python server error'
    };

    const serverText = document.getElementById('server-text');
    serverText.textContent = statusText[status] || 'Unknown status';
    
    if (status === 'connected') {
        serverDot.classList.add('connected');
    } else {
        serverDot.classList.remove('connected');
    }
}

// Action List
function updateActionList() {
    if (actions.length === 0) {
        actionList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎬</div>
                <div>No actions recorded yet</div>
                <div style="font-size: 12px; margin-top: 4px;">Start recording to capture automation steps</div>
            </div>
        `;
        return;
    }

    actionList.innerHTML = actions.map((action, index) => {
        const time = new Date(action.timestamp).toLocaleTimeString();
        const details = getActionDetails(action);
        
        return `
            <div class="action-item">
                <div class="action-header">
                    <span class="action-type">${action.type}</span>
                    <span class="action-time">${time}</span>
                </div>
                <div class="action-details">${details}</div>
            </div>
        `;
    }).join('');
}

function getActionDetails(action) {
    const frameInfo = action.frameId ? (action.isMainFrame ? ' [Main]' : ` [Frame: ${action.frameId}]`) : '';
    
    switch (action.type) {
        case 'click':
            const locatorCount = action.locators ? action.locators.length : 0;
            const primaryLocator = action.locators && action.locators[0] ? `${action.locators[0][0]}=${action.locators[0][1].substring(0, 50)}` : (action.selector || 'element');
            const coordinates = action.absoluteX && action.absoluteY ? ` @(${Math.round(action.absoluteX)},${Math.round(action.absoluteY)})` : '';
            const elementInfo = action.tagName ? ` <${action.tagName}>` : '';
            return `Click${elementInfo}: ${primaryLocator}${action.text ? ` ("${action.text.substring(0, 20)}")` : ''}${coordinates} [${locatorCount} locators]${frameInfo}`;
        case 'type':
            const typeLocatorCount = action.locators ? action.locators.length : 0;
            const typePrimaryLocator = action.locators && action.locators[0] ? `${action.locators[0][0]}=${action.locators[0][1]}` : action.selector;
            return `Type in ${typePrimaryLocator}: "${action.value}" [${typeLocatorCount} locators]${frameInfo}`;
        case 'enter-credential-username':
            const userLocatorCount = action.locators ? action.locators.length : 0;
            const userPrimaryLocator = action.locators && action.locators[0] ? `${action.locators[0][0]}=${action.locators[0][1]}` : action.selector;
            return `🔐 Enter username in ${userPrimaryLocator} [${userLocatorCount} locators]${frameInfo}`;
        case 'enter-credential-password':
            const passLocatorCount = action.locators ? action.locators.length : 0;
            const passPrimaryLocator = action.locators && action.locators[0] ? `${action.locators[0][0]}=${action.locators[0][1]}` : action.selector;
            return `🔐 Enter password in ${passPrimaryLocator} [${passLocatorCount} locators]${frameInfo}`;
        case 'keypress':
            const keyDesc = action.key.length === 1 ? `"${action.key}"` : action.key;
            let modifierList = [];
            if (action.ctrlKey) modifierList.push('Ctrl');
            if (action.altKey) modifierList.push('Alt');
            if (action.shiftKey) modifierList.push('Shift');
            if (action.metaKey) modifierList.push('Cmd');
            const modifiers = modifierList.length > 0 ? ` (${modifierList.join('+')})` : '';
            return `Key: ${keyDesc}${modifiers}${frameInfo}`;
        case 'navigate':
            const fromUrl = action.fromUrl ? ` (from ${new URL(action.fromUrl).hostname})` : '';
            return `Navigate to: ${action.url}${fromUrl}${frameInfo}`;
        case 'scroll':
            return `Scroll to: x=${Math.round(action.x)}, y=${Math.round(action.y)}${frameInfo}`;
        case 'recording-started':
            return `Recording started on: ${action.url}${frameInfo}`;
        default:
            return JSON.stringify(action, null, 2);
    }
}

// Credential Modal
function showCredentialModal() {
    credentialModal.style.display = 'block';
    document.getElementById('credential-username').focus();
}

function hideCredentialModal() {
    credentialModal.style.display = 'none';
    document.getElementById('credential-username').value = '';
    document.getElementById('credential-password').value = '';
    document.getElementById('credential-phone').value = '';
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (credentialModal.style.display === 'block') {
            hideCredentialModal();
        }
    }
});

credentialModal.addEventListener('click', (e) => {
    if (e.target.id === 'credential-modal') {
        hideCredentialModal();
    }
});

// Phase toggle functionality
function togglePhase(phaseId) {
    const content = document.getElementById(`phase-${phaseId}`);
    const header = content.previousElementSibling;
    const arrow = header.querySelector('span');
    
    if (content.classList.contains('active')) {
        content.classList.remove('active');
        arrow.textContent = '▶';
    } else {
        content.classList.add('active');
        arrow.textContent = '▼';
    }
}

// Make togglePhase globally accessible
window.togglePhase = togglePhase;

console.log('UI module loaded');
