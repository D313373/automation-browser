import asyncio
import websockets
import json
import logging
import sys
import time

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger('websocket_test')

async def test_connection():
    uri = "ws://localhost:8889"
    logger.info(f"Connecting to WebSocket server at {uri}...")
    
    try:
        async with websockets.connect(
            uri,
            ping_interval=30,
            ping_timeout=10,
            close_timeout=5,
            open_timeout=10,
            max_size=10 * 1024 * 1024,
            logger=logger
        ) as websocket:
            logger.info("Connected to WebSocket server")
            
            # Wait for connection_established message
            welcome_msg = await asyncio.wait_for(websocket.recv(), timeout=5)
            welcome_data = json.loads(welcome_msg)
            logger.info(f"Server welcome: {welcome_data}")
            
            if welcome_data.get('type') != 'connection_established':
                logger.error("Did not receive connection_established message")
                return False
                
            # Send ping message
            ping_msg = {
                'type': 'ping',
                'timestamp': int(time.time())
            }
            logger.info(f"Sending ping: {ping_msg}")
            await websocket.send(json.dumps(ping_msg))
            
            # Wait for pong response with a longer timeout
            try:
                while True:
                    response = await asyncio.wait_for(websocket.recv(), timeout=10)
                    response_data = json.loads(response)
                    logger.info(f"Received message: {response_data}")
                    
                    if response_data.get('type') == 'pong':
                        logger.info("Ping-pong successful!")
                        return True
                    elif response_data.get('type') == 'connection_established':
                        # Ignore duplicate connection_established messages
                        continue
                    else:
                        logger.error(f"Unexpected message type: {response_data.get('type')}")
                        return False
            except asyncio.TimeoutError:
                logger.error("Timed out waiting for pong response")
                return False
                
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        return False

async def main():
    success = await test_connection()
    if success:
        logger.info("Test completed successfully")
        return 0
    else:
        logger.error("Test failed")
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))