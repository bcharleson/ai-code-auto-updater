# AI Code Tools Updater

A unified updater for AI coding tools - manage updates for **Augment**, **Claude Code**, and **Gemini CLI** from one place.

## Supported Tools

| Tool | Type | Package/Extension |
|------|------|-------------------|
| **Augment** | VS Code Extension | `augment.vscode-augment` |
| **Claude Code** | npm CLI | `@anthropic-ai/claude-code` |
| **Gemini CLI** | npm CLI | `@google/gemini-cli` |

## Quick Start

```bash
# Install dependencies
npm install

# Run the updater
npm start

# Or dry-run (no changes made)
npm test
```

## Global Installation

Install globally to run from anywhere:

```bash
# Install globally
npm install -g .

# Now run from any directory
ai-code-updater
# or shorthand
acu
```

## Interactive Menu

```
🚀 AI Code Tools Updater
════════════════════════════════════════════════════════════
Manage updates for your AI coding tools

  1)  Check & Update Augment Extension (VS Code/Cursor)
  2)  Check & Update Claude Code CLI
  3)  Check & Update Gemini CLI
  4)  Check & Update ALL tools
  5)  Show status of all tools
  q)  Quit
```

## macOS App

Double-click the app to launch the updater:

```bash
# Create/recreate the app
npm run create-app

# The app is at: ./AI Code Updater.app
```

## Automated Updates

### macOS/Linux (Cron)
```bash
npm run install-cron
```

### Windows (Scheduled Task)
```bash
npm run install-task
```

## Project Structure

```
ai-code-updater/
├── index.js                    # Main entry point
├── src/
│   ├── managers/
│   │   ├── ide-manager.js      # VS Code/Cursor extension management
│   │   └── cli-manager.js      # npm CLI tool management
│   └── utils/
│       ├── logger.js           # Logging utilities
│       └── notifications.js    # macOS notification support
├── AI Code Updater.app/        # macOS app bundle
├── create-app.sh               # Script to create macOS app
├── install-cron.sh             # Cron setup for macOS/Linux
├── config.json                 # Configuration
└── package.json
```

## Requirements

- **Node.js** 14+
- **npm** for CLI tools
- **Cursor** or **VS Code** for Augment extension

## License

MIT
