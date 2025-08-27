// Test script to verify recording functionality
const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');

let app;
let mainWindow;

test.beforeAll(async () => {
  // Launch the app
  app = await electron.launch({
    args: [path.join(__dirname, '..', 'main.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });

  // Get the main window
  mainWindow = await app.firstWindow();
  await mainWindow.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  // Close the app
  await app.close();
});

test('should start and stop recording', async () => {
  // Wait for the app to be fully loaded
  await mainWindow.waitForSelector('#toggle-recording-btn');
  
  // Check initial state
  const isInitiallyRecording = await mainWindow.evaluate(() => window.recording.isRecording());
  expect(isInitiallyRecording).toBe(false);
  
  // Start recording
  await mainWindow.click('#toggle-recording-btn');
  
  // Wait for recording to start
  await mainWindow.waitForFunction(() => window.recording.isRecording(), { timeout: 5000 });
  
  // Verify recording started
  const isRecording = await mainWindow.evaluate(() => window.recording.isRecording());
  expect(isRecording).toBe(true);
  
  // Stop recording
  await mainWindow.click('#toggle-recording-btn');
  
  // Wait for recording to stop
  await mainWindow.waitForFunction(() => !window.recording.isRecording(), { timeout: 5000 });
  
  // Verify recording stopped
  const isStillRecording = await mainWindow.evaluate(() => window.recording.isRecording());
  expect(isStillRecording).toBe(false);
});

test('should update UI when recording starts and stops', async () => {
  // Wait for the app to be fully loaded
  await mainWindow.waitForSelector('#toggle-recording-btn');
  
  // Start recording
  await mainWindow.click('#toggle-recording-btn');
  
  // Wait for recording UI to update
  await mainWindow.waitForSelector('.recording', { state: 'visible' });
  
  // Verify UI shows recording state
  const isRecordingVisible = await mainWindow.isVisible('.recording');
  expect(isRecordingVisible).toBe(true);
  
  // Stop recording
  await mainWindow.click('#toggle-recording-btn');
  
  // Wait for recording UI to update
  await mainWindow.waitForSelector('.recording', { state: 'hidden' });
  
  // Verify UI shows stopped state
  const isRecordingHidden = await mainWindow.isVisible('.recording');
  expect(isRecordingHidden).toBe(false);
});
