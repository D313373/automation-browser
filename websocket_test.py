#!/usr/bin/env python3
"""
Enhanced WebSocket test client with detailed logging
"""
import asyncio
import websockets
import json
import logging
import sys
import time
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger('websocket_test')
logging.getLogger('websockets').setLevel(logging.DEBUG)

class WebSocketTestClient:
    def __init__(self, uri: str = "ws://localhost:8889"):
        self.uri = uri
        self.websocket = None
        self.client_id = None

    async def connect(self) -> bool:
        """Establish WebSocket connection"""
        try:
            logger.info(f"Connecting to WebSocket server at {self.uri}...")
            self.websocket = await websockets.connect(
                self.uri,
                ping_interval=30,
                ping_timeout=10,
                close_timeout=5,
                open_timeout=10,
                max_size=10 * 1024 * 1024,  # 10MB max message size
                logger=logger
            )
            logger.info("WebSocket connection established")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect: {e}", exc_info=True)
            return False

    async def send_message(self, message: Dict[str, Any]) -> bool:
        """Send a JSON message to the server"""
        if not self.websocket:
            logger.error("Not connected to server")
            return False
            
        try:
            message_str = json.dumps(message)
            logger.debug(f"Sending message: {message_str}")
            await self.websocket.send(message_str)
            return True
            
        except Exception as e:
            logger.error(f"Failed to send message: {e}", exc_info=True)
            return False

    async def receive_message(self, timeout: float = 5.0) -> Optional[Dict[str, Any]]:
        """Receive and parse a message from the server"""
        if not self.websocket:
            logger.error("Not connected to server")
            return None
            
        try:
            message = await asyncio.wait_for(self.websocket.recv(), timeout=timeout)
            logger.debug(f"Received raw message: {message}")
            
            try:
                data = json.loads(message)
                logger.info(f"Received message: {json.dumps(data, indent=2)}")
                return data
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to decode message: {e}")
                return None
                
        except asyncio.TimeoutError:
            logger.warning("Timed out waiting for message")
            return None
        except Exception as e:
            logger.error(f"Error receiving message: {e}", exc_info=True)
            return None

    async def close(self) -> None:
        """Close the WebSocket connection"""
        if self.websocket:
            try:
                await self.websocket.close()
                logger.info("WebSocket connection closed")
            except Exception as e:
                logger.error(f"Error closing connection: {e}", exc_info=True)
            finally:
                self.websocket = None

    async def run_test(self) -> bool:
        """Run the WebSocket test"""
        try:
            # Connect to the server
            if not await self.connect():
                return False

            # Wait for connection_established message
            welcome = await self.receive_message()
            if not welcome or welcome.get('type') != 'connection_established':
                logger.error("Did not receive connection_established message")
                return False

            self.client_id = welcome.get('client_id')
            logger.info(f"Connected with client ID: {self.client_id}")

            # Send a ping message
            ping_msg = {
                'type': 'ping',
                'timestamp': int(time.time()),
                'client_id': self.client_id
            }
            
            if not await self.send_message(ping_msg):
                return False

            # Wait for pong response
            pong = await self.receive_message()
            if not pong or pong.get('type') != 'pong':
                logger.error("Did not receive pong response")
                return False

            logger.info("Ping-pong successful!")
            return True

        except Exception as e:
            logger.error(f"Test failed: {e}", exc_info=True)
            return False

        finally:
            await self.close()

async def main():
    """Main test function"""
    logger.info("Starting WebSocket test...")
    
    # Create and run the test client
    client = WebSocketTestClient()
    success = await client.run_test()
    
    if success:
        logger.info("WebSocket test completed successfully!")
        return 0
    else:
        logger.error("WebSocket test failed")
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
