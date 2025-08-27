#!/usr/bin/env python3
"""
Automation Browser Python Server
WebSocket server for browser automation using undetected_chromedriver
"""

import asyncio
import websockets
import json
import logging
import subprocess
import sys
from pathlib import Path
import signal
from script_executor import ScriptExecutor
import psutil
import re
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

class AutomationServer:
    def __init__(self, port=8889):
        self.port = port
        self.chrome_process = None
        self.clients = set()

    def _terminate_process_on_port(self):
        """Find and terminate any process listening on the server's port."""
        logger.info(f"Checking for existing process on port {self.port}...")
        if os.name == 'nt': # Windows
            command = f"netstat -aon | findstr :{self.port}"
            # This implementation is left as an exercise for Windows compatibility
            logger.warning("Port checking for Windows is not fully implemented.")
            return

        try:
            # Use lsof to find the PID of the process listening on the port
            command = f"lsof -i TCP:{self.port} -sTCP:LISTEN -t"
            result = subprocess.run(command, shell=True, capture_output=True, text=True)
            pids = [int(p) for p in result.stdout.strip().split('\n') if p.isdigit()]

            for pid in pids:
                if pid == os.getpid():
                    continue # Do not terminate self
                try:
                    proc = psutil.Process(pid)
                    logger.warning(f"Found process {proc.name()} (PID: {proc.pid}) using port {self.port}. Terminating it.")
                    proc.terminate()
                    proc.wait(timeout=3)
                    logger.info(f"Process {pid} terminated successfully.")
                except psutil.TimeoutExpired:
                    logger.warning(f"Process {pid} did not terminate in time, killing it.")
                    proc.kill()
                except psutil.NoSuchProcess:
                    logger.info(f"Process with PID {pid} no longer exists.")
                except psutil.AccessDenied:
                    logger.error(f"Access denied to terminate process with PID {pid}. Please terminate it manually.")
        except FileNotFoundError:
            logger.error("'lsof' command not found. Cannot check for processes on port.")
        except Exception as e:
            logger.error(f"An error occurred while checking for processes on port {self.port}: {e}", exc_info=True)
        
    async def register_client(self, websocket):
        """Register a new WebSocket client"""
        self.clients.add(websocket)
        logger.info(f"Client connected. Total clients: {len(self.clients)}")
        
    async def unregister_client(self, websocket):
        """Unregister a WebSocket client"""
        self.clients.discard(websocket)
        logger.info(f"Client disconnected. Total clients: {len(self.clients)}")
        
    async def broadcast_message(self, message):
        """Broadcast message to all connected clients"""
        if self.clients:
            await asyncio.gather(
                *[client.send(json.dumps(message)) for client in self.clients],
                return_exceptions=True
            )
    
    async def handle_chrome_integration(self, data):
        """Handle Chrome profile integration requests"""
        try:
            action = data.get('action')
            
            if action == 'start':
                # Start Chrome with user profile integration
                logger.info("Starting Chrome with profile integration")
                return {
                    'type': 'chrome_response',
                    'status': 'success',
                    'message': 'Chrome integration started'
                }
                
            elif action == 'stop':
                # Stop Chrome process
                if self.chrome_process:
                    self.chrome_process.terminate()
                    self.chrome_process = None
                    logger.info("Chrome process terminated")
                
                return {
                    'type': 'chrome_response',
                    'status': 'success',
                    'message': 'Chrome integration stopped'
                }
                
        except Exception as e:
            logger.error(f"Chrome integration error: {e}")
            return {
                'type': 'chrome_response',
                'status': 'error',
                'message': str(e)
            }
    
    async def handle_automation_script(self, data):
        """Handle automation script execution"""
        script_data = data.get('script', {})
        script_name = script_data.get('name', 'Unnamed Script')
        headless = data.get('headless', False)
        
        logger.info(f"Executing automation script: {script_name}")
        
        try:
            # Create a new ScriptExecutor instance
            script_executor = ScriptExecutor()
            
            # Start the WebDriver
            script_executor.start_driver(headless=headless)
            
            # Execute the script
            results = script_executor.execute_script(script_data)
            
            # Prepare response
            response = {
                'type': 'automation_response',
                'status': 'success' if results['success'] else 'error',
                'message': f'Script "{script_name}" completed',
                'details': {
                    'executed_actions': results['executed_actions'],
                    'total_actions': results['total_actions'],
                    'errors': results['errors']
                }
            }
            
            return response
            
        except Exception as e:
            logger.error(f"Automation script error: {e}", exc_info=True)
            return {
                'type': 'automation_response',
                'status': 'error',
                'message': f'Script execution failed: {str(e)}',
                'details': {
                    'executed_actions': 0,
                    'total_actions': len(script_data.get('actions', [])),
                    'errors': [str(e)]
                }
            }
            
        finally:
            # Ensure the WebDriver is properly closed
            if 'script_executor' in locals():
                script_executor.close()
    
    async def handle_message(self, websocket, path):
        """
        Handle incoming WebSocket messages
        
        Args:
            websocket: The WebSocket connection
            path: The request path (required by websockets library)
        """
        client_ip = websocket.remote_address[0] if websocket.remote_address else 'unknown'
        client_id = f"{client_ip}-{id(websocket)}"
        
        logger.info(f"[{client_id}] New WebSocket connection from {client_ip} at path: {path}")
        
        try:
            # Register the client
            await self.register_client(websocket)
            logger.info(f"[{client_id}] Client registered successfully")
            
            # Send a welcome message
            await websocket.send(json.dumps({
                'type': 'connection_established',
                'message': 'Connected to automation server',
                'client_id': client_id,
                'timestamp': 12345  # This should be a real timestamp in a production environment
            }))
            
            # Main message loop
            async for message in websocket:
                try:
                    logger.info(f"[{client_id}] Received raw message: {message[:200]}..." if len(str(message)) > 200 else f"[{client_id}] Received message: {message}")
                    
                    data = json.loads(message)
                    message_type = data.get('type')
                    
                    logger.info(f"[{client_id}] Processing message type: {message_type}")
                    
                    response = None
                    
                    if message_type == 'chrome_integration':
                        response = await self.handle_chrome_integration(data)
                    elif message_type == 'automation_script':
                        response = await self.handle_automation_script(data)
                    elif message_type == 'ping':
                        response = {
                            'type': 'pong', 
                            'timestamp': data.get('timestamp'),
                            'server_time': 12345  # This should be a real timestamp in a production environment
                        }
                    else:
                        logger.warning(f"[{client_id}] Unknown message type: {message_type}")
                        response = {
                            'type': 'error',
                            'message': f'Unknown message type: {message_type}'
                        }
                    
                    if response:
                        logger.info(f"[{client_id}] Sending response: {response}")
                        await websocket.send(json.dumps(response))
                            
                except json.JSONDecodeError as e:
                    error_msg = f"Invalid JSON received: {e}"
                    logger.error(f"[{client_id}] {error_msg}")
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'message': error_msg,
                        'original_message': str(message)[:200]  # Truncate to avoid huge error messages
                    }))
                except Exception as e:
                    error_msg = f"Message handling error: {e}"
                    logger.error(f"[{client_id}] {error_msg}", exc_info=True)
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'message': error_msg,
                        'error_type': type(e).__name__
                    }))
                    
        except websockets.exceptions.ConnectionClosed as e:
            logger.info(f"[{client_id}] Client connection closed: {e.code} - {e.reason or 'No reason provided'}")
        except Exception as e:
            logger.error(f"[{client_id}] WebSocket error: {e}", exc_info=True)
        finally:
            try:
                await self.unregister_client(websocket)
                logger.info(f"[{client_id}] Client unregistered")
            except Exception as e:
                logger.error(f"[{client_id}] Error during client unregistration: {e}", exc_info=True)
    
    def signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info("Received shutdown signal, cleaning up...")
        if self.chrome_process:
            self.chrome_process.terminate()
        sys.exit(0)
    
    async def start_server(self):
        """Start the WebSocket server"""
        # Set up signal handlers
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)

        self._terminate_process_on_port()
        
        logger.info(f"Starting automation server on port {self.port}")
        
        try:
            # Create a wrapper function that properly binds the instance
            async def handler(websocket, path=None):
                # Log the WebSocket connection attempt
                client_ip = websocket.remote_address[0] if hasattr(websocket, 'remote_address') and websocket.remote_address else 'unknown'
                client_id = f"{client_ip}-{id(websocket)}"
                logger.info(f"[{client_id}] New WebSocket connection from {client_ip} at path: {path}")
                
                try:
                    # Register the client
                    await self.register_client(websocket)
                    logger.info(f"[{client_id}] Client registered successfully")
                    
                    # Send a welcome message
                    await websocket.send(json.dumps({
                        'type': 'connection_established',
                        'message': 'Connected to automation server',
                        'client_id': client_id,
                        'timestamp': 12345  # This should be a real timestamp in a production environment
                    }))
                    
                    # Call the instance method with both parameters
                    await self.handle_message(websocket, path or '')
                    
                except Exception as e:
                    logger.error(f"[{client_id}] Error in WebSocket handler: {e}", exc_info=True)
                    try:
                        await websocket.close(1011, f"Server error: {str(e)[:125]}")
                    except:
                        pass  # Ignore errors during close
                
            # Listen on all interfaces (0.0.0.0) to accept connections from any IP
            server = await websockets.serve(
                handler,  # Use the wrapper function
                "0.0.0.0",  # Listen on all interfaces
                self.port,
                # Enable additional logging for debugging
                logger=logger,
                # Add ping/pong for connection health
                ping_interval=30,
                ping_timeout=10,
                close_timeout=5
            )
            logger.info(f"Automation server running on ws://0.0.0.0:{self.port} (accessible from any interface)")
            await server.wait_closed()
        except OSError as e:
            if "address already in use" in str(e).lower():
                logger.error(f"Port {self.port} is already in use. Please check for other running instances.")
            else:
                logger.error(f"An OS error occurred: {e}", exc_info=True)
            sys.exit(1)
        except Exception as e:
            logger.error(f"Server startup error: {e}")
            sys.exit(1)

def main():
    """Main entry point"""
    server = AutomationServer()
    
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()