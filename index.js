#!/usr/bin/env node

const { execSync } = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const os = require('os');
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
      }
    };
    
    this.detectedIDEs = [];
    this.currentIDE = null;
  }

  detectAvailableIDEs() {
    this.log('Detecting available IDEs...');
    const available = [];
    
    for (const [ide, config] of Object.entries(this.supportedIDEs)) {
      try {
        const command = process.env[config.envVar] || ide;
        execSync(`${command} ${config.commands.version}`, { 
          stdio: 'ignore',
          timeout: 5000 
        });
        available.push({ 
          ide, 
          config, 
          command,
          priority: config.priority 
        });
        this.log(`✓ ${config.name} detected`, 'success');
      } catch (error) {
        this.log(`✗ ${config.name} not available`, 'warning');
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

  async findExtensionInIDEs(extensionId) {
    for (const { ide, config, command } of this.detectedIDEs) {
      try {
        this.log(`Checking ${config.name} for Augment extension...`);
        
        const output = execSync(`${command} ${config.commands.listExtensions}`, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 10000
        });
        
        // Handle different output formats
        let match;
        if (ide === 'cursor') {
          // Cursor format: augment.vscode-augment@1.2.3
          match = output.match(/augment\.vscode-augment@(\d+\.\d+\.\d+)/);
        } else {
          // VS Code format: augment.vscode-augment
          if (output.includes('augment.vscode-augment')) {
            // For VS Code, we need to get version differently since --list-extensions doesn't show versions
            // We'll try to get it from the extension folder
            match = await this.getVSCodeExtensionVersion(extensionId);
          }
        }
        
        if (match) {
          this.currentIDE = { ide, config, command };
          const version = ide === 'cursor' ? match[1] : match;
          this.log(`Found in ${config.name}: ${version}`, 'success');
          return version;
        }
      } catch (error) {
        this.log(`${config.name} check failed: ${error.message}`, 'warning');
      }
    }
    
    this.log('Augment extension not found in any IDE', 'warning');
    return null;
  }

  async getVSCodeExtensionVersion(extensionId) {
    try {
      // Try to get version from VS Code extension folder
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      const vscodeExtensionsPath = path.join(homeDir, '.vscode', 'extensions');
      
      if (fs.existsSync(vscodeExtensionsPath)) {
        const extensions = fs.readdirSync(vscodeExtensionsPath);
        const augmentFolder = extensions.find(folder => folder.startsWith('augment.vscode-augment-'));
        
        if (augmentFolder) {
          const version = augmentFolder.replace('augment.vscode-augment-', '');
          if (semver.valid(version)) {
            return version;
          }
        }
      }
    } catch (error) {
      this.log(`Failed to get VS Code extension version: ${error.message}`, 'warning');
    }
    
    return null;
  }

  async installExtensionInCurrentIDE(vsixPath) {
    if (!this.currentIDE) {
      throw new Error('No IDE selected for installation');
    }

    const { ide, config, command } = this.currentIDE;
    this.log(`Installing extension via ${config.name} CLI...`);

    if (ide === 'cursor') {
      // For Cursor, check if we should install to all profiles
      const installInAllProfiles = process.argv.includes('--install-all-profiles') ||
                                   process.argv.includes('--install-all');

      if (installInAllProfiles) {
        await this.installExtensionInAllCursorProfiles(vsixPath, command, config);
      } else {
        execSync(`${command} ${config.commands.installExtension} "${vsixPath}"`, {
          stdio: 'inherit',
          timeout: 30000
        });
        this.log(`Extension installed successfully in ${config.name} (current profile only)`, 'success');
      }
    } else {
      execSync(`${command} ${config.commands.installExtension} "${vsixPath}"`, {
        stdio: 'inherit',
        timeout: 30000
      });
      this.log(`Extension installed successfully in ${config.name}`, 'success');
    }
  }

  async installExtensionInAllIDEs(vsixPath) {
    this.log('Installing extension in all available IDEs...');

    for (const { ide, config, command } of this.detectedIDEs) {
      try {
        this.log(`Installing in ${config.name}...`);

        if (ide === 'cursor') {
          // For Cursor, also install to all profiles
          await this.installExtensionInAllCursorProfiles(vsixPath, command, config);
        } else {
          // For other IDEs, install normally
          execSync(`${command} ${config.commands.installExtension} "${vsixPath}"`, {
            stdio: 'inherit',
            timeout: 30000
          });
          this.log(`✓ Installed in ${config.name}`, 'success');
        }
      } catch (error) {
        this.log(`✗ Failed to install in ${config.name}: ${error.message}`, 'error');
      }
    }
  }

  async installExtensionInAllCursorProfiles(vsixPath, command, config) {
    try {
      // Get all Cursor profiles
      const profiles = await this.getCursorProfiles();

      if (profiles.length === 0) {
        this.log('No Cursor profiles found, installing to default profile only', 'warning');
        execSync(`${command} ${config.commands.installExtension} "${vsixPath}"`, {
          stdio: 'inherit',
          timeout: 30000
        });
        this.log(`✓ Installed in ${config.name} (default profile)`, 'success');
        return;
      }

      this.log(`Found ${profiles.length} Cursor profile(s), installing to all...`);

      // First, install to default profile to get the extension files
      try {
        this.log('Installing to Cursor default profile...');
        execSync(`${command} ${config.commands.installExtension} "${vsixPath}"`, {
          stdio: 'inherit',
          timeout: 30000
        });
        this.log(`✓ Installed in Cursor default profile`, 'success');
      } catch (error) {
        this.log(`✗ Failed to install in Cursor default profile: ${error.message}`, 'error');
        throw error; // Can't proceed without a successful installation
      }

      // Now copy the extension to all profiles
      await this.copyExtensionToAllProfiles(profiles);

    } catch (error) {
      this.log(`Error managing Cursor profiles: ${error.message}`, 'error');
      // Fallback to default installation
      execSync(`${command} ${config.commands.installExtension} "${vsixPath}"`, {
        stdio: 'inherit',
        timeout: 30000
      });
      this.log(`✓ Installed in ${config.name} (fallback to default)`, 'success');
    }
  }

  async copyExtensionToAllProfiles(profiles) {
    try {
      const os = require('os');

      // Find the Augment extension in the default extensions directory
      const defaultExtensionsPath = path.join(os.homedir(), '.cursor', 'extensions');

      if (!fs.existsSync(defaultExtensionsPath)) {
        this.log('Default extensions directory not found', 'error');
        return;
      }

      // Find the Augment extension directory
      const extensionDirs = fs.readdirSync(defaultExtensionsPath)
        .filter(dir => dir.startsWith('augment.vscode-augment-'));

      if (extensionDirs.length === 0) {
        this.log('Augment extension not found in default extensions directory', 'error');
        return;
      }

      // Use the latest version (should be the one we just installed)
      const latestExtensionDir = extensionDirs.sort().pop();
      const sourceExtensionPath = path.join(defaultExtensionsPath, latestExtensionDir);

      this.log(`Found Augment extension: ${latestExtensionDir}`);

      // Copy to each profile
      for (const profile of profiles) {
        try {
          const profileExtensionsPath = path.join(profile.path, '..', '..', '..', '.cursor', 'extensions');

          // Create extensions directory if it doesn't exist
          if (!fs.existsSync(profileExtensionsPath)) {
            fs.mkdirSync(profileExtensionsPath, { recursive: true });
          }

          const targetExtensionPath = path.join(profileExtensionsPath, latestExtensionDir);

          // Remove old version if it exists
          if (fs.existsSync(targetExtensionPath)) {
            fs.rmSync(targetExtensionPath, { recursive: true, force: true });
          }

          // Copy the extension
          await this.copyDirectory(sourceExtensionPath, targetExtensionPath);

          // Update the profile's extensions.json
          await this.updateProfileExtensionsJson(profile, latestExtensionDir);

          this.log(`✓ Copied Augment extension to profile: ${profile.name}`, 'success');

        } catch (error) {
          this.log(`✗ Failed to copy extension to profile ${profile.name}: ${error.message}`, 'error');
        }
      }

    } catch (error) {
      this.log(`Error copying extension to profiles: ${error.message}`, 'error');
    }
  }

  async copyDirectory(source, target) {
    if (!fs.existsSync(source)) {
      throw new Error(`Source directory does not exist: ${source}`);
    }

    // Create target directory
    fs.mkdirSync(target, { recursive: true });

    // Copy all files and subdirectories
    const items = fs.readdirSync(source, { withFileTypes: true });

    for (const item of items) {
      const sourcePath = path.join(source, item.name);
      const targetPath = path.join(target, item.name);

      if (item.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  async updateProfileExtensionsJson(profile, extensionDirName) {
    try {
      const extensionsJsonPath = path.join(profile.path, 'extensions.json');

      if (!fs.existsSync(extensionsJsonPath)) {
        // Create a new extensions.json if it doesn't exist
        const newExtensionsData = [];
        fs.writeFileSync(extensionsJsonPath, JSON.stringify(newExtensionsData, null, 2));
        return;
      }

      // Read existing extensions.json
      const extensionsData = JSON.parse(fs.readFileSync(extensionsJsonPath, 'utf8'));

      // Remove any existing Augment extension entries
      const filteredExtensions = extensionsData.filter(ext =>
        !ext.identifier || !ext.identifier.id || !ext.identifier.id.includes('augment.vscode-augment')
      );

      // Add the new Augment extension entry
      const versionMatch = extensionDirName.match(/augment\.vscode-augment-(.+)$/);
      const version = versionMatch ? versionMatch[1] : '0.551.0';

      const newExtensionEntry = {
        identifier: {
          id: "augment.vscode-augment",
          uuid: "fc0e137d-e132-47ed-9455-c4636fa5b897"
        },
        version: version,
        location: {
          $mid: 1,
          path: `/c:/Users/${os.userInfo().username}/.cursor/extensions/${extensionDirName}`,
          scheme: "file"
        },
        relativeLocation: extensionDirName,
        metadata: {
          isApplicationScoped: false,
          isMachineScoped: false,
          isBuiltin: false,
          installedTimestamp: Date.now(),
          pinned: false,
          source: "gallery",
          id: "fc0e137d-e132-47ed-9455-c4636fa5b897",
          publisherId: "7814b14b-491a-4e83-83ac-9222fa835050",
          publisherDisplayName: "augment",
          targetPlatform: "undefined",
          updated: true,
          private: false,
          isPreReleaseVersion: true,
          hasPreReleaseVersion: true,
          preRelease: true
        }
      };

      filteredExtensions.push(newExtensionEntry);

      // Write back to extensions.json
      fs.writeFileSync(extensionsJsonPath, JSON.stringify(filteredExtensions, null, 2));

    } catch (error) {
      this.log(`Error updating extensions.json for profile ${profile.name}: ${error.message}`, 'error');
    }
  }

  async getCursorProfiles() {
    try {
      const os = require('os');
      const cursorProfilesPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'profiles');

      if (!fs.existsSync(cursorProfilesPath)) {
        this.log('Cursor profiles directory not found', 'warning');
        return [];
      }

      const profileDirs = fs.readdirSync(cursorProfilesPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      const profiles = [];

      for (const profileDir of profileDirs) {
        const profilePath = path.join(cursorProfilesPath, profileDir);
        const extensionsJsonPath = path.join(profilePath, 'extensions.json');

        // Check if this profile has extensions (indicating it's an active profile)
        if (fs.existsSync(extensionsJsonPath)) {
          profiles.push({
            name: profileDir,
            path: profilePath,
            hasAugment: await this.profileHasAugment(extensionsJsonPath)
          });
        }
      }

      return profiles;
    } catch (error) {
      this.log(`Error getting Cursor profiles: ${error.message}`, 'error');
      return [];
    }
  }

  async profileHasAugment(extensionsJsonPath) {
    try {
      const extensionsData = fs.readFileSync(extensionsJsonPath, 'utf8');
      return extensionsData.includes('augment.vscode-augment');
    } catch (error) {
      return false;
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

  async promptUser(currentVersion, latestVersion) {
    // If running from cron (no TTY), use native notifications
    if (this.isCronMode) {
      this.log('Running in cron mode, using native notifications', 'info');
      
      const message = `Current: ${currentVersion || 'Not installed'}\\nLatest: ${latestVersion}\\n\\nInstall this update?`;
      const result = await this.sendNativeNotification(
        'Augment Extension Update Available',
        message,
        ['Cancel', 'Install']
      );
      
      const proceed = result === 'Install';
      this.log(proceed ? 'User approved update via notification' : 'User declined update via notification', proceed ? 'success' : 'info');
      return proceed;
    }

    // CLI mode for interactive terminals
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('\n' + chalk.cyan('🚀 Augment Extension Update Available!'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`Current version: ${chalk.yellow(currentVersion || 'Not installed')}`);
      console.log(`Latest version:  ${chalk.green(latestVersion)}`);
      console.log(chalk.gray('─'.repeat(50)));
      
      rl.question(chalk.bold('\nWould you like to download and install this update? (y/N): '), (answer) => {
        rl.close();
        const proceed = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
        
        if (proceed) {
          this.log('User approved update', 'success');
        } else {
          this.log('User declined update', 'info');
        }
        
        resolve(proceed);
      });
    });
  }

  async downloadVsix(version) {
    try {
      this.log(`Downloading VSIX file for version ${version}...`);

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
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }

      const fileName = `${this.extensionId}-${version}.vsix`;
      const filePath = path.join(this.tempDir, fileName);

      const buffer = await response.buffer();
      fs.writeFileSync(filePath, buffer);

      const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
      this.log(`Downloaded ${fileName} (${fileSizeMB} MB)`, 'success');

      return filePath;
    } catch (error) {
      this.log(`Download failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async installExtension(vsixPath) {
    try {
      if (this.isDryRun) {
        this.log('DRY RUN: Would install extension', 'warning');
        return true;
      }

      // Check if we should install in all IDEs or just the current one
      const installInAll = process.argv.includes('--install-all');
      
      if (installInAll && this.ideManager.detectedIDEs.length > 1) {
        await this.ideManager.installExtensionInAllIDEs(vsixPath);
      } else {
        await this.ideManager.installExtensionInCurrentIDE(vsixPath);
      }
      
      this.log('Extension installation completed', 'success');
      return true;
    } catch (error) {
      this.log(`Installation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async verifyInstallation(expectedVersion) {
    try {
      this.log('Verifying installation...');
      
      if (this.isDryRun) {
        this.log('DRY RUN: Would verify installation', 'warning');
        return true;
      }

      // Wait a moment for the extension to be recognized
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const installedVersion = await this.getCurrentVersion();
      
      if (installedVersion === expectedVersion) {
        this.log(`Installation verified! Running version ${installedVersion}`, 'success');
        return true;
      } else {
        throw new Error(`Version mismatch: expected ${expectedVersion}, got ${installedVersion}`);
      }
    } catch (error) {
      this.log(`Installation verification failed: ${error.message}`, 'error');
      throw error;
    }
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
      
      // Get current and latest versions
      const [currentVersion, latestVersion] = await Promise.all([
        this.getCurrentVersion(),
        this.getLatestVersion()
      ]);

      // Compare versions
      if (!currentVersion) {
        this.log('Augment extension not installed, proceeding with installation...', 'warning');
      } else if (!semver.gt(latestVersion, currentVersion)) {
        this.log(`Already up to date! (${currentVersion})`, 'success');
        
        // In cron mode, only notify if explicitly configured
        if (this.isCronMode) {
          this.log('Up to date - no notification needed for cron mode', 'info');
        }
        return;
      }

      // Prompt user for approval
      const userApproved = await this.promptUser(currentVersion, latestVersion);
      
      if (!userApproved) {
        this.log('Update cancelled by user', 'info');
        return;
      }

      let vsixPath = null;

      try {
        // Download VSIX
        vsixPath = await this.downloadVsix(latestVersion);
        
        // Install extension
        await this.installExtension(vsixPath);
        
        // Verify installation
        await this.verifyInstallation(latestVersion);
        
        // Success message
        console.log('\n' + chalk.green('✅ Update completed successfully!'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log(`${chalk.green('●')} Downloaded version ${latestVersion}`);
        const ideName = this.ideManager.currentIDE ? this.ideManager.currentIDE.config.name : 'IDE';
        console.log(`${chalk.green('●')} Installed via ${ideName} CLI`);
        console.log(`${chalk.green('●')} Installation verified`);
        console.log(`${chalk.green('●')} Temporary files cleaned up`);
        console.log('\nYou may need to reload Cursor for all changes to take effect.');

        // Send success notification in cron mode
        if (this.isCronMode) {
          await this.sendNativeNotification(
            'Augment Update Complete',
            `Successfully updated to version ${latestVersion}\\n\\nYou may need to reload Cursor.`,
            ['OK']
          );
        }

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