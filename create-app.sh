#!/bin/bash

# Script to create a macOS .app bundle for the AI Code Tools Updater

APP_NAME="AI Code Updater.app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Creating macOS application bundle..."

# Remove old app if exists
if [ -d "$SCRIPT_DIR/$APP_NAME" ]; then
    rm -rf "$SCRIPT_DIR/$APP_NAME"
fi

# Also remove legacy app name
if [ -d "$SCRIPT_DIR/Augment Updater.app" ]; then
    rm -rf "$SCRIPT_DIR/Augment Updater.app"
fi

# Create .app directory structure
mkdir -p "$SCRIPT_DIR/$APP_NAME/Contents/MacOS"
mkdir -p "$SCRIPT_DIR/$APP_NAME/Contents/Resources"

# Create Info.plist
cat > "$SCRIPT_DIR/$APP_NAME/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>AICodeUpdater</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.aicode.updater</string>
    <key>CFBundleName</key>
    <string>AI Code Updater</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>2.0.0</string>
    <key>CFBundleVersion</key>
    <string>2.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.12</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# Create the main executable script
cat > "$SCRIPT_DIR/$APP_NAME/Contents/MacOS/AICodeUpdater" << 'MAINSCRIPT'
#!/bin/bash

# Get the project directory (parent of .app bundle)
PROJECT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
PARENT_DIR="$(dirname "$PROJECT_DIR")"

# Function to show notification
show_notification() {
    osascript -e "display notification \"$2\" with title \"$1\""
}

# Function to show dialog
show_dialog() {
    osascript -e "display dialog \"$2\" with title \"$1\" buttons {\"OK\"} default button \"OK\""
}

# Cleanup any stray empty files that cursor CLI might create
cleanup_stray_files() {
    # Remove empty 'augment-code' file if it exists in parent directory
    local stray_file="$PARENT_DIR/augment-code"
    if [ -f "$stray_file" ] && [ ! -s "$stray_file" ]; then
        rm -f "$stray_file" 2>/dev/null
    fi
}

# Change to project directory
cd "$PROJECT_DIR" || {
    show_dialog "Error" "Could not find project directory"
    exit 1
}

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    show_notification "AI Code Updater" "Installing dependencies..."
    npm install
fi

# Run cleanup before starting
cleanup_stray_files

# Run the updater in a new Terminal window with proper key handling
osascript <<EOF
tell application "Terminal"
    activate
    do script "cd '$PROJECT_DIR' && clear && echo '🚀 AI Code Tools Updater' && echo '================================' && echo '' && npm start; echo ''; echo 'Press ENTER to close this window...'; read; exit"
end tell
EOF

# Run cleanup after completion (with small delay to let script start)
sleep 2
cleanup_stray_files

MAINSCRIPT

# Make the executable script executable
chmod +x "$SCRIPT_DIR/$APP_NAME/Contents/MacOS/AICodeUpdater"

# Create a simple icon using AppleScript (creates a basic icon)
cat > "$SCRIPT_DIR/$APP_NAME/Contents/Resources/AppIcon.icns" << 'EOF'
EOF

echo ""
echo "✅ Application created successfully!"
echo ""
echo "📱 Location: $SCRIPT_DIR/$APP_NAME"
echo ""
echo "To use:"
echo "  1. Double-click 'AI Code Updater.app' to run the updater"
echo "  2. (Optional) Drag it to your Applications folder or Dock"
echo "  3. (Optional) Create a keyboard shortcut in System Preferences"
echo ""
echo "The app will:"
echo "  - Check and update Augment VS Code extension"
echo "  - Check and update Claude Code CLI"
echo "  - Check and update Gemini CLI"
echo ""

