#!/usr/bin/env node

const { execSync } = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const semver = require('semver');
const chalk = require('chalk');

class IDEManager {
  constructor() {
    this.supportedIDEs = {
      cursor: {
        name: 'Cursor',
        commands: {
          listExtensions: '--list-extensions --show-versions',
          installExtension: '--install-extension',
          version: '--version'
        },
        envVar: 'CURSOR_PATH',
        priority: 1
      },
      vscode: {
        name: 'VS Code',
        commands: {
          listExtensions: '--list-extensions',
          installExtension: '--install-extension',
          version: '--version'
        },
        envVar: 'VSCODE_PATH',
        priority: 2
      },
      antigravity: {
        name: 'Antigravity',
        commands: {
          listExtensions: '--list-extensions --show-versions',
          installExtension: '--install-extension',
          version: '--version'
        },
        envVar: 'ANTIGRAVITY_PATH',
        priority: 3,
        macPath: '/Applications/Antigravity.app/Contents/Resources/app/bin/antigravity' // Hypothetical path, need to verify or make dynamic if possible
      }
    };

    // Standard macOS paths
    this.macPaths = {
      cursor: '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
      vscode: '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
      antigravity: `${process.env.HOME}/.antigravity/antigravity/bin/antigravity` // Based on previous `which` output
    };

    this.detectedIDEs = [];
    this.currentIDE = null;
  }

  detectAvailableIDEs() {
    this.log('Detecting available IDEs...');
    const available = [];

    for (const [ide, config] of Object.entries(this.supportedIDEs)) {
      try {
        let command = process.env[config.envVar] || ide;

        // Try multiple detection methods for better cross-device compatibility
        let detected = false;

        // Method 1: Try CLI command with timeout
        try {
          execSync(`${command} ${config.commands.version}`, {
            stdio: 'ignore',
            timeout: 10000,
            env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
          });
          detected = true;
        } catch (cliError) {
          // Try to find binary at standard path
          if (process.platform === 'darwin' && this.macPaths[ide]) {
            if (fs.existsSync(this.macPaths[ide])) {
              command = `"${this.macPaths[ide]}"`;
              detected = true;
              this.log(`✓ ${config.name} detected at ${this.macPaths[ide]}`, 'success');
            }
          }

          if (!detected) {
            this.log(`CLI detection failed for ${config.name}, trying folder detection...`, 'warning');
          }
        }

        // Method 2: Check for extension folders (fallback)
        if (!detected) {
          const homeDir = process.env.HOME || process.env.USERPROFILE;
          let extensionPath;

          switch (ide) {
            case 'cursor':
              extensionPath = path.join(homeDir, '.cursor', 'extensions');
              break;
            case 'vscode':
              extensionPath = path.join(homeDir, '.vscode', 'extensions');
              break;
            case 'antigravity':
              extensionPath = path.join(homeDir, '.antigravity', 'extensions');
              break;
          }

          if (extensionPath && fs.existsSync(extensionPath)) {
            detected = true;
            this.log(`✓ ${config.name} detected via folder structure`, 'success');
          }
        }

        if (detected) {
          available.push({
            ide,
            config,
            command,
            priority: config.priority
          });
          this.log(`✓ ${config.name} detected`, 'success');
        } else {
          this.log(`✗ ${config.name} not available`, 'warning');
        }
      } catch (error) {
        this.log(`✗ ${config.name} detection failed: ${error.message}`, 'warning');
      }
    }

    // Sort by priority (lower number = higher priority)
    available.sort((a, b) => a.priority - b.priority);
    this.detectedIDEs = available;

    if (available.length === 0) {
      throw new Error('No supported IDE found (Cursor or VS Code)');
    }

    this.log(`Found ${available.length} IDE(s): ${available.map(ide => ide.config.name).join(', ')}`, 'info');
    return available;
  }

