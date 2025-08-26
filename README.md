# Automation Browser

A native desktop automation browser built with Electron that functions exactly like Chrome but includes an integrated side panel with timeline recording and web automation tools.

## ✨ Features

- **Native Browser Experience**: Built with Electron, providing a Chrome-like browsing experience
- **Visual Automation Builder**: Record and replay browser interactions with ease
- **Dashboard Interface**: Manage and organize your automation scripts
- **Python Backend**: Leverages undetected_chromedriver for reliable automation
- **Secure Credential Management**: Store and manage credentials securely
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Developer Tools**: Built-in developer tools for debugging and inspection
- **Modular Architecture**: Easy to extend and customize

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm 8+
- Python 3.7+
- Chrome/Chromium browser installed

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/automation-browser.git
   cd automation-browser
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Install Python dependencies**:
   ```bash
   cd python-server
   pip install -r requirements.txt
   cd ..
   ```

### Running the Application

```bash
# Start the application
npm start

# For development with hot-reload
npm run dev
```

### Creating Your First Automation

1. Launch the application
2. Click "New Script" in the dashboard
3. Enter a name and description for your script
4. Click the record button to start capturing browser interactions
5. Interact with web pages as needed
6. Click stop when finished
7. Save and replay your automation

## 🏗️ Project Structure

```
automation-browser/
├── src/                      # Main application source
│   ├── browser/             # Browser window management
│   ├── ipc/                 # Inter-process communication handlers
│   ├── python/              # Python server integration
│   ├── recording/           # Recording functionality
│   ├── ui/                  # UI components and menus
│   └── utils/               # Utility functions
├── python-server/           # Python automation server
│   ├── server.py           # WebSocket server
│   └── requirements.txt    # Python dependencies
├── renderer/               # Frontend code
│   └── index.html          # Main window HTML
├── package.json            # Node.js dependencies
└── README.md               # This file
```

## 🔌 Architecture

- **Frontend**: Electron with React for UI components
- **Backend**: Python WebSocket server with undetected_chromedriver
- **Communication**: WebSocket for real-time messaging
- **Security**: Secure credential storage with encryption
- **Logging**: Comprehensive logging system for debugging

## 🛠 Development

### Building for Production

```bash
# Build the application
npm run build

# Package for current platform
npm run dist
```

### Debugging

- Use Chrome DevTools (Cmd+Option+I or Ctrl+Shift+I)
- Check logs in:
  - macOS: `~/Library/Logs/automation-browser/main.log`
  - Windows: `%USERPROFILE%\AppData\Roaming\automation-browser\logs`
  - Linux: `~/.config/automation-browser/logs`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Electron](https://www.electronjs.org/)
- [undetected-chromedriver](https://github.com/ultrafunkamsterdam/undetected-chromedriver)
- [Selenium](https://www.selenium.dev/)
- And all the amazing open-source libraries we depend on!

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