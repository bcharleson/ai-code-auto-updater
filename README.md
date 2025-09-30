# Augment Extension Monitor

Automated monitoring and updating system for the Augment VS Code extension in **Cursor** and **VS Code**.

## 🆕 Multi-IDE Support

This script now supports both **Cursor** and **VS Code**! It will automatically:
- Detect which IDEs you have installed
- Check for the Augment extension in all available IDEs
- Install updates in your preferred IDE (or all IDEs if configured)
- Work seamlessly whether you use Cursor, VS Code, or both

## Features

- 🔍 **Automatic Version Detection** - Monitors VS Code Marketplace for new releases
- 👤 **Human-in-the-Loop** - Always prompts for user approval before updating
- 📦 **Automated Download** - Downloads VSIX files from marketplace with retry logic
- ⚡ **Multi-IDE Support** - Works with Cursor and VS Code automatically
- 🔧 **Smart Detection** - Automatically finds your installed IDEs and latest versions
- 📦 **Flexible Installation** - Install in one IDE or all available IDEs
- ✅ **Robust Verification** - Multiple retry attempts with intelligent version matching
- 🧹 **Auto Cleanup** - Removes temporary VSIX files after installation
- 📅 **Cron Scheduling** - Runs automatically in background
- 🛡️ **Error Recovery** - Graceful failure handling with actionable user guidance
- 🔄 **Retry Mechanisms** - Automatic retries for downloads and verification
- 📊 **Comprehensive Testing** - Full test suite for error handling and edge cases

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### Setting Up on Another Computer

If you want to run this on another Mac (like a Mac mini):

```bash
# Clone the repository
git clone https://github.com/bcharleson/augment-code-auto-updater.git
cd augment-code-auto-updater

# Install dependencies
npm install

# Test the setup
npm test

# Set up automatic updates
npm run install-cron
```

**Requirements on the new computer:**
- Node.js (version 14 or higher)
- Cursor or VS Code with CLI available (or both!)
- Git (for cloning)

### 2. Test IDE Detection (New!)
```bash
# Test which IDEs are detected on your system
npm run test-ide
```

This will show you which IDEs (Cursor/VS Code) are available and if the Augment extension is installed in any of them.

### 3. Quick Test (Recommended First Step!)
```bash
# Test the script without making any changes (dry run)
npm test
```

This will:
- Check your current Augment extension version
- Fetch the latest version from the marketplace
- Show you if an update is available
- Simulate the entire update process without actually making changes

**Example Output:**
```
[2025-07-24T17:56:45.704Z] INFO: Starting Augment extension update check...
[2025-07-24T17:56:45.902Z] INFO: Current version: 0.511.0
[2025-07-24T17:56:46.093Z] INFO: Latest version: 0.513.0

🚀 Augment Extension Update Available!
──────────────────────────────────────────────────
Current version: 0.511.0
Latest version:  0.513.0
──────────────────────────────────────────────────

Would you like to download and install this update? (y/N): y
[2025-07-24T17:56:54.717Z] SUCCESS: User approved update
[2025-07-24T17:56:54.718Z] WARNING: DRY RUN: Would download VSIX file
[2025-07-24T17:56:54.718Z] WARNING: DRY RUN: Would install extension
[2025-07-24T17:56:54.718Z] WARNING: DRY RUN: Would verify installation

✅ Update completed successfully!
```

### 3. Run the Actual Update
```bash
# Check for updates and install if approved
npm start
```

## Available Commands

Here are the main commands you can use:

| Command | What it does |
|---------|-------------|
| `npm run test-ide` | Test which IDEs are detected and if Augment is installed |
| `npm run test-error-handling` | Run comprehensive error handling tests |
| `npm run test-all` | Run all test suites (error handling, IDE detection, compatibility) |
| `npm test` | Test the script without making changes (safe to run) |
| `npm start` | Run the actual update process |
| `npm run install-cron` | Install automatic updates on macOS/Linux |
| `npm run install-task` | Install automatic updates on Windows |
| `npm run uninstall-task` | Remove automatic updates on Windows |

**For most users**: Start with `npm test` to see if updates are available, then use `npm start` to actually install them.

## Managing Automatic Updates

### Stopping the Cron Job
If you want to stop automatic updates:

```bash
# Stop installation while it's running
Ctrl+C

# Remove the cron job after installation
crontab -l | grep -v "augment-code-auto-updater" | crontab -

# Or edit cron jobs manually
crontab -e
```

### What Happens When You Restart Your Computer?
✅ **Good news!** Cron jobs are **persistent** and will continue working after restart:

- The cron job remains installed and active
- It will continue checking for updates every 6 hours
- All settings and schedules are preserved
- The script will run automatically in the background

### Temporarily Disable (Instead of Removing)
```bash
# Edit cron jobs
crontab -e

# Add # at the beginning of the line to comment it out:
# 0 */6 * * * /path/to/augment-code-auto-updater/index.js

# To re-enable, just remove the #
```

### Verify It's Still Working
```bash
# Check if cron job is still there
crontab -l

# Check recent logs
tail -f logs/cron.log

# Test manually to make sure everything works
npm test
```

### 3. Setup Automated Monitoring

#### Linux/macOS (Cron)
```bash
# Install cron job (runs every 6 hours)
chmod +x install-cron.sh
./install-cron.sh
```

