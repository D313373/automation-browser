#!/usr/bin/env python3
"""
Test WebSocket connection to the automation server
"""
import asyncio
import websockets
import json
import logging
import sys
import time

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Set websockets logger to DEBUG
logging.getLogger('websockets').setLevel(logging.DEBUG)

async def test_connection():
    uri = "ws://localhost:8889"
    logger.info(f"Connecting to WebSocket server at {uri}...")
    
    try:
        # Add connection timeout and more detailed connection options
        async with websockets.connect(
            uri,
            ping_interval=30,
            ping_timeout=10,
            close_timeout=5,
            open_timeout=10,
            max_size=10 * 1024 * 1024,  # 10MB max message size
            logger=logger
        ) as websocket:
            logger.info("Connected to WebSocket server")
            
            # Process incoming messages
            async for message in websocket:
                try:
                    data = json.loads(message)
                    logger.info(f"Received message: {data}")
                    
                    if data.get('type') == 'connection_established':
                        logger.info("Connection established with server")
                        # Now that we're connected, send a ping
                        ping_msg = {
                            'type': 'ping',
                            'timestamp': 12345
                        }
                        logger.info(f"Sending ping: {ping_msg}")
                        await websocket.send(json.dumps(ping_msg))
                        
                    elif data.get('type') == 'pong':
                        logger.info("Received pong from server")
                        if data.get('timestamp') == 12345:
                            logger.info("Ping-pong successful!")
                            return True
                        else:
                            logger.error(f"Unexpected timestamp in pong: {data}")
                            return False
                            
                except json.JSONDecodeError:
                    logger.error(f"Failed to decode message: {message}")
                    return False
                    
            # If we get here, the connection was closed
            logger.error("Connection closed by server")
            return False
            
    except Exception as e:
        logger.error(f"WebSocket connection failed: {e}", exc_info=True)
        return False

def main():
    logger.info("Starting WebSocket client test...")
    loop = asyncio.get_event_loop()
    success = loop.run_until_complete(test_connection())
    loop.close()
    
    if success:
        logger.info("WebSocket test completed successfully!")
        return 0
    else:
        logger.error("WebSocket test failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
