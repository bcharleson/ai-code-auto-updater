const { execSync } = require('child_process');
const fetch = require('node-fetch');
const semver = require('semver');
const Logger = require('../utils/logger');

class CLIManager {
  constructor() {
    this.logger = new Logger('CLI');
    this.supportedCLIs = {
      'claude-code': {
        name: 'Claude Code',
        npmPackage: '@anthropic-ai/claude-code',
        command: 'claude',
        description: 'Anthropic Claude Code - agentic coding in your terminal',
        icon: '🤖'
      },
      'gemini-cli': {
        name: 'Gemini CLI',
        npmPackage: '@google/gemini-cli',
        command: 'gemini',
        description: 'Google Gemini CLI - AI agent in your terminal',
        icon: '💎'
      }
    };

    this.detectedCLIs = [];
  }

  async detectInstalledCLIs() {
    this.logger.info('Detecting installed CLI tools...');
    const detected = [];

    for (const [id, config] of Object.entries(this.supportedCLIs)) {
      try {
        const version = await this.getInstalledVersion(config.npmPackage);
        if (version) {
          detected.push({ id, config, installedVersion: version });
          this.logger.success(`${config.name} detected: v${version}`);
        } else {
          this.logger.warn(`${config.name} not installed`);
        }
      } catch (error) {
        this.logger.warn(`${config.name} detection failed: ${error.message}`);
      }
    }

    this.detectedCLIs = detected;
    return detected;
  }

  async getInstalledVersion(npmPackage) {
    try {
      // Try to get version from npm list
      const output = execSync(`npm list -g ${npmPackage} --depth=0 --json 2>/dev/null`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });

      const data = JSON.parse(output);
      if (data.dependencies && data.dependencies[npmPackage]) {
        return data.dependencies[npmPackage].version;
      }
    } catch (error) {
      // Try alternative method using npm show
      try {
        const output = execSync(`npm list -g ${npmPackage} 2>/dev/null | grep ${npmPackage}`, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore']
        });
        const match = output.match(/@(\d+\.\d+\.\d+)/);
        if (match) return match[1];
      } catch (e) {
        // Not installed
      }
    }

    return null;
  }

  async getLatestVersion(npmPackage) {
    try {
      this.logger.info(`Fetching latest version of ${npmPackage}...`);

      // Try npm registry API first
      const response = await fetch(`https://registry.npmjs.org/${npmPackage}/latest`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ai-code-updater/2.0.0'
        },
        timeout: 10000
      });

      if (response.ok) {
        const data = await response.json();
        this.logger.info(`Latest version: ${data.version}`);
        return data.version;
      }

      // Fallback to npm show command
      const output = execSync(`npm show ${npmPackage} version`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      const version = output.trim();
      this.logger.info(`Latest version (via npm): ${version}`);
      return version;
    } catch (error) {
      this.logger.error(`Failed to get latest version: ${error.message}`);
      throw error;
    }
  }

  async checkAllForUpdates() {
    const results = [];

    for (const cli of this.detectedCLIs) {
      try {
        const latestVersion = await this.getLatestVersion(cli.config.npmPackage);
        const needsUpdate = semver.gt(latestVersion, cli.installedVersion);

        results.push({
          ...cli,
          latestVersion,
          needsUpdate
        });
      } catch (error) {
        results.push({
          ...cli,
          latestVersion: null,
          needsUpdate: false,
          error: error.message
        });
      }
    }

    return results;
  }

  async updateCLI(cli, isDryRun = false) {
    const { config } = cli;
    this.logger.info(`Updating ${config.name}...`);

    if (isDryRun) {
      this.logger.warn(`DRY RUN: Would update ${config.name} to latest`);
      return { success: true, dryRun: true };
    }

    try {
      // Use npm update with --global flag
      this.logger.info(`Running: npm install -g ${config.npmPackage}@latest`);
      
      execSync(`npm install -g ${config.npmPackage}@latest`, {
        stdio: 'inherit',
        timeout: 120000 // 2 minutes timeout for npm install
      });

      // Verify the update
      const newVersion = await this.getInstalledVersion(config.npmPackage);
      this.logger.success(`${config.name} updated to v${newVersion}`);

      return { success: true, newVersion };
    } catch (error) {
      this.logger.error(`Failed to update ${config.name}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async installCLI(cliId, isDryRun = false) {
    const config = this.supportedCLIs[cliId];
    if (!config) {
      throw new Error(`Unknown CLI: ${cliId}`);
    }

    this.logger.info(`Installing ${config.name}...`);

    if (isDryRun) {
      this.logger.warn(`DRY RUN: Would install ${config.name}`);
      return { success: true, dryRun: true };
    }

    try {
      execSync(`npm install -g ${config.npmPackage}`, {
        stdio: 'inherit',
        timeout: 120000
      });

      const version = await this.getInstalledVersion(config.npmPackage);
      this.logger.success(`${config.name} installed: v${version}`);

      return { success: true, version };
    } catch (error) {
      this.logger.error(`Failed to install ${config.name}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  getAvailableCLIs() {
    return Object.entries(this.supportedCLIs).map(([id, config]) => ({
      id,
      ...config
    }));
  }
}

module.exports = CLIManager;

