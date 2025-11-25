const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const semver = require('semver');
const Logger = require('../utils/logger');

class IDEManager {
  constructor() {
    this.logger = new Logger('IDE');
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
        priority: 3
      }
    };

    this.macPaths = {
      cursor: '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
      vscode: '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
      antigravity: `${process.env.HOME}/.antigravity/antigravity/bin/antigravity`
    };

    this.detectedIDEs = [];
  }

  detectAvailableIDEs() {
    this.logger.info('Detecting available IDEs...');
    const available = [];

    for (const [ide, config] of Object.entries(this.supportedIDEs)) {
      try {
        let command = process.env[config.envVar] || ide;
        let detected = false;

        try {
          execSync(`${command} ${config.commands.version}`, {
            stdio: 'ignore',
            timeout: 10000,
            env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
          });
          detected = true;
        } catch (cliError) {
          if (process.platform === 'darwin' && this.macPaths[ide]) {
            if (fs.existsSync(this.macPaths[ide])) {
              command = `"${this.macPaths[ide]}"`;
              detected = true;
              this.logger.success(`${config.name} detected at ${this.macPaths[ide]}`);
            }
          }
        }

        if (!detected) {
          const extensionPath = this.getExtensionPath(ide);
          if (extensionPath && fs.existsSync(extensionPath)) {
            detected = true;
            this.logger.success(`${config.name} detected via folder structure`);
          }
        }

        if (detected) {
          available.push({ ide, config, command, priority: config.priority });
          this.logger.success(`${config.name} detected`);
        }
      } catch (error) {
        this.logger.warn(`${config.name} detection failed: ${error.message}`);
      }
    }

    available.sort((a, b) => a.priority - b.priority);
    this.detectedIDEs = available;

    if (available.length > 0) {
      this.logger.info(`Found ${available.length} IDE(s): ${available.map(ide => ide.config.name).join(', ')}`);
    }

    return available;
  }

  getExtensionPath(ide) {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const paths = {
      cursor: path.join(homeDir, '.cursor', 'extensions'),
      vscode: path.join(homeDir, '.vscode', 'extensions'),
      antigravity: path.join(homeDir, '.antigravity', 'extensions')
    };
    return paths[ide];
  }

  async getExtensionVersionFromDir(extensionDir, extensionId) {
    try {
      if (fs.existsSync(extensionDir)) {
        const extensions = fs.readdirSync(extensionDir);
        const prefix = `${extensionId}-`;
        const augmentFolders = extensions.filter(folder => folder.startsWith(prefix));

        if (augmentFolders.length > 0) {
          const versions = augmentFolders
            .map(folder => folder.replace(prefix, ''))
            .filter(v => semver.valid(v))
            .sort((a, b) => semver.rcompare(a, b));

          if (versions.length > 0) {
            return versions[0];
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
    return null;
  }

  async scanForExtension(extensionId) {
    const results = [];

    for (const { ide, config, command } of this.detectedIDEs) {
      let version = null;
      try {
        const extensionDir = this.getExtensionPath(ide);
        if (extensionDir) {
          version = await this.getExtensionVersionFromDir(extensionDir, extensionId);
        }

        if (!version) {
          try {
            const output = execSync(`${command} ${config.commands.listExtensions}`, {
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'ignore'],
              timeout: 10000
            });

            let match;
            if (ide === 'cursor' || ide === 'antigravity') {
              match = output.match(new RegExp(`${extensionId.replace('.', '\\.')}@(\\d+\\.\\d+\\.\\d+)`));
            } else {
              if (output.includes(extensionId)) {
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
          this.logger.success(`Found in ${config.name}: ${version}`);
        }
      } catch (error) {
        this.logger.warn(`${config.name} check failed: ${error.message}`);
      }

      results.push({ ide, config, command, version });
    }

    return results;
  }

  async installExtension(target, vsixPath, isDryRun = false) {
    const { config, command } = target;
    this.logger.info(`Installing extension in ${config.name}...`);

    if (isDryRun) {
      this.logger.warn(`DRY RUN: Would install in ${config.name}`);
      return true;
    }

    try {
      execSync(`${command} ${config.commands.installExtension} "${vsixPath}"`, {
        stdio: 'inherit',
        timeout: 60000,
        env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
      });
      this.logger.success(`Installed in ${config.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to install in ${config.name}: ${error.message}`);
      return false;
    }
  }
}

module.exports = IDEManager;

