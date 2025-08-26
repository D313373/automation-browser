#!/bin/bash

# Activate virtual environment and install Python dependencies
cd python-server
source venv/bin/activate
pip install -r requirements.txt
cd ..

# Start the Electron app
npm start
