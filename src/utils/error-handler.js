const fs = require('fs');
const path = require('path');

class ErrorHandler {
  constructor() {
    this.retryDefaults = {
      maxAttempts: 3,
      delayMs: 1000,
      backoffMultiplier: 2
    };
    
    this.commonErrors = {
      ENOENT: {
        message: 'File or directory not found',
        suggestion: 'Check if the path exists and you have proper permissions'
      },
      EACCES: {
        message: 'Permission denied',
        suggestion: 'Try running with elevated permissions or check file ownership'
      },
      EBUSY: {
        message: 'Resource busy or locked',
        suggestion: 'Close any applications that may be using this file (iCloud sync may be in progress)'
      },
      EPERM: {
        message: 'Operation not permitted',
        suggestion: 'Check system permissions or try running with sudo'
      },
      ETIMEDOUT: {
        message: 'Connection timed out',
        suggestion: 'Check your internet connection and try again'
      },
      ENOTFOUND: {
        message: 'DNS lookup failed',
        suggestion: 'Check your internet connection'
      },
      ECONNREFUSED: {
        message: 'Connection refused',
        suggestion: 'The server may be down, try again later'
      },
      ECONNRESET: {
        message: 'Connection reset',
        suggestion: 'Network instability - try again'
      }
    };
  }

  /**
   * Wraps an async function with retry logic
   */
  async withRetry(fn, options = {}) {
    const { maxAttempts, delayMs, backoffMultiplier, onRetry } = {
      ...this.retryDefaults,
      ...options
    };

    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn(attempt);
      } catch (error) {
        lastError = error;
        
        if (attempt < maxAttempts) {
          const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
          
          if (onRetry) {
            onRetry(attempt, maxAttempts, error, delay);
          }
          
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Helper to sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets a user-friendly error message
   */
  getFriendlyMessage(error) {
    const code = error.code || error.errno;
    const knownError = this.commonErrors[code];
    
    if (knownError) {
      return {
        code,
        message: knownError.message,
        suggestion: knownError.suggestion,
        original: error.message
      };
    }

    // Check for iCloud-specific issues
    if (this.isICloudError(error)) {
      return {
        code: 'ICLOUD_SYNC',
        message: 'iCloud sync issue detected',
        suggestion: 'Wait for iCloud to finish syncing, or move the application out of iCloud Drive',
        original: error.message
      };
    }

    // Check for network errors
    if (this.isNetworkError(error)) {
      return {
        code: 'NETWORK',
        message: 'Network error',
        suggestion: 'Check your internet connection and try again',
        original: error.message
      };
    }

    return {
      code: code || 'UNKNOWN',
      message: error.message || 'An unexpected error occurred',
      suggestion: 'Try again or check the logs for more details',
      original: error.message
    };
  }

  /**
   * Checks if error is related to iCloud sync
   */
  isICloudError(error) {
    const iCloudIndicators = [
      'com.apple.bird',
      'CloudDocs',
      'iCloud',
      'Library/Mobile Documents',
      'CloudKit',
      '.icloud'
    ];
    
    const errorStr = (error.message || '') + (error.path || '');
    return iCloudIndicators.some(indicator => errorStr.includes(indicator));
  }

  /**
   * Checks if error is network-related
   */
  isNetworkError(error) {
    const networkCodes = ['ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EAI_AGAIN'];
    return networkCodes.includes(error.code) || 
           (error.message && error.message.toLowerCase().includes('network'));
  }

  /**
   * Checks if a path is in iCloud Drive
   */
  isInICloudDrive(filePath) {
    const normalizedPath = path.normalize(filePath);
    return normalizedPath.includes('Library/Mobile Documents') ||
           normalizedPath.includes('iCloud Drive') ||
           normalizedPath.includes('CloudDocs');
  }

  /**
   * Waits for iCloud file to be available
   */
  async waitForICloudFile(filePath, timeoutMs = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        // Check for .icloud placeholder file
        const icloudPath = filePath.replace(/([^/]+)$/, '.$1.icloud');
        
        if (fs.existsSync(icloudPath)) {
          // File is still downloading from iCloud
          await this.sleep(1000);
          continue;
        }
        
        // Check if file exists and is accessible
        const stat = fs.statSync(filePath);
        if (stat.size > 0) {
          return true;
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      await this.sleep(500);
    }
    
    return false;
  }

  /**
   * Safely reads a file with iCloud handling
   */
  async safeReadFile(filePath, encoding = 'utf8') {
    // If in iCloud, wait for sync
    if (this.isInICloudDrive(filePath)) {
      await this.waitForICloudFile(filePath);
    }

    return this.withRetry(async () => {
      return fs.readFileSync(filePath, encoding);
    }, {
      maxAttempts: 3,
      delayMs: 500
    });
  }

  /**
   * Safely writes a file with proper error handling
   */
  async safeWriteFile(filePath, data) {
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return this.withRetry(async () => {
      fs.writeFileSync(filePath, data);
      return true;
    }, {
      maxAttempts: 3,
      delayMs: 500
    });
  }

  /**
   * Checks if the environment is suitable for running
   */
  async checkEnvironment() {
    const issues = [];

    // Check Node version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    if (majorVersion < 14) {
      issues.push({
        type: 'warning',
        message: `Node.js version ${nodeVersion} detected. Version 14+ is recommended.`
      });
    }

    // Check if running from iCloud Drive
    const currentDir = process.cwd();
    if (this.isInICloudDrive(currentDir)) {
      issues.push({
        type: 'warning',
        message: 'Running from iCloud Drive detected. This may cause sync issues.',
        suggestion: 'Consider moving the application to a local directory.'
      });
    }

    // Check network connectivity
    try {
      const fetch = require('node-fetch');
      await Promise.race([
        fetch('https://registry.npmjs.org/', { method: 'HEAD' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
    } catch (error) {
      issues.push({
        type: 'error',
        message: 'Network connectivity issue detected.',
        suggestion: 'Check your internet connection.'
      });
    }

    return issues;
  }

  /**
   * Formats an error for display
   */
  formatError(error, verbose = false) {
    const friendly = this.getFriendlyMessage(error);
    
    let message = `Error: ${friendly.message}`;
    
    if (friendly.suggestion) {
      message += `\n  Suggestion: ${friendly.suggestion}`;
    }
    
    if (verbose && friendly.original !== friendly.message) {
      message += `\n  Details: ${friendly.original}`;
    }
    
    return message;
  }
}

module.exports = ErrorHandler;

