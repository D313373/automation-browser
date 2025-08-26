const { spawn } = require('child_process');
const path = require('path');
const { logger } = require('../utils/logger');

class PythonServer {
  constructor() {
    this.serverProcess = null;
    this.wsPort = 8889;
    this.pythonPath = null;
  }

  async start(appPath) {
    const pythonCommand = await this.getPythonCommand();
    const serverPath = path.join(appPath, 'python-server', 'server.py');

    return new Promise((resolve, reject) => {
      this.serverProcess = spawn(pythonCommand, [
        serverPath,
        '--ws-port', this.wsPort.toString()
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      let serverReady = false;

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        logger.info(`[Python Server STDOUT]: ${output}`);
        if (!serverReady && output.includes('Automation server running')) {
          serverReady = true;
          logger.info(`Python server is ready on port ${this.wsPort}.`);
          resolve(this.serverProcess);
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString().trim();
        logger.error(`[Python Server STDERR]: ${errorOutput}`);
      });

      this.serverProcess.on('close', (code) => {
        logger.warn(`Python server process closed with code: ${code}`);
        if (!serverReady) {
          const errorMessage = `Python server failed to start, exited with code ${code}`;
          logger.error(errorMessage);
          reject(new Error(errorMessage));
        }
      });

      this.serverProcess.on('error', (err) => {
        logger.error('Failed to start Python server process:', err);
        if (!serverReady) {
          reject(err);
        }
      });
    });
  }

  async stop() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
      logger.info('Python server stopped');
    }
  }

  async getPythonCommand() {
    // Check for Python 3 first, then fall back to python
    try {
      await this.testPythonCommand('python3 --version');
      return 'python3';
    } catch (e) {
      try {
        await this.testPythonCommand('python --version');
        return 'python';
      } catch (e) {
        throw new Error('Python is not installed or not in PATH. Please install Python 3.7 or later.');
      }
    }
  }

  testPythonCommand(command) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, { shell: true });
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed: ${command}`));
        }
      });
    });
  }
}

// Create a singleton instance
const pythonServer = new PythonServer();

// Handle process exit
process.on('exit', () => {
  if (pythonServer) {
    pythonServer.stop();
  }
});

module.exports = {
  startPythonServer: (appPath) => pythonServer.start(appPath),
  stopPythonServer: () => pythonServer.stop()
};
