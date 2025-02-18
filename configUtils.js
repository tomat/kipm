const os = require('os');
const path = require('path');
const { exec } = require('child_process');

function getLocalConfig() {
  return new Promise((resolve, reject) => {
    const platform = os.platform();
    const defaultPaths = {
      linux: path.join(os.homedir(), '.config', 'kicad'),
      darwin: path.join(os.homedir(), 'Library', 'Preferences', 'kicad'),
      win32: path.join(os.homedir(), 'AppData', 'Roaming', 'kicad'),
    };

    if (platform in defaultPaths) {
      resolve({ kicadConfigPath: defaultPaths[platform] });
    } else {
      exec('kicad --version', (error, stdout, stderr) => {
        if (error) {
          reject(new Error('Could not determine KiCad config path'));
        } else {
          resolve({ kicadConfigPath: path.join(os.homedir(), '.config', 'kicad') });
        }
      });
    }
  });
}

module.exports = { getLocalConfig };