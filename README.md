# Automation Browser

A native desktop automation browser built with Electron that functions exactly like Chrome but includes an integrated side panel with timeline recording and web scraping tools.

## Features

- **Native Browser**: Built with Electron, functions like Chrome
- **Dashboard-First Design**: Create named scripts before recording
- **Timeline Recording**: Visual automation builder in side panel
- **Python Server Backend**: Uses undetected_chromedriver and Selenium
- **Secure Chrome Profile Integration**: Stealth "Sign in with Google" automation
- **Credential Management**: Per-script credential storage for secure automation
- **Script Sharing**: Share automation scripts without exposing credentials
- **Conditional Branching**: JSON scripts support different automation paths

## Quick Start

1. **Extract and Setup**:
   ```bash
   # Extract the files
   tar -xzf automation-browser-CLEAN-REPOSITORY.tar.gz
   cd automation-browser
   
   # Install Node.js dependencies
   npm install
   
   # Install Python dependencies
   cd python-server
   pip install -r requirements.txt
   cd ..
   ```

2. **Launch the Application**:
   ```bash
   # Run the sync and launch script
   ./sync-and-launch.sh
   ```

3. **Create Your First Script**:
   - Application opens with dashboard view
   - Click "New Script" to create automation
   - Optionally add credentials for secure automation
   - Start recording browser interactions in the side panel

## Architecture

- **Frontend**: Electron with integrated browser and side panel
- **Backend**: Python server with undetected_chromedriver
- **Communication**: WebSocket between Electron and Python server
- **Security**: Credential pre-capture system prevents sensitive data exposure

## File Structure

```
automation-browser/
├── src/                    # Electron main process
│   ├── main.js            # Main Electron process
│   └── preload.js         # Preload script for renderer
├── renderer/               # Electron renderer (UI)
│   ├── index.html         # Main UI with dashboard
│   └── styles.css         # Application styles
├── python-server/          # Python automation backend
│   ├── server.py          # WebSocket server
│   └── requirements.txt   # Python dependencies
├── package.json           # Node.js dependencies
└── sync-and-launch.sh     # Launch script
```

## Development

The application uses a dashboard-first approach where users must create a named script before recording. The side panel provides timeline editing while the main area functions as a full browser.

## Security

- Credentials are captured during script creation (optional)
- Sensitive data never appears in automation timelines
- Chrome profile integration maintains existing login sessions
- Stealth automation prevents detection

## Dependencies

- **Node.js**: Electron runtime
- **Python 3.7+**: Backend automation server
- **Chrome/Chromium**: For undetected_chromedriver