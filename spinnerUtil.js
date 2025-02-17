const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Creates a loading spinner with message
 * @param {string} message - The message to display
 * @returns {Object} - Object containing interval and update functions
 */
function createSpinner(message) {
    let frameIndex = 0;
    process.stdout.write(`\r${spinnerFrames[0]} ${message}`);
    
    const interval = setInterval(() => {
        frameIndex = (frameIndex + 1) % spinnerFrames.length;
        process.stdout.write(`\r${spinnerFrames[frameIndex]} ${message}`);
    }, 80);

    return {
        interval,
        succeed: (id, details = {}) => {
            clearInterval(interval);
            
            let message = `✅  Installed ${id}`;
            
            if (details.symbolName) {
                message += ` (${details.symbolName})`;
            }
            
            const counts = [];
            if (details.footprintCount > 0) {
                counts.push(`${details.footprintCount} footprint${details.footprintCount > 1 ? 's' : ''}`);
            }
            if (details.modelCount > 0) {
                counts.push(`${details.modelCount} 3D model${details.modelCount > 1 ? 's' : ''}`);
            }
            
            if (counts.length > 0) {
                message += ` with ${counts.join(', ')}`;
            }
            
            process.stdout.write(`\r${message}\n`);
        },
        update: (newMessage) => {
            process.stdout.write(`\r${spinnerFrames[frameIndex]} ${newMessage}`);
        },
        clear: () => {
            clearInterval(interval);
            process.stdout.write('\r' + ' '.repeat(process.stdout.columns - 1) + '\r');
        },
        fail: (id, error) => {
            clearInterval(interval);
            process.stdout.write(`\r❌  Failed to install ${id} - ${error}\n`);
        }
    };
}

module.exports = { createSpinner };