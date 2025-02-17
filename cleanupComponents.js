const fs = require('fs');
const path = require('path');
const serializeLisp = require('./serializeLisp');
const deserializeLisp = require('./deserializeLisp');

// Spinner frames for loading animation
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Creates a loading spinner with message
 * @param {string} message - The message to display
 * @returns {Object} - Object containing interval and update functions
 */
function createSpinner(message) {
    let frameIndex = 0;
    process.stdout.write(`\r${spinnerFrames[0]}  ${message}`);
    
    const interval = setInterval(() => {
        frameIndex = (frameIndex + 1) % spinnerFrames.length;
        process.stdout.write(`\r${spinnerFrames[frameIndex]} ${message}`);
    }, 80);

    return {
        interval,
        succeed: (component) => {
            clearInterval(interval);
            process.stdout.write(`\r✅  Removed component: ${component}\n`);
        },
        fail: (component, error) => {
            clearInterval(interval);
            process.stdout.write(`\r❌  Failed to remove component ${component} - ${error}\n`);
        }
    };
}

/**
 * Cleans up KiCad components that are no longer needed
 * @param {string} projectName - The project name used for symbol libs etc
 * @param {string} projectDir - The project directory path relative to baseDir (can be '.')
 * @param {string} baseDir - The base directory path
 */
async function cleanupComponents(projectName, projectDir, baseDir) {
    const projectPath = path.join(baseDir, projectDir);
    const componentsJsonPath = path.join(projectPath, 'components.json');
    const componentsTxtPath = path.join(projectPath, 'components.txt');
    const symLibPath = path.join(projectPath, `${projectName}.kicad_sym`);

    // Check if required files exist
    if (!fs.existsSync(componentsJsonPath)) {
        // console.error(`components.json not found in ${projectDir}`);
        return;
    }

    if (!fs.existsSync(componentsTxtPath)) {
        console.error(`components.txt not found in ${projectDir}`);
        return;
    }

    if (!fs.existsSync(symLibPath)) {
        console.error(`Symbol library ${projectName}.kicad_sym not found in ${projectDir}`);
        return;
    }

    // Read and parse the files
    let componentsJson;
    try {
        const rawJson = fs.readFileSync(componentsJsonPath, 'utf8');
        if (!rawJson.trim()) {
            return;
        }
        componentsJson = JSON.parse(rawJson);
    } catch (error) {
        console.error('Error parsing components.json:', error);
        return;
    }

    if (!componentsJson || Object.keys(componentsJson).length === 0 ||
        !componentsJson.components || !Array.isArray(componentsJson.components)) {
        componentsJson = { components: [] };
    }

    const activeComponents = new Set(
        fs.readFileSync(componentsTxtPath, 'utf8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
    );

    // Find components to remove
    const componentsToRemove = componentsJson.components.filter(
        component => !activeComponents.has(component.lcscId)
    );

    if (componentsToRemove.length === 0) {
        return;
    }

    // Read and parse the symbol library
    const symLibContent = fs.readFileSync(symLibPath, 'utf8');
    let symLib = deserializeLisp(symLibContent);

    for (const component of componentsToRemove) {
        const spinner = createSpinner(`Removing component: ${component.lcscId}...`);
        try {
            // Remove component files
            for (const filePath of component.files || []) {
                const fullPath = path.join(projectPath, filePath);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            }

            // Remove symbols from the library
            symLib = {
                ...symLib,
                items: symLib.items.filter(item => {
                    if (item.type !== 'list' || item.items.length < 2 ||
                        item.items[0].type !== 'atom' || item.items[0].value !== 'symbol') {
                        return true;
                    }
                    const symbolName = item.items[1].value.replace(/^"|"$/g, '');
                    return !(component.symbols || []).includes(symbolName);
                })
            };
            spinner.succeed(component.lcscId);
        } catch (error) {
            spinner.fail(component.lcscId, error.message);
        }
    }

    // Ensure the last item in the list has correct whitespace
    if (symLib.items.length > 0) {
        const lastItem = symLib.items[symLib.items.length - 1];
        if (lastItem.afterWs && lastItem.afterWs.includes('\n')) {
            lastItem.afterWs = '\n';
        }
    }

    // Write back the updated files
    fs.writeFileSync(symLibPath, serializeLisp(symLib));
    componentsJson.components = componentsJson.components.filter(
        component => !componentsToRemove.some(
            removeComponent => removeComponent.lcscId === component.lcscId
        )
    );
    fs.writeFileSync(componentsJsonPath, JSON.stringify(componentsJson, null, 2));
}

module.exports = cleanupComponents;