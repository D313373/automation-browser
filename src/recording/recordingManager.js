const EventEmitter = require('events');
const { BrowserWindow } = require('electron');
const { logger } = require('../utils/logger');

class RecordingManager extends EventEmitter {
  constructor() {
    super();
    this.isRecording = false;
    this.recordedActions = [];
  }

  initialize() {
    logger.info('Initializing RecordingManager');
    logger.info('RecordingManager initialized');
  }

  startRecording() {
    try {
      if (this.isRecording) {
        logger.warn('Attempted to start recording while already recording');
        return { success: false, message: 'Already recording' };
      }
      
      logger.info('Starting new recording session');
      this.isRecording = true;
      this.recordedActions = [];
      
      // Emit events for state changes
      this.emit('recording-started');
      this.emit('recording-state-changed', true);
      
      // Notify all windows about the recording state change
      this.broadcastToWindows('recording-state-changed', true);
      this.broadcastToWindows('recording-status', { 
        isRecording: true,
        actionCount: 0
      });
      
      logger.info('Recording started successfully');
      return { 
        success: true, 
        message: 'Recording started',
        actionCount: 0
      };
    } catch (error) {
      logger.error('Error starting recording:', error);
      this.isRecording = false;
      // Emit error event
      this.emit('recording-error', error);
      return { 
        success: false, 
        message: `Failed to start recording: ${error.message}`,
        error: error.message
      };
    }
  }

  stopRecording() {
    try {
      if (!this.isRecording) {
        logger.warn('Attempted to stop recording when not recording');
        return { success: false, message: 'Not recording' };
      }
      
      logger.info('Stopping recording session', {
        actionCount: this.recordedActions.length
      });
      
      this.isRecording = false;
      const actionCount = this.recordedActions.length;
      
      // Emit events for state changes
      this.emit('recording-stopped', { actionCount });
      this.emit('recording-state-changed', false);
      
      // Notify all windows about the recording state change
      this.broadcastToWindows('recording-state-changed', false);
      this.broadcastToWindows('recording-status', { 
        isRecording: false,
        actionCount
      });
      
      // Emit final actions list
      if (actionCount > 0) {
        this.emit('actions-recorded', this.recordedActions);
      }
      
      logger.info('Recording stopped successfully', { actionCount });
      return { 
        success: true, 
        message: 'Recording stopped',
        actionCount
      };
    } catch (error) {
      logger.error('Error stopping recording:', error);
      this.emit('recording-error', error);
      return { 
        success: false, 
        message: `Failed to stop recording: ${error.message}`,
        error: error.message
      };
    }
  }

  broadcastToWindows(channel, data) {
    try {
      this.emit(channel, data);
      
      const windows = BrowserWindow.getAllWindows();
      logger.debug(`Broadcasting '${channel}' to ${windows.length} windows`, {
        dataType: typeof data === 'object' ? 'object' : typeof data,
        hasData: !!data
      });
      
      windows.forEach((window, index) => {
        try {
          if (window.webContents && !window.webContents.isDestroyed()) {
            window.webContents.send(channel, data);
          } else {
            logger.warn(`Window ${index} not available for broadcast`);
          }
        } catch (error) {
          logger.error(`Error broadcasting to window ${index}:`, error);
        }
      });
    } catch (error) {
      logger.error('Error in broadcastToWindows:', error);
    }
  }

  recordAction(action) {
    if (!this.isRecording) {
      logger.warn('Received action while not recording:', action?.type || 'unknown');
      return { success: false, message: 'Not recording' };
    }

    try {
      // Add timestamp to the action
      const timestamp = new Date().toISOString();
      const actionWithMeta = {
        ...action,
        id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
        timestampDisplay: new Date(timestamp).toLocaleTimeString()
      };

      logger.debug('Recording action:', {
        type: actionWithMeta.type,
        id: actionWithMeta.id,
        timestamp: actionWithMeta.timestamp
      });

      // Add to recorded actions
      this.recordedActions.push(actionWithMeta);
      
      // Emit events
      this.emit('action-recorded', actionWithMeta);
      this.emit('actions-updated', this.recordedActions);
      
      // Broadcast to all windows
      this.broadcastToWindows('action-recorded', actionWithMeta);
      this.broadcastToWindows('actions-updated', this.recordedActions);
      
      // Update status with new action count
      this.broadcastToWindows('recording-status', {
        isRecording: true,
        actionCount: this.recordedActions.length
      });

      return { success: true, action: actionWithMeta };
    } catch (error) {
      logger.error('Error recording action:', error);
      this.emit('recording-error', { error: error.message, action });
      return { 
        success: false, 
        message: `Failed to record action: ${error.message}`,
        error: error.message 
      };
    }
  }

  getRecordedActions() {
    return [...this.recordedActions]; // Return a copy to prevent external modification
  }

  clearRecordedActions() {
    logger.info('Clearing all recorded actions');
    this.recordedActions = [];
    this.broadcastToWindows('actions-cleared', {});
    return { success: true, message: 'Recorded actions cleared' };
  }
}

module.exports = new RecordingManager();
