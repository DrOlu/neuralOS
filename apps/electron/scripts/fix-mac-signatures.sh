#!/bin/bash

# Application bundle name
APP_NAME="GyShell.app"

# Re-sign helper for prepackaged app bundles
process_app() {
    local APP_PATH=$1
    if [ -d "$APP_PATH" ]; then
        echo "Processing $APP_PATH ..."
        
        echo "1. Removing existing signatures..."
        codesign --remove-signature "$APP_PATH"
        
        echo "2. Clearing extended attributes..."
        xattr -cr "$APP_PATH"
        
        echo "3. Applying clean Ad-hoc signature..."
        codesign --force --deep -s - "$APP_PATH"
        
        echo "Done processing $APP_PATH"
    else
        echo "Warning: $APP_PATH not found, skipping."
    fi
}

# Process Intel (x64) build output
process_app "dist/mac/$APP_NAME"

# Process Apple Silicon (arm64) build output
process_app "dist/mac-arm64/$APP_NAME"
