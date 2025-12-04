#!/bin/sh
# Start Xvfb in the background for headless LibreOffice operation
# Start Xvfb on display :99 (will fail silently if already running, which is fine)
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
sleep 1  # Give Xvfb a moment to start
echo "Xvfb ready on display :99"