#### Windows (Scheduled Task)
```powershell
# Test the installation (WhatIf mode - no changes made)
npm run test-task

# Install Windows scheduled task (automatically requests UAC elevation)
npm run install-task

# Alternative schedules:
npm run install-task-work    # Daily during work days at 9 AM
npm run install-task-daily   # Daily at 9 AM

# Check task status
npm run task-status

# Uninstall task (automatically requests UAC elevation)
npm run uninstall-task
```

**Note:** The Windows scripts will automatically prompt for Administrator privileges via UAC when needed. Simply click "Yes" when prompted.

## Usage

### Manual Usage
```bash
# Check for updates and prompt for installation
node index.js

# Dry run (test without making changes)
node index.js --dry-run
```

### Automated Usage
The cron job will automatically:
1. Check for new Augment extension versions every 6 hours
2. Compare with your currently installed version
3. If newer version found, prompt you via CLI
4. Upon approval: download → install → verify → cleanup

## User Interaction Flow

When a new version is detected:

```
🚀 Augment Extension Update Available!
──────────────────────────────────────────────────
Current version: 0.511.0
Latest version:  0.512.0
──────────────────────────────────────────────────

Would you like to download and install this update? (y/N):
```

If you choose **Yes**:
1. ⬬ Downloads VSIX file (e.g., `augment.vscode-augment-0.512.0.vsix`)
2. 🔧 Installs via `cursor --install-extension`
3. ✅ Verifies installation by checking version
4. 🗑️ Deletes temporary VSIX file
5. 🎉 Shows success confirmation

## Configuration

Edit `config.json` to customize behavior:

```json
{
  "checkInterval": "0 */6 * * *",  // Every 6 hours
  "autoDownload": false,           // Always prompt first
  "logLevel": "info",
  "maxRetries": 3
}
```

### Available Schedules
- `"0 */6 * * *"` - Every 6 hours (default)
- `"0 9-17/2 * * 1-5"` - Every 2 hours during work days
- `"0 9 * * *"` - Daily at 9 AM
- `"0 */3 * * *"` - Every 3 hours

## Logs

View monitoring activity:
```bash
# View recent activity
tail -f logs/cron.log

# View all logs
cat logs/cron.log
```

## Troubleshooting

### Check Current Cron Jobs
```bash
crontab -l
```

### Remove Cron Job
```bash
crontab -l | grep -v '/path/to/augment-code-auto-updater/index.js' | crontab -
```

### Manual Installation Test
```bash
# Check if Cursor CLI works
cursor --list-extensions --show-versions

# Test marketplace API
curl -X POST https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery
```

### Common Issues

1. **"command not found: cursor"**
   - Ensure Cursor is installed and CLI is available in PATH

2. **"Extension not found"**
   - Check if Augment extension is installed in Cursor
   - Run: `cursor --list-extensions`

3. **"Download failed"**
   - The script will automatically retry 3 times with exponential backoff
   - Check internet connection
   - Verify VS Code Marketplace is accessible
   - If all retries fail, the VSIX file location will be provided for manual download

4. **"Installation failed"**
   - Ensure Cursor is not running during installation
   - Check file permissions in temp directory

5. **"Version verification failed"**
   - The script now retries verification 3 times with increasing delays
   - If verification fails, the VSIX file is kept for manual installation
   - Try restarting your IDE and checking if the extension is working
   - Use the provided manual installation command if needed

6. **"Multiple versions detected"**
   - The script automatically selects the latest version
   - Old extension folders can be safely removed manually if desired

5. **"Verification failed" but installation succeeded**
   - The script will keep the VSIX file for manual verification
   - Restart your IDE and check if the extension is working
   - The script provides step-by-step recovery instructions
   - Multiple versions may exist - the script automatically uses the latest

6. **Version mismatch errors**
   - The script now handles version suffixes (like "-universal") automatically
   - Multiple verification attempts with increasing delays
   - If verification fails, follow the on-screen instructions to restart your IDE

### Windows-Specific Issues

1. **"Execution Policy" errors**
   - Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
   - Or use the npm scripts which bypass execution policy

2. **"Access Denied" when creating scheduled task**
   - Run PowerShell as Administrator
   - Use: `npm run install-task` (requires admin PowerShell)

3. **Task not running automatically**
   - Check task status: `npm run task-status`
   - Verify task settings: `Get-ScheduledTask -TaskName "AugmentMonitor" | Get-ScheduledTaskInfo`
   - Check Windows Event Viewer for task scheduler errors

## File Structure

```
augment-code-auto-updater/
├── index.js              # Main monitoring script
├── package.json           # Dependencies and scripts
├── config.json           # Configuration settings
├── install-cron.sh       # Cron job setup script
├── temp/                 # Temporary VSIX downloads (auto-created)
├── logs/                 # Log files (auto-created)
└── README.md             # This file
```

## Security Notes

- Script only downloads from official VS Code Marketplace
- Always prompts before making changes
- Temporary files are cleaned up immediately after use
- No sensitive data is stored or transmitted

## Customization

The script can be easily modified to monitor other extensions by changing:
- `extensionId` in the constructor
- `publisherId` and `extensionName` for download URLs

## Support

For issues or questions:
1. Check the logs: `tail -f logs/cron.log`
2. Test manually: `npm test`
3. Verify Cursor CLI: `cursor --help` 