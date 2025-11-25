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

# Generate app icon
echo "Generating app icon..."

# Try to generate icon with Python/Pillow
if python3 -c "from PIL import Image" 2>/dev/null; then
    python3 << 'ICONSCRIPT'
from PIL import Image, ImageDraw, ImageFont
import os

iconset_dir = "/tmp/AICodeUpdater.iconset"
os.makedirs(iconset_dir, exist_ok=True)

def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    for i in range(size):
        r = int(40 + (i / size) * 60)
        g = int(80 + (i / size) * 40)
        b = int(180 + (i / size) * 50)
        draw.rectangle([0, i, size, i+1], fill=(r, g, b, 255))
    
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = max(size // 5, 3)
    mask_draw.rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=255)
    
    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(img, mask=mask)
    draw = ImageDraw.Draw(result)
    
    center = size // 2
    if size >= 64:
        bracket_color = (255, 255, 255, 200)
        text_color = (255, 255, 255, 255)
        font_size = max(size // 3, 12)
        try:
            font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', font_size)
        except:
            font = ImageFont.load_default()
        
        bracket_offset = size // 4
        draw.text((center - bracket_offset - font_size//3, center - font_size//2), "<", fill=bracket_color, font=font)
        draw.text((center + bracket_offset - font_size//4, center - font_size//2), "/>", fill=bracket_color, font=font)
        
        ai_font_size = max(size // 4, 10)
        try:
            ai_font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', ai_font_size)
        except:
            ai_font = font
        bbox = draw.textbbox((0, 0), "AI", font=ai_font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        draw.text((center - text_width//2, center - text_height//2 - ai_font_size//4), "AI", fill=text_color, font=ai_font)
        
        arrow_y = center + size // 4
        arrow_size = max(size // 10, 4)
        draw.polygon([(center, arrow_y - arrow_size), (center - arrow_size, arrow_y), (center + arrow_size, arrow_y)], fill=(100, 255, 150, 255))
    return result

sizes = [16, 32, 64, 128, 256, 512, 1024]
for size in sizes:
    icon = create_icon(size)
    icon.save(f"{iconset_dir}/icon_{size}x{size}.png")
    if size <= 512:
        icon_2x = create_icon(size * 2)
        icon_2x.save(f"{iconset_dir}/icon_{size}x{size}@2x.png")
print("Icon images created")
ICONSCRIPT

    # Convert to icns
    iconutil -c icns /tmp/AICodeUpdater.iconset -o "$SCRIPT_DIR/$APP_NAME/Contents/Resources/AppIcon.icns" 2>/dev/null
    rm -rf /tmp/AICodeUpdater.iconset
    echo "✓ App icon generated"
else
    echo "⚠ Pillow not installed, using placeholder icon"
    echo "  Install with: pip3 install Pillow"
    touch "$SCRIPT_DIR/$APP_NAME/Contents/Resources/AppIcon.icns"
fi

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
echo "Supported tools:"
echo "  - Augment VS Code extension"
echo "  - Claude Code CLI"
echo "  - Gemini CLI"
echo "  - OpenAI Codex CLI"
echo ""

