// helpers.js

const fs = require("fs");
const os = require("os");
const path = require("path");
const { exec } = require("child_process"); // if needed
const { __version__ } = require("./__version__"); // adjust as needed
const { KicadVersion, sanitize_fields } = require("./kicad/parametersKicadSymbol");

// --- Regular Expression Patterns ---
const symLibRegexPattern = {
  v5: "(#\\n# {component_name}\\n#\\n.*?ENDDEF\\n)",
  v6: '\\n  \\(symbol "{component_name}".*?\\n  \\)',
  v6_99: "",
};

// --- Logger Setup ---
/**
 * Sets up logging by writing to a file (if provided) and to the console.
 * For simplicity, we use console logging here.
 * @param {string|null} logFile - Path to log file or null.
 * @param {string|number} logLevel - Logging level ("debug", "info", etc.).
 */
function setLogger(logFile, logLevel) {
  // In this simple implementation, we simply print to the console.
  // For file logging, you might integrate a logging library like "winston".
  const level = typeof logLevel === "number" ? logLevel : logLevel.toLowerCase();
  console.log(`[Logger] Setting log level to ${level}`);
  if (logFile) {
    console.log(`[Logger] Logging to file: ${logFile}`);
    // You could create a write stream here if desired.
  }
}

/**
 * Escapes regex special characters in the given field.
 * @param {string} field - The string to escape.
 * @returns {string} The escaped string.
 */
function sanitizeForRegex(field) {
  return field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if a component is already present in the symbol library.
 * @param {string} libPath - Path to the symbol library file.
 * @param {string} componentName - Component name to search for.
 * @param {object} kicadVersion - The KiCad version (expects an object with a "name" property).
 * @returns {boolean} True if found; otherwise false.
 */
function idAlreadyInSymbolLib(libPath, componentName, kicadVersion) {
  const currentLib = fs.readFileSync(libPath, { encoding: "utf-8" });
  const patternStr = symLibRegexPattern[kicadVersion].replace(
    "{component_name}",
    sanitizeForRegex(componentName)
  );
  // Use the dotAll flag "s" (supported in modern Node versions)
  const regex = new RegExp(patternStr, "s");
  const component = currentLib.match(regex);
  if (component && component.length > 0) {
    console.warn(`This id is already in ${libPath}`);
    return true;
  }
  return false;
}

/**
 * Updates a component in the symbol library file.
 * @param {string} libPath - Path to the symbol library file.
 * @param {string} componentName - The component's name.
 * @param {string} componentContent - The new component content.
 * @param {object} kicadVersion - The KiCad version.
 */
function updateComponentInSymbolLibFile(libPath, componentName, componentContent, kicadVersion) {
  let currentLib = fs.readFileSync(libPath, { encoding: "utf-8" });
  const patternStr = symLibRegexPattern[kicadVersion.name].replace(
    "{component_name}",
    sanitizeForRegex(componentName)
  );
  const regex = new RegExp(patternStr, "s");
  let newLib = currentLib.replace(regex, componentContent);
  newLib = newLib.replace(
    "(generator kicad_symbol_editor)",
    "(generator https://github.com/uPesy/easyeda2kicad.py)"
  );
  fs.writeFileSync(libPath, newLib, { encoding: "utf-8" });
}

/**
 * Adds a new component to the symbol library file.
 * @param {string} libPath - Path to the symbol library file.
 * @param {string} componentContent - Content to add.
 * @param {object} kicadVersion - The KiCad version.
 */
function addComponentInSymbolLibFile(libPath, componentContent, kicadVersion) {
  if (kicadVersion === "v5") {
    fs.appendFileSync(libPath, componentContent, { encoding: "utf-8" });
  } else if (kicadVersion === "v6") {
    // Read the file as a Buffer.
    let libData = fs.readFileSync(libPath);
    // Remove the last two bytes (assumes these are "\n)" in UTF-8).
    let truncated = libData.slice(0, libData.length - 2);
    let newContent = Buffer.concat([
      truncated,
      Buffer.from(componentContent, "utf-8"),
      Buffer.from("\n)", "utf-8"),
    ]);
    fs.writeFileSync(libPath, newContent);
    // Update the generator string.
    let newLibData = fs.readFileSync(libPath, { encoding: "utf-8" });
    newLibData = newLibData.replace(
      "(generator kicad_symbol_editor)",
      "(generator https://github.com/uPesy/easyeda2kicad.py)"
    );
    fs.writeFileSync(libPath, newLibData, { encoding: "utf-8" });
  }
}

/**
 * Retrieves the local configuration from "easyeda2kicad_config.json".
 * If the file does not exist, it creates one.
 * @returns {object} The local configuration.
 */
function getLocalConfig() {
  const configPath = "easyeda2kicad_config.json";
  if (!fs.existsSync(configPath)) {
    const config = {
      updated_at: Date.now() / 1000, // current UTC timestamp in seconds
      version: __version__,
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4), { encoding: "utf-8" });
    console.info("Created easyeda2kicad_config.json config file");
  }
  const localConf = JSON.parse(fs.readFileSync(configPath, { encoding: "utf-8" }));
  return localConf;
}

/**
 * Computes the center of an arc given the start/end points, rotation direction, and radius.
 * @param {number} start_x
 * @param {number} start_y
 * @param {number} end_x
 * @param {number} end_y
 * @param {number} rotation_direction - Typically +1 or -1.
 * @param {number} radius
 * @returns {[number, number]} [center_x, center_y]
 */
function getArcCenter(start_x, start_y, end_x, end_y, rotation_direction, radius) {
  const arcDistance = Math.sqrt((end_x - start_x) ** 2 + (end_y - start_y) ** 2);
  const m_x = (start_x + end_x) / 2;
  const m_y = (start_y + end_y) / 2;
  const u = (end_x - start_x) / arcDistance;
  const v = (end_y - start_y) / arcDistance;
  const h = Math.sqrt(radius * radius - (arcDistance * arcDistance) / 4);
  const center_x = m_x - rotation_direction * h * v;
  const center_y = m_y + rotation_direction * h * u;
  return [center_x, center_y];
}

/**
 * Computes the end angle of an arc.
 * @param {number} center_x
 * @param {number} end_x
 * @param {number} radius
 * @param {boolean} flag_large_arc
 * @returns {number} The computed angle (in degrees).
 */
function getArcAngleEnd(center_x, end_x, radius, flag_large_arc) {
  const theta = Math.acos((end_x - center_x) / radius) * 180 / Math.PI;
  // Note: Both branches return the same value in the original code.
  return 180 + theta;
}

/**
 * Computes the middle point of an arc.
 * @param {number} center_x
 * @param {number} center_y
 * @param {number} radius
 * @param {number} angle_start - in radians.
 * @param {number} angle_end - in radians.
 * @returns {[number, number]} [middle_x, middle_y]
 */
function getMiddleArcPos(center_x, center_y, radius, angle_start, angle_end) {
  const middle_x = center_x + radius * Math.cos((angle_start + angle_end) / 2);
  const middle_y = center_y + radius * Math.sin((angle_start + angle_end) / 2);
  return [middle_x, middle_y];
}

// --- Exports ---
module.exports = {
  setLogger,
  sanitizeForRegex,
  idAlreadyInSymbolLib,
  updateComponentInSymbolLibFile,
  addComponentInSymbolLibFile,
  getLocalConfig,
  getArcCenter,
  getArcAngleEnd,
  getMiddleArcPos,
};