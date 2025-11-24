#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');

console.log(chalk.blue('🔍 Testing Multi-IDE Detection...\n'));

// Test IDE detection
const supportedIDEs = {
  cursor: {
    name: 'Cursor',
    command: 'cursor',
    envVar: 'CURSOR_PATH'
  },
  vscode: {
    name: 'VS Code',
    command: 'code',
    envVar: 'VSCODE_PATH',
    macPath: '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
  },
  antigravity: {
    name: 'Antigravity',
    command: 'antigravity',
    envVar: 'ANTIGRAVITY_PATH',
    macPath: `${process.env.HOME}/.antigravity/antigravity/bin/antigravity`
  }
};

let detectedCount = 0;

for (const [ide, config] of Object.entries(supportedIDEs)) {
  try {
    let command = process.env[config.envVar] || config.command;
    let version;

    try {
      version = execSync(`${command} --version`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000
      }).trim();
    } catch (e) {
      // Try fallback path
      if (process.platform === 'darwin' && config.macPath && fs.existsSync(config.macPath)) {
        command = `"${config.macPath}"`;
        version = execSync(`${command} --version`, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 5000
        }).trim();
        console.log(chalk.green(`✓ ${config.name} detected at fallback path`));
      } else {
        throw e;
      }
    }

    console.log(chalk.green(`✓ ${config.name} detected:`));
    console.log(`  Command: ${command}`);
    console.log(`  Version: ${version}`);
    console.log(`  Environment: ${process.env[config.envVar] ? 'Custom path' : 'System PATH'}\n`);
    detectedCount++;

  } catch (error) {
    console.log(chalk.yellow(`✗ ${config.name} not available`));
    console.log(`  Error: ${error.message}\n`);
  }
}

if (detectedCount === 0) {
  console.log(chalk.red('❌ No supported IDEs found!'));
  console.log(chalk.yellow('Please install Cursor or VS Code.'));
} else {
  console.log(chalk.green(`✅ Found ${detectedCount} IDE(s) ready for use!`));
}

// Test extension listing
console.log(chalk.blue('\n🔍 Testing Extension Detection...\n'));

for (const [ide, config] of Object.entries(supportedIDEs)) {
  try {
    let command = process.env[config.envVar] || config.command;
    const listCommand = ide === 'cursor' ? '--list-extensions --show-versions' : '--list-extensions';

    let output;
    try {
      output = execSync(`${command} ${listCommand}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 10000
      });
    } catch (e) {
      if (process.platform === 'darwin' && config.macPath && fs.existsSync(config.macPath)) {
        command = `"${config.macPath}"`;
        output = execSync(`${command} ${listCommand}`, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 10000
        });
      } else {
        throw e;
      }
    }

    if (output.includes('augment.vscode-augment')) {
      console.log(chalk.green(`✓ Augment extension found in ${config.name}`));

      if (ide === 'cursor') {
        const match = output.match(/augment\.vscode-augment@(\d+\.\d+\.\d+)/);
        if (match) {
          console.log(`  Version: ${match[1]}`);
        }
      } else {
        console.log(`  Status: Installed (version check not available)`);
      }
    } else {
      console.log(chalk.yellow(`- Augment extension not found in ${config.name}`));
    }
    console.log('');

  } catch (error) {
    console.log(chalk.red(`✗ Failed to check ${config.name}: ${error.message}\n`));
  }
}
