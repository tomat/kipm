const fs = require('fs');

function setLogger(logFile, logLevel) {
  const log = (...args) => {
    const message = args.map(String).join(' ');
    console.log(message);
    if (logFile) {
      fs.appendFileSync(logFile, message + '\n');
    }
  };
  return {
    debug: (...args) => logLevel === 'debug' && log(...args),
    info: (...args) => ['info', 'debug'].includes(logLevel) && log(...args),
    warn: (...args) => ['warn', 'info', 'debug'].includes(logLevel) && log(...args),
    error: (...args) => log(...args),
  };
}

module.exports = { setLogger };