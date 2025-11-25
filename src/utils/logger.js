const chalk = require('chalk');

class Logger {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const color = this.colors[level] || chalk.white;
    const prefixStr = this.prefix ? `[${this.prefix}] ` : '';
    console.log(`[${timestamp}] ${color(level.toUpperCase())}: ${prefixStr}${message}`);
  }

  info(message) {
    this.log(message, 'info');
  }

  success(message) {
    this.log(message, 'success');
  }

  warn(message) {
    this.log(message, 'warning');
  }

  error(message) {
    this.log(message, 'error');
  }

  divider(char = '─', length = 60) {
    console.log(chalk.gray(char.repeat(length)));
  }

  header(text) {
    console.log('\n' + chalk.cyan(text));
  }

  table(headers, rows) {
    this.divider();
    console.log(headers.map(h => chalk.bold(h)).join(' | '));
    this.divider();
    rows.forEach(row => console.log(row.join(' | ')));
    this.divider();
  }
}

module.exports = Logger;

