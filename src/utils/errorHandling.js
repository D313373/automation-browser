const { dialog } = require('electron');
const { logger } = require('./logger');

function setupErrorHandling() {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    const errorMsg = error.stack ? error.stack : error.toString();
    logger.error(`Uncaught Exception: ${errorMsg}`);
    
    // Show error dialog to user
    dialog.showErrorBox('An error occurred', 
      `An unexpected error occurred. Please restart the application.\n\n${error.message}`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Handle renderer process crashes
  const handleRendererCrash = (window, type) => {
    if (window) {
      window.webContents.on('crashed', () => {
        logger.error(`Renderer process crashed: ${type}`);
        dialog.showErrorBox(
          'Renderer Process Crashed',
          'The application window has crashed. Please reload the application.'
        );
      });
    }
  };

  return {
    handleRendererCrash
  };
}

module.exports = { setupErrorHandling };