  async scanIDEs(extensionId) {
    const results = [];
    const homeDir = process.env.HOME || process.env.USERPROFILE;

    for (const { ide, config, command } of this.detectedIDEs) {
      let version = null;
      try {
        this.log(`Checking ${config.name} for Augment extension...`);

        // Try folder first
        let extensionDir;
        switch (ide) {
          case 'cursor':
            extensionDir = path.join(homeDir, '.cursor', 'extensions');
            break;
          case 'vscode':
            extensionDir = path.join(homeDir, '.vscode', 'extensions');
            break;
          case 'antigravity':
            extensionDir = path.join(homeDir, '.antigravity', 'extensions');
            break;
        }

        if (extensionDir) {
          version = await this.getExtensionVersionFromDir(extensionDir, extensionId);
        }

        // Fallback to CLI command
        if (!version) {
          try {
            const output = execSync(`${command} ${config.commands.listExtensions}`, {
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'ignore'],
              timeout: 10000
            });

            let match;
            if (ide === 'cursor' || ide === 'antigravity') {
              // Cursor and Antigravity support --show-versions
              match = output.match(new RegExp(`${extensionId.replace('.', '\\.')}@(\\d+\\.\\d+\\.\\d+)`));
            } else {
              if (output.includes(extensionId)) {
                // VS Code doesn't show version in list, try to read from folder again or assume installed
                // If we couldn't read folder before, we might not get version here.
                // But we know it's installed.
                match = await this.getExtensionVersionFromDir(extensionDir, extensionId);
                if (!match) match = 'Installed (unknown version)';
              }
            }

            if (match) {
              version = (typeof match === 'string') ? match : match[1];
            }
          } catch (cliError) {
            // CLI failed
          }
        }

        if (version) {
          this.log(`Found in ${config.name}: ${version}`, 'success');
        } else {
          this.log(`Not found in ${config.name}`, 'warning');
        }
      } catch (error) {
        this.log(`${config.name} check failed: ${error.message}`, 'warning');
      }

      results.push({ ide, config, command, version });
    }
    return results;
  }

  async getExtensionVersionFromDir(extensionDir, extensionId) {
    try {
      if (fs.existsSync(extensionDir)) {
        const extensions = fs.readdirSync(extensionDir);
        // Look for folders starting with extensionId
        // Note: extensionId is like 'augment.vscode-augment'
        // Folders are usually 'publisher.name-version'
        // But the user code previously used 'augment.vscode-augment-' prefix check.
        // Let's stick to that pattern if it works, or make it more robust.

        const prefix = `${extensionId}-`;
        const augmentFolders = extensions.filter(folder => folder.startsWith(prefix));

        if (augmentFolders.length > 0) {
          // If multiple versions exist, return the highest version
          const versions = augmentFolders
            .map(folder => folder.replace(prefix, ''))
            .filter(v => semver.valid(v))
            .sort((a, b) => semver.rcompare(a, b)); // Sort descending

          if (versions.length > 0) {
            return versions[0]; // Return highest version
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
    return null;
  }

  async findExtensionInIDEs(extensionId) {
    // Legacy support using scanIDEs
    const results = await this.scanIDEs(extensionId);
    const found = results.find(r => r.version);
    if (found) {
      this.currentIDE = { ide: found.ide, config: found.config, command: found.command };
      return found.version;
    }
    return null;
  }



  async installExtensionInCurrentIDE(vsixPath) {
    if (!this.currentIDE) {
      throw new Error('No IDE selected for installation');
    }

    const { config, command } = this.currentIDE;
    this.log(`Installing extension via ${config.name} CLI...`);

    try {
      execSync(`${command} ${config.commands.installExtension} "${vsixPath}"`, {
        stdio: 'inherit',
        timeout: 60000, // Increased timeout for slower devices
        env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
      });

      this.log(`Extension installed successfully in ${config.name}`, 'success');
    } catch (error) {
      this.log(`Installation failed: ${error.message}`, 'error');
      throw new Error(`Failed to install extension in ${config.name}: ${error.message}`);
    }
  }

  async installExtensionInAllIDEs(vsixPath) {
    this.log('Installing extension in all available IDEs...');

    for (const { ide, config, command } of this.detectedIDEs) {
      try {
        this.log(`Installing in ${config.name}...`);
        execSync(`${command} ${config.commands.installExtension} "${vsixPath}"`, {
          stdio: 'inherit',
          timeout: 30000
        });
        this.log(`✓ Installed in ${config.name}`, 'success');
      } catch (error) {
        this.log(`✗ Failed to install in ${config.name}: ${error.message}`, 'error');
      }
    }
  }

  log(message, level = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };

    console.log(`${colors[level](`[IDE]`)} ${message}`);
  }
}

class AugmentMonitor {
  constructor() {
    this.extensionId = 'augment.vscode-augment';
    this.publisherId = 'augment';
    this.extensionName = 'vscode-augment';
    this.tempDir = path.join(__dirname, 'temp');
    this.isDryRun = process.argv.includes('--dry-run');
    this.isCronMode = !process.stdout.isTTY; // Detect if running from cron

    // Initialize IDE manager
    this.ideManager = new IDEManager();

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir);
    }
  }

  /**
   * Normalize a version string to handle suffixes like "-universal"
   * @param {string} version - Version string to normalize
   * @returns {string|null} - Normalized version or null if invalid
   */
  normalizeVersion(version) {
    if (!version) return null;

    const coerced = semver.coerce(version);
    return coerced ? coerced.version : null;
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };

    console.log(`[${timestamp}] ${colors[level](level.toUpperCase())}: ${message}`);
  }

  async getCurrentVersion() {
    try {
      this.log('Checking current Augment version...');

      // Detect available IDEs first
      this.ideManager.detectAvailableIDEs();

      // Find extension in any available IDE
      const version = await this.ideManager.findExtensionInIDEs(this.extensionId);

      if (version) {
        this.log(`Current version: ${version}`, 'info');
        return version;
      } else {
        this.log('Augment extension not found in any IDE', 'warning');
        return null;
      }
    } catch (error) {
      this.log(`Failed to get current version: ${error.message}`, 'error');
      throw error;
    }
  }

  async getLatestVersion() {
    try {
      this.log('Fetching latest version from VS Code Marketplace...');

      // Try the public API first
      const response = await fetch('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json;api-version=3.0-preview.1',
          'User-Agent': 'augment-monitor/1.0.0'
        },
        body: JSON.stringify({
          filters: [{
            criteria: [
              { filterType: 7, value: this.extensionId }
            ],
            pageNumber: 1,
            pageSize: 1,
            sortBy: 0,
            sortOrder: 0
          }],
          assetTypes: [],
          flags: 0x200
        })
      });

      if (!response.ok) {
        this.log(`API failed with ${response.status}, trying web scraping fallback...`, 'warning');
        return await this.getLatestVersionFallback();
      }

      const data = await response.json();

      if (!data.results || !data.results[0] || !data.results[0].extensions || !data.results[0].extensions[0]) {
        this.log('No extension found in API response, trying fallback...', 'warning');
        return await this.getLatestVersionFallback();
      }

      const extension = data.results[0].extensions[0];
      const version = extension.versions[0].version;

      this.log(`Latest version: ${version}`, 'info');
      return version;
    } catch (error) {
      this.log(`API failed: ${error.message}, trying fallback...`, 'warning');
      return await this.getLatestVersionFallback();
    }
  }

  async getLatestVersionFallback() {
    try {
      this.log('Using web scraping fallback...');

      const response = await fetch(`https://marketplace.visualstudio.com/items?itemName=${this.extensionId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Marketplace page failed with status: ${response.status}`);
      }

      const html = await response.text();

      // Look for version in the HTML - multiple patterns to try
      const versionPatterns = [
        /"version":"([^"]+)"/,
        /Version\s+([0-9]+\.[0-9]+\.[0-9]+)/i,
        /"Version":"([^"]+)"/,
        /data-version="([^"]+)"/
      ];

      for (const pattern of versionPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          const version = match[1];
          this.log(`Latest version (fallback): ${version}`, 'info');
          return version;
        }
      }

      throw new Error('Could not find version in marketplace page');
    } catch (error) {
      this.log(`Fallback also failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async sendNativeNotification(title, message, buttons = ['OK']) {
    try {
      if (this.isDryRun) {
        this.log(`DRY RUN: Would send notification: ${title} - ${message}`, 'warning');
        return 'OK';
      }

      // Use osascript to show native macOS notification with dialog
      const buttonList = buttons.map(b => `"${b}"`).join(', ');
      const script = `display dialog "${message}" with title "${title}" buttons {${buttonList}} default button "${buttons[buttons.length - 1]}" with icon note`;

      const result = execSync(`osascript -e '${script}'`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });

      // Extract button result
      const match = result.match(/button returned:(.+)$/);
      return match ? match[1].trim() : buttons[0];
    } catch (error) {
      this.log(`Native notification failed: ${error.message}`, 'warning');
      return null; // Fallback to CLI prompt
    }
  }

  async promptSelection(ideStatus, latestVersion) {
    if (this.isCronMode) {
      // In cron mode, we just check if any update is needed and ask to update ALL
      const updatesNeeded = ideStatus.filter(s => !s.version || semver.gt(latestVersion, s.version));
      if (updatesNeeded.length === 0) return [];

      const message = `Latest: ${latestVersion}\\nUpdates available for: ${updatesNeeded.map(s => s.config.name).join(', ')}`;
      const result = await this.sendNativeNotification(
        'Augment Extension Update Available',
        message,
        ['Cancel', 'Update All']
      );
      return result === 'Update All' ? updatesNeeded : [];
    }

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const options = [];
      let optionIndex = 1;

      // Option 1: Update All (if applicable)
      options.push({
        key: 'a',
        label: 'Update All IDEs',
        value: ideStatus
      });

      // Individual IDEs
      ideStatus.forEach(status => {
        options.push({
          key: optionIndex.toString(),
          label: `Update ${status.config.name} only`,
          value: [status]
        });
        optionIndex++;
      });

      console.log('\n' + chalk.cyan('👉 Select an option:'));
      options.forEach(opt => {
        console.log(`${chalk.bold(opt.key)}) ${opt.label}`);
      });
      console.log(`${chalk.bold('q')}) Quit`);

      rl.question(chalk.bold('\nEnter choice: '), (answer) => {
        rl.close();
        const choice = answer.toLowerCase().trim();

        if (choice === 'q') {
          resolve([]);
          return;
        }

        const selectedOption = options.find(o => o.key === choice);
        if (selectedOption) {
          resolve(selectedOption.value);
        } else {
          console.log(chalk.red('Invalid selection'));
          resolve([]);
        }
      });
    });
  }

  async downloadVsix(version) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log(`Downloading VSIX file for version ${version}... (attempt ${attempt}/${maxRetries})`);

        if (this.isDryRun) {
          this.log('DRY RUN: Would download VSIX file', 'warning');
          return path.join(this.tempDir, `${this.extensionId}-${version}.vsix`);
        }

        const downloadUrl = `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${this.publisherId}/vsextensions/${this.extensionName}/${version}/vspackage`;

        const response = await fetch(downloadUrl, {
          headers: {
            'Accept': 'application/octet-stream',
            'User-Agent': 'VSCode/1.85.0 (Windows NT 10.0; Win64; x64)',
            'Accept-Encoding': 'gzip, deflate, br'
          },
          timeout: 60000 // 60 second timeout
        });

        if (!response.ok) {
          throw new Error(`Download failed with status: ${response.status}`);
        }

        const fileName = `${this.extensionId}-${version}.vsix`;
        const filePath = path.join(this.tempDir, fileName);

        const buffer = await response.buffer();

        // Verify downloaded file is not empty
        if (buffer.length === 0) {
          throw new Error('Downloaded file is empty');
        }

        fs.writeFileSync(filePath, buffer);

        // Verify file was written successfully
        if (!fs.existsSync(filePath)) {
          throw new Error('File write verification failed');
        }

        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        this.log(`Downloaded ${fileName} (${fileSizeMB} MB)`, 'success');

        return filePath;
      } catch (error) {
        lastError = error;
        this.log(`Download attempt ${attempt} failed: ${error.message}`, 'error');

        if (attempt < maxRetries) {
          const delayMs = 2000 * attempt; // Progressive delay: 2s, 4s, 6s
          this.log(`Retrying in ${delayMs / 1000} seconds...`, 'warning');
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries failed
    throw new Error(`Download failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
  }

  async installExtensions(targets, vsixPath) {
    this.log(`Installing extension to ${targets.length} IDE(s)...`);

    const results = [];

    for (const target of targets) {
      const { config, command } = target;
      try {
        this.log(`Installing in ${config.name}...`);

        if (this.isDryRun) {
          this.log(`DRY RUN: Would install in ${config.name}`, 'warning');
          results.push({ target, success: true });
          continue;
        }

        execSync(`${command} ${config.commands.installExtension} "${vsixPath}"`, {
          stdio: 'inherit',
          timeout: 60000,
          env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
        });

        this.log(`✓ Installed in ${config.name}`, 'success');
        results.push({ target, success: true });
      } catch (error) {
        this.log(`✗ Failed to install in ${config.name}: ${error.message}`, 'error');
        results.push({ target, success: false, error });
      }
    }

    return results;
  }

  async verifyInstallations(targets, expectedVersion) {
    this.log('Verifying installations...');

    if (this.isDryRun) {
      this.log('DRY RUN: Would verify installations', 'warning');
      return { success: true, failed: [] };
    }

    const maxRetries = 5;
    const delayMs = 3000;
    const failed = [];

    for (const target of targets) {
      let verified = false;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // Check version for this specific IDE
        const allStatus = await this.ideManager.scanIDEs(this.extensionId);
        const targetStatus = allStatus.find(s => s.ide === target.ide);

        if (targetStatus && targetStatus.version === expectedVersion) {
          this.log(`✓ Verified ${target.config.name}: ${targetStatus.version}`, 'success');
          verified = true;
          break;
        } else {
          this.log(`Attempt ${attempt}: ${target.config.name} has ${targetStatus ? targetStatus.version : 'unknown'}, expected ${expectedVersion}`, 'warning');
        }
      }

      if (!verified) {
        this.log(`✗ Failed to verify installation for ${target.config.name}`, 'error');
        failed.push(target);
      }
    }

    if (failed.length > 0) {
      return { success: false, failed };
    }

    return { success: true, failed: [] };
  }

  cleanupFile(filePath) {
    try {
      if (this.isDryRun) {
        this.log('DRY RUN: Would delete VSIX file', 'warning');
        return;
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.log(`Cleaned up: ${path.basename(filePath)}`, 'success');
      }
    } catch (error) {
      this.log(`Cleanup failed: ${error.message}`, 'warning');
    }
  }

  async run() {
    try {
      this.log('Starting Augment extension update check...', 'info');

      // Detect IDEs
      await this.ideManager.detectAvailableIDEs();

      // Get status of all IDEs
      const ideStatus = await this.ideManager.scanIDEs(this.extensionId);
      const latestVersion = await this.getLatestVersion();

      // Display Status
      console.log('\n' + chalk.cyan('🔎 IDE Status Check'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.bold('Latest Version: ') + chalk.green(latestVersion));
      console.log(chalk.gray('─'.repeat(60)));

      let updateAvailable = false;
      ideStatus.forEach(status => {
        const v = status.version || 'Not installed';
        const isOutdated = !status.version || semver.gt(latestVersion, status.version);
        if (isOutdated) updateAvailable = true;

        const color = isOutdated ? chalk.yellow : chalk.green;
        console.log(`${chalk.bold(status.config.name.padEnd(10))} | ${color(v.padEnd(15))} | ${isOutdated ? chalk.cyan('Update Available') : chalk.green('Up to date')}`);
      });
      console.log(chalk.gray('─'.repeat(60)));

      // If no updates available and not forcing, maybe just exit?
      // But user might want to reinstall or update specific IDEs even if "up to date" (e.g. if one is missing)
      // The logic above sets updateAvailable if ANY is outdated or missing.

      if (!updateAvailable && !process.argv.includes('--force')) {
        console.log(chalk.green('\n✅ All IDEs are up to date.'));
        if (this.isCronMode) return;

        // In interactive mode, we still show the menu so they can reinstall if they want
        console.log(chalk.gray('You can still choose to reinstall below.'));
      }

      // Prompt user for selection
      const targets = await this.promptSelection(ideStatus, latestVersion);

      if (targets.length === 0) {
        this.log('No updates selected.', 'info');
        return;
      }

      let vsixPath = null;

      try {
        // Download VSIX
        vsixPath = await this.downloadVsix(latestVersion);

        // Install extension to selected targets
        const installResults = await this.installExtensions(targets, vsixPath);
        const successfulInstalls = installResults.filter(r => r.success).map(r => r.target);
        const failedInstalls = installResults.filter(r => !r.success);

        // Verify installations for successful ones
        const verifyResult = await this.verifyInstallations(successfulInstalls, latestVersion);

        // Success message
        console.log('\n' + chalk.cyan('📊 Update Summary'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(`${chalk.bold('Target'.padEnd(15))} | ${chalk.bold('Status'.padEnd(20))} | ${chalk.bold('Details')}`);
        console.log(chalk.gray('─'.repeat(60)));

        targets.forEach(t => {
          const installResult = installResults.find(r => r.target.ide === t.ide);
          const isVerified = verifyResult.success && !verifyResult.failed.some(f => f.ide === t.ide);

          let status = chalk.red('Failed');
          let details = '';

          if (installResult && !installResult.success) {
            status = chalk.red('Install Failed');
            details = installResult.error.message.split('\n')[0].substring(0, 30) + '...';
          } else if (isVerified) {
            status = chalk.green('Success');
            details = `Updated to ${latestVersion}`;
          } else {
            status = chalk.yellow('Verify Failed');
            details = 'Version mismatch or check failed';
          }

          console.log(`${t.config.name.padEnd(15)} | ${status.padEnd(29)} | ${details}`);
        });
        console.log(chalk.gray('─'.repeat(60)));

        if (verifyResult.success && failedInstalls.length === 0) {
          console.log('\n' + chalk.green('✅ All updates completed successfully!'));
        } else {
          console.log('\n' + chalk.yellow('⚠️ Completed with some issues. See summary above.'));
        }

        console.log('\nYou may need to reload your IDEs for changes to take effect.');

        // Send notification in cron mode
        if (this.isCronMode) {
          const successCount = successfulInstalls.length - verifyResult.failed.length;
          const totalCount = targets.length;

          if (successCount === totalCount) {
            await this.sendNativeNotification(
              'Augment Update Complete',
              `Successfully updated ${successCount} IDEs to version ${latestVersion}`,
              ['OK']
            );
          } else {
            await this.sendNativeNotification(
              'Augment Update Finished',
              `Updated ${successCount}/${totalCount} IDEs. Some failed.`,
              ['OK']
            );
          }
        }

      } catch (error) {
        // Log the specific error
        this.log(`Update failed: ${error.message}`, 'error');

        // Send failure notification in cron mode
        if (this.isCronMode) {
          await this.sendNativeNotification(
            'Augment Update Failed',
            `Failed to update: ${error.message}`,
            ['OK']
          );
        }

        throw error;
      } finally {
        // Always cleanup the downloaded file
        if (vsixPath) {
          this.cleanupFile(vsixPath);
        }
      }

    } catch (error) {
      this.log(`Update process failed: ${error.message}`, 'error');
      console.log('\n' + chalk.red('❌ Update failed'));
      console.log(`Error: ${error.message}`);
      process.exit(1);
    }
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

// Run the monitor
if (require.main === module) {
  const monitor = new AugmentMonitor();
  monitor.run();
}

module.exports = AugmentMonitor; 