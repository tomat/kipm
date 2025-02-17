// svg_path_parser.js

// -------------------- Class Definitions --------------------

class SvgPathMoveTo {
    constructor({ start_x, start_y }) {
        this.start_x = parseFloat(start_x);
        this.start_y = parseFloat(start_y);
    }
    static get fields() {
        return ["start_x", "start_y"];
    }
}

class SvgPathLineTo {
    constructor({ pos_x, pos_y }) {
        this.pos_x = parseFloat(pos_x);
        this.pos_y = parseFloat(pos_y);
    }
    static get fields() {
        return ["pos_x", "pos_y"];
    }
}

class SvgPathEllipticalArc {
    constructor({
                    radius_x,
                    radius_y,
                    x_axis_rotation,
                    flag_large_arc,
                    flag_sweep,
                    end_x,
                    end_y,
                }) {
        this.radius_x = parseFloat(radius_x);
        this.radius_y = parseFloat(radius_y);
        this.x_axis_rotation = parseFloat(x_axis_rotation);
        // Convert flag values to booleans
        this.flag_large_arc = flag_large_arc === "1" || flag_large_arc === 1;
        this.flag_sweep = flag_sweep === "1" || flag_sweep === 1;
        this.end_x = parseFloat(end_x);
        this.end_y = parseFloat(end_y);
    }
    static get fields() {
        return [
            "radius_x",
            "radius_y",
            "x_axis_rotation",
            "flag_large_arc",
            "flag_sweep",
            "end_x",
            "end_y",
        ];
    }
}

class SvgPathClosePath {
    constructor() {
        // No properties
    }
    static get fields() {
        return [];
    }
}

// -------------------- Handlers Mapping --------------------

const svgPathHandlers = {
    "M": [SvgPathMoveTo, 2],
    "A": [SvgPathEllipticalArc, 7],
    "L": [SvgPathLineTo, 2],
    "Z": [SvgPathClosePath, 0],
};

// -------------------- Parsing Function --------------------

/**
 * Parses an SVG path string into an array of command objects.
 * @param {string} svgPath - The SVG path string.
 * @returns {Array<Object>} An array of command objects.
 */
function parseSvgPath(svgPath) {
    // Ensure the path ends with a space
    if (!svgPath.endsWith(" ")) {
        svgPath += " ";
    }
    // Replace commas with spaces
    svgPath = svgPath.replace(/,/g, " ");

    // Use regex to match command letters followed by their arguments.
    // The regex matches a letter and a group of characters (digits, spaces, plus, minus, dots).
    const regex = /([a-zA-Z])([ ,\-\+.\d]+)/g;
    const matches = svgPath.matchAll(regex);
    const parsedPath = [];

    for (const match of matches) {
        const command = match[1];
        const argStr = match[2];
        if (svgPathHandlers.hasOwnProperty(command)) {
            const [CmdClass, nbArgs] = svgPathHandlers[command];
            // Split arguments on whitespace (ignoring extra spaces)
            const args = argStr.trim().split(/\s+/);
            if (nbArgs === 0) {
                // For commands like "Z" with no arguments.
                parsedPath.push(new CmdClass());
            } else {
                // Process groups of nbArgs arguments.
                for (let i = 0; i < args.length; i += nbArgs) {
                    // Create an object mapping field names to corresponding argument values.
                    const fields = CmdClass.fields;
                    const obj = {};
                    for (let j = 0; j < nbArgs; j++) {
                        // Use undefined if there are not enough arguments.
                        obj[fields[j]] = args[i + j];
                    }
                    parsedPath.push(new CmdClass(obj));
                }
            }
        } else {
            console.warn(`SVG command "${command}" not supported`);
        }
    }
    return parsedPath;
}

module.exports = {
    parseSvgPath,
    SvgPathMoveTo,
    SvgPathLineTo,
    SvgPathEllipticalArc,
    SvgPathClosePath,
};