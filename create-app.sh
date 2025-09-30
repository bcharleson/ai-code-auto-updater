#!/bin/bash

# Script to create a macOS .app bundle for the Augment updater

APP_NAME="Augment Updater.app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Creating macOS application bundle..."

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
    <string>AugmentUpdater</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.augment.updater</string>
    <key>CFBundleName</key>
    <string>Augment Updater</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.12</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# Create the main executable script
cat > "$SCRIPT_DIR/$APP_NAME/Contents/MacOS/AugmentUpdater" << 'MAINSCRIPT'
#!/bin/bash

# Get the project directory (parent of .app bundle)
PROJECT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"

# Function to show notification
show_notification() {
    osascript -e "display notification \"$2\" with title \"$1\""
}

# Function to show dialog
show_dialog() {
    osascript -e "display dialog \"$2\" with title \"$1\" buttons {\"OK\"} default button \"OK\""
}

# Change to project directory
cd "$PROJECT_DIR" || {
    show_dialog "Error" "Could not find project directory"
    exit 1
}

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    show_notification "Augment Updater" "Installing dependencies..."
    npm install
fi

# Run the updater in a new Terminal window with better visibility
osascript <<EOF
tell application "Terminal"
    activate
    set newTab to do script "cd '$PROJECT_DIR' && clear && echo '🚀 Augment Extension Updater' && echo '================================' && echo '' && npm start; echo ''; echo 'Press any key to close...'; read -n 1; exit"
end tell
EOF

MAINSCRIPT

# Make the executable script executable
chmod +x "$SCRIPT_DIR/$APP_NAME/Contents/MacOS/AugmentUpdater"

# Create a simple icon using AppleScript (creates a basic icon)
cat > "$SCRIPT_DIR/$APP_NAME/Contents/Resources/AppIcon.icns" << 'EOF'
EOF

echo ""
echo "✅ Application created successfully!"
echo ""
echo "📱 Location: $SCRIPT_DIR/$APP_NAME"
echo ""
echo "To use:"
echo "  1. Double-click 'Augment Updater.app' to run the updater"
echo "  2. (Optional) Drag it to your Applications folder or Dock"
echo "  3. (Optional) Create a keyboard shortcut in System Preferences"
echo ""

