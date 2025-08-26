#!/usr/bin/env python3
"""
Test Script for ScriptExecutor
Demonstrates how to use the ScriptExecutor to run recorded automation scripts.
"""

import json
import logging
from script_executor import ScriptExecutor, execute_script

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_sample_script():
    """Create a sample recorded script for testing."""
    return {
        "name": "Sample Google Search",
        "description": "A simple test script that searches on Google",
        "actions": [
            {
                "type": "navigate",
                "url": "https://www.google.com",
                "timeout": 30,
                "description": "Navigate to Google"
            },
            {
                "type": "input",
                "locators": [
                    ["name", "q"],
                    ["css", "input[title='Search']"]
                ],
                "text": "undetected-chromedriver",
                "clear_first": True,
                "description": "Enter search query"
            },
            {
                "type": "click",
                "locators": [
                    ["name", "btnK"],
                    ["css", "input[value='Google Search']"]
                ],
                "description": "Click search button"
            },
            {
                "type": "wait",
                "time": 3,
                "description": "Wait for search results"
            }
        ]
    }

def test_execute_script():
    """Test executing a script using the helper function."""
    script = create_sample_script()
    
    print("=== Starting Script Execution ===")
    print(f"Script: {script['name']}")
    print(f"Description: {script['description']}")
    print(f"Number of actions: {len(script['actions'])}")
    
    # Execute the script using the helper function
    results = execute_script(
        script_data=script,
        headless=False,  # Set to True for headless mode
        chrome_options=None  # Can pass custom Chrome options here
    )
    
    print("\n=== Execution Results ===")
    print(f"Success: {results['success']}")
    print(f"Executed {results['executed_actions']} of {results['total_actions']} actions")
    
    if results['errors']:
        print("\nErrors:")
        for error in results['errors']:
            if isinstance(error, dict):
                print(f"- {error.get('error', 'Unknown error')}")
                if 'action' in error:
                    print(f"  Action: {error['action'].get('description', 'No description')}")
            else:
                print(f"- {error}")
    
    print("\n=== Test Complete ===")

def test_script_executor_class():
    """Test the ScriptExecutor class directly with more control."""
    script = create_sample_script()
    
    # Create a ScriptExecutor instance
    with ScriptExecutor() as executor:
        try:
            # Start the WebDriver
            print("Starting WebDriver...")
            driver = executor.start_driver(headless=False)
            
            # Execute the script
            print("Executing script...")
            results = executor.execute_script(script)
            
            # Print results
            print("\n=== Execution Results ===")
            print(f"Success: {results['success']}")
            print(f"Executed {results['executed_actions']} of {results['total_actions']} actions")
            
            if results['errors']:
                print("\nErrors:")
                for error in results['errors']:
                    print(f"- {error.get('error', 'Unknown error')}")
        
        except Exception as e:
            print(f"An error occurred: {str(e)}")
        
        # The WebDriver will be automatically closed by the context manager

if __name__ == "__main__":
    print("1. Test using execute_script helper function")
    print("2. Test using ScriptExecutor class directly")
    choice = input("Choose test mode (1 or 2): ")
    
    if choice == "1":
        test_execute_script()
    elif choice == "2":
        test_script_executor_class()
    else:
        print("Invalid choice. Please run again and enter 1 or 2.")
