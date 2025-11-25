const { execSync } = require('child_process');

class NotificationManager {
  constructor(isDryRun = false) {
    this.isDryRun = isDryRun;
  }

  async sendNative(title, message, buttons = ['OK']) {
    try {
      if (this.isDryRun) {
        console.log(`DRY RUN: Would send notification: ${title} - ${message}`);
        return 'OK';
      }

      if (process.platform !== 'darwin') {
        // For non-macOS, just log
        console.log(`[Notification] ${title}: ${message}`);
        return buttons[0];
      }

      const buttonList = buttons.map(b => `"${b}"`).join(', ');
      const escapedMessage = message.replace(/"/g, '\\"').replace(/'/g, "'\\''");
      const escapedTitle = title.replace(/"/g, '\\"');
      
      const script = `display dialog "${escapedMessage}" with title "${escapedTitle}" buttons {${buttonList}} default button "${buttons[buttons.length - 1]}" with icon note`;

      const result = execSync(`osascript -e '${script}'`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });

      const match = result.match(/button returned:(.+)$/);
      return match ? match[1].trim() : buttons[0];
    } catch (error) {
      console.log(`Notification failed: ${error.message}`);
      return null;
    }
  }

  async showSimple(title, message) {
    if (this.isDryRun) {
      console.log(`DRY RUN: Simple notification: ${title} - ${message}`);
      return;
    }

    if (process.platform === 'darwin') {
      try {
        const escapedMessage = message.replace(/"/g, '\\"');
        const escapedTitle = title.replace(/"/g, '\\"');
        execSync(`osascript -e 'display notification "${escapedMessage}" with title "${escapedTitle}"'`, {
          stdio: 'ignore'
        });
      } catch (error) {
        // Silently fail
      }
    }
  }
}

module.exports = NotificationManager;

