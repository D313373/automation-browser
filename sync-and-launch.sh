#!/bin/bash

# Simple Git Sync & Launch Script
# Does exactly what you need: sync with GitHub and start the automation browser

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Automation Browser - Sync & Launch${NC}"
echo ""

# Git sync (if in git repo)  
echo -e "${BLUE}📥 Syncing with GitHub...${NC}"

# Check if we're in a git repo by looking for .git directory
if [ -d ".git" ]; then
    echo -e "   ${GREEN}✅ Git repository detected${NC}"
    
    # Fetch latest changes from remote
    git fetch origin >/dev/null 2>&1
    
    # Check if we're behind the remote
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master 2>/dev/null)
    
    if [ "$LOCAL" = "$REMOTE" ]; then
        echo -e "   ${GREEN}✅ Already up to date${NC}"
    else
        echo -e "   ${BLUE}📥 Pulling latest updates...${NC}"
        git pull origin main >/dev/null 2>&1 || git pull origin master >/dev/null 2>&1
        echo -e "   ${GREEN}✅ Updates pulled successfully${NC}"
    fi
else
    # Try to initialize git repo if automation-browser folder exists and we have files
    if [ -f "package.json" ] && [ -f "src/main.js" ]; then
        echo -e "   ${YELLOW}📁 No .git directory found - would you like to set up Git?${NC}"
        echo -e "   ${BLUE}💡 Run: git init && git remote add origin <your-repo-url>${NC}"
    else
        echo -e "   ${YELLOW}📁 Not in automation-browser directory or files missing${NC}"
    fi
fi

echo ""
echo -e "${BLUE}🖥️ Starting automation browser...${NC}"

# Launch the automation browser
npm start