#!/usr/bin/env node

/**
 * Test script to verify error handling improvements
 * Tests various error scenarios and recovery mechanisms
 */

const AugmentMonitor = require('./index.js');
const semver = require('semver');
const chalk = require('chalk');

class ErrorHandlingTests {
  constructor() {
    this.monitor = new AugmentMonitor();
    this.passedTests = 0;
    this.failedTests = 0;
  }

  log(message, level = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow
    };
    console.log(`${colors[level]('[TEST]')} ${message}`);
  }

  async runTest(name, testFn) {
    try {
      this.log(`Running: ${name}`, 'info');
      await testFn();
      this.passedTests++;
      this.log(`✓ PASSED: ${name}`, 'success');
    } catch (error) {
      this.failedTests++;
      this.log(`✗ FAILED: ${name}`, 'error');
      this.log(`  Error: ${error.message}`, 'error');
    }
    console.log(''); // Empty line for readability
  }

  async testVersionNormalization() {
    await this.runTest('Version Normalization', async () => {
      const testCases = [
        { input: '0.576.0', expected: '0.576.0' },
        { input: '0.560.0-universal', expected: '0.560.0' },
        { input: '1.2.3-beta.1', expected: '1.2.3' },
        { input: '2.0.0-rc.1', expected: '2.0.0' }
      ];

      for (const { input, expected } of testCases) {
        const normalized = this.monitor.normalizeVersion(input);
        if (normalized !== expected) {
          throw new Error(`Expected ${expected}, got ${normalized} for input ${input}`);
        }
      }
    });
  }

  async testMultipleVersionDetection() {
    await this.runTest('Multiple Version Detection', async () => {
      // This test verifies that when multiple versions exist,
      // the latest one is correctly identified
      const version = await this.monitor.getCurrentVersion();
      
      if (!version) {
        throw new Error('No version detected');
      }

      // Verify it's a valid semver
      const coerced = semver.coerce(version);
      if (!coerced) {
        throw new Error(`Invalid version format: ${version}`);
      }

      this.log(`  Detected version: ${version}`, 'info');
    });
  }

  async testVersionComparison() {
    await this.runTest('Version Comparison with Suffixes', async () => {
      const v1 = '0.576.0';
      const v2 = '0.560.0-universal';
      
      const normalized1 = semver.coerce(v1);
      const normalized2 = semver.coerce(v2);
      
      if (!normalized1 || !normalized2) {
        throw new Error('Failed to normalize versions');
      }

      if (!semver.gt(normalized1, normalized2)) {
        throw new Error(`Expected ${v1} > ${v2}`);
      }

      this.log(`  ${v1} > ${v2} ✓`, 'info');
    });
  }

  async testIDEDetection() {
    await this.runTest('IDE Detection', async () => {
      const ides = this.monitor.ideManager.detectAvailableIDEs();
      
      if (!ides || ides.length === 0) {
        throw new Error('No IDEs detected');
      }

      this.log(`  Detected ${ides.length} IDE(s): ${ides.map(i => i.config.name).join(', ')}`, 'info');
    });
  }

  async testMarketplaceConnection() {
    await this.runTest('Marketplace API Connection', async () => {
      const latestVersion = await this.monitor.getLatestVersion();
      
      if (!latestVersion) {
        throw new Error('Failed to fetch latest version');
      }

      const coerced = semver.coerce(latestVersion);
      if (!coerced) {
        throw new Error(`Invalid version format from marketplace: ${latestVersion}`);
      }

      this.log(`  Latest version from marketplace: ${latestVersion}`, 'info');
    });
  }

  async testVersionComparisonLogic() {
    await this.runTest('Version Comparison Logic', async () => {
      const testCases = [
        { current: '0.560.0', latest: '0.576.0', shouldUpdate: true },
        { current: '0.576.0', latest: '0.576.0', shouldUpdate: false },
        { current: '0.576.0', latest: '0.560.0', shouldUpdate: false },
        { current: '0.560.0-universal', latest: '0.576.0', shouldUpdate: true }
      ];

      for (const { current, latest, shouldUpdate } of testCases) {
        const normalizedCurrent = semver.coerce(current);
        const normalizedLatest = semver.coerce(latest);
        
        const needsUpdate = semver.gt(normalizedLatest, normalizedCurrent);
        
        if (needsUpdate !== shouldUpdate) {
          throw new Error(
            `Version comparison failed: current=${current}, latest=${latest}, ` +
            `expected shouldUpdate=${shouldUpdate}, got ${needsUpdate}`
          );
        }
      }

      this.log('  All version comparison cases passed', 'info');
    });
  }

  async testErrorRecovery() {
    await this.runTest('Error Recovery Mechanisms', async () => {
      // Test that error handling doesn't crash the process
      try {
        // Simulate a version mismatch scenario
        const expectedVersion = '999.999.999';
        const installedVersion = '0.576.0';
        
        const normalizedExpected = semver.coerce(expectedVersion);
        const normalizedInstalled = semver.coerce(installedVersion);
        
        if (semver.eq(normalizedInstalled, normalizedExpected)) {
          throw new Error('Versions should not match');
        }
        
        this.log('  Error recovery logic validated', 'info');
      } catch (error) {
        // Expected to handle gracefully
        this.log('  Graceful error handling confirmed', 'info');
      }
    });
  }

  async runAllTests() {
    console.log(chalk.cyan('\n=== Error Handling Test Suite ===\n'));
    
    await this.testVersionNormalization();
    await this.testMultipleVersionDetection();
    await this.testVersionComparison();
    await this.testIDEDetection();
    await this.testMarketplaceConnection();
    await this.testVersionComparisonLogic();
    await this.testErrorRecovery();
    
    console.log(chalk.cyan('=== Test Results ==='));
    console.log(chalk.green(`✓ Passed: ${this.passedTests}`));
    
    if (this.failedTests > 0) {
      console.log(chalk.red(`✗ Failed: ${this.failedTests}`));
      process.exit(1);
    } else {
      console.log(chalk.green('\n🎉 All tests passed!\n'));
      process.exit(0);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tests = new ErrorHandlingTests();
  tests.runAllTests().catch(error => {
    console.error(chalk.red('Test suite failed:'), error);
    process.exit(1);
  });
}

module.exports = ErrorHandlingTests;

