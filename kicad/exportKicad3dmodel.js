// export_kicad_3dmodel.js

const fs = require("fs");

// Import the EasyEDA and KiCad 3D model classes
const { Ee3dModel } = require("../easyeda/parametersEasyeda");
const { Ki3dModel } = require("./parametersKicadFootprint");

const djs = require('decimal.js');
const Decimal = djs.set({ precision: 8, rounding: djs.ROUND_HALF_EVEN });

// --- Constants ---
const VRML_HEADER = `#VRML V2.0 utf8
# 3D model generated by easyeda2kicad.py (https://github.com/uPesy/easyeda2kicad.py)
`;

// --- Helper Functions ---

function pythonRound(num, ndigits = 0) {
    const factor = Math.pow(10, ndigits);
    const n = num * factor;
    const floorN = Math.floor(n);
    const diff = n - floorN;
    const eps = 1e-12; // tolerance for floating point precision

    // Check if n is exactly halfway (within a tolerance)
    if (Math.abs(diff - 0.5) < eps) {
        // For halfway cases, round to even.
        // If floorN is even, keep it; otherwise, round up.
        if (floorN % 2 === 0) {
            return floorN / factor;
        } else {
            return (floorN + 1) / factor;
        }
    } else {
        // For all other cases, use standard Math.round (which is round half up).
        return Math.round(n) / factor;
    }
}

/**
 * Parses material definitions from the .obj file data.
 * @param {string} objData - The raw OBJ file data.
 * @returns {Object} An object mapping material IDs to material properties.
 */
function getMaterials(objData) {
    // Use a regex that matches from "newmtl" until "endmtl" (DOTALL)
    const materialRegex = /newmtl[\s\S]*?endmtl/g;
    const matches = objData.match(materialRegex) || [];
    const materials = {};
    for (const match of matches) {
        const material = {};
        const lines = match.split(/\r?\n/);
        let materialId = "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("newmtl")) {
                const parts = trimmed.split(/\s+/);
                materialId = parts[1];
            } else if (trimmed.startsWith("Ka")) {
                material["ambient_color"] = trimmed.split(/\s+/).slice(1);
            } else if (trimmed.startsWith("Kd")) {
                material["diffuse_color"] = trimmed.split(/\s+/).slice(1);
            } else if (trimmed.startsWith("Ks")) {
                material["specular_color"] = trimmed.split(/\s+/).slice(1);
            } else if (trimmed.startsWith("d")) {
                material["transparency"] = trimmed.split(/\s+/)[1];
            }
        }
        if (materialId) {
            materials[materialId] = material;
        }
    }
    return materials;
}

/**
 * Extracts vertices from the .obj file data.
 * Divides each coordinate by 2.54 and rounds to 4 decimal places.
 * Ensures that whole numbers are represented with a trailing .0,
 * and preserves negative zero as "-0.0" like Python.
 * @param {string} objData - The raw OBJ file data.
 * @returns {string[]} An array of vertex strings.
 */
function getVertices(objData) {
    const vertices = [];
    const regex = /v (.*?)\n/g;
    let match;
    while ((match = regex.exec(objData)) !== null) {
        const coords = match[1].split(/\s+/);
        const rounded = coords
          .map((coord) => {
              const intPartIsEven = new Decimal(coord / 2.54).truncated().mod(2).eq(0);

              if (!intPartIsEven) {
                  const numDec = new Decimal(coord / 2.54);
                  const num = numDec.toFixed(4, Decimal.ROUND_HALF_EVEN);
                  const roundedNum = +num;
                  // Check for negative zero first.
                  if (numDec.isNeg() && +numDec.abs() === 0) {
                      return "-0.0";
                  }
                  // If integer, force one decimal place.
                  if (Number.isInteger(roundedNum)) {
                      return ((+num).toFixed(1));
                  }

                  return pythonRound(coord / 2.54, 4);
              }
              const numDec = new Decimal(coord / 2.54);
              const num = numDec.toFixed(4, Decimal.ROUND_HALF_EVEN);
              const roundedNum = +num;
              // Check for negative zero first.
              if (numDec.isNeg() && +numDec.abs() === 0) {
                  return "-0.0";
              }
              const res = (coord / 2.54).toFixed(4).replace(/\.?0+$/, '');

              // If integer, force one decimal place.
              if (Number.isInteger(+res)) {
                  return ((+res).toFixed(1));
              }

              if (+coord < 0 && +res === 0) {
                  return '-0.0';
              }

              return res;
          })
          .join(" ");
        vertices.push(rounded);
    }
    return vertices;
}

/**
 * Converts an EasyEDA 3D model (in OBJ format) into a KiCad WRL model.
 * @param {Ee3dModel} model3d - The EasyEDA 3D model.
 * @returns {Ki3dModel} A new Ki3dModel instance with the WRL data.
 */
function generateWrlModel(model3d) {
    const materials = getMaterials(model3d.raw_obj);
    const vertices = getVertices(model3d.raw_obj);

    let rawWrl = VRML_HEADER;
    // Split the OBJ data into shapes using "usemtl" as delimiter.
    const shapes = model3d.raw_obj.split("usemtl").slice(1);
    for (const shape of shapes) {
        const lines = shape.split(/\r?\n/);
        // The first line holds the material info (remove extra spaces)
        const matKey = lines[0].trim();
        const material = materials[matKey];
        let indexCounter = 0;
        const linkDict = {};
        const coordIndex = [];
        const points = [];
        // Process each subsequent non-empty line as a face.
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length > 0) {
                // Remove double slashes and split; skip the first element.
                const parts = line.replace(/\/\//g, " ").split(/\s+/).slice(1);
                // Convert to integers
                const face = parts.map((x) => parseInt(x, 10));
                const faceIndex = [];
                for (const index of face) {
                    if (!(index in linkDict)) {
                        if (vertices[index - 1]) {
                            linkDict[index] = indexCounter;
                            faceIndex.push(indexCounter.toString());
                            // OBJ indices are 1-based.
                            points.push(vertices[index - 1]);
                            indexCounter++;
                        }
                    } else {
                        faceIndex.push(linkDict[index].toString());
                    }
                }
                faceIndex.push("-1");
                coordIndex.push(faceIndex.join(",") + ",");
            }
        }
        // Duplicate the last point by inserting a copy before the last element.
        if (points.length > 0) {
            points.splice(points.length - 1, 0, points[points.length - 1]);
        }

        // Build the WRL shape string using a template literal.
        const shapeStr = `
Shape{
    appearance Appearance {
        material  Material \t{
            diffuseColor ${material.diffuse_color.join(" ")}
            specularColor ${material.specular_color.join(" ")}
            ambientIntensity 0.2
            transparency 0
            shininess 0.5
        }
    }
    geometry IndexedFaceSet {
        ccw TRUE
        solid FALSE
        coord DEF co Coordinate {
            point [
                ${points.join(", ")}
            ]
        }
        coordIndex [
            ${coordIndex.join("")}
        ]
    }
}`;
        rawWrl += shapeStr;
    }
    // Return a new Ki3dModel instance (with null translations/rotations).
    return new Ki3dModel({
        name: model3d.name,
        translation: null,
        rotation: null,
        raw_wrl: rawWrl,
    });
}

// -------------------- Exporter Class --------------------

class Exporter3dModelKicad {
    /**
     * @param {Ee3dModel} model3d - The EasyEDA 3D model.
     */
    constructor(model3d) {
        this.input = model3d;
        this.output =
            model3d && model3d.raw_obj ? generateWrlModel(model3d) : null;
        this.output_step = model3d.step;
    }

    /**
     * Gets the WRL content without writing to a file.
     * @returns {string|null} The WRL content or null if no WRL data exists.
     */
    getWrlContent() {
        return this.output ? this.output.raw_wrl : null;
    }

    /**
     * Gets the STEP content without writing to a file.
     * @returns {Buffer|null} The STEP content as a Buffer or null if no STEP data exists.
     */
    getStepContent() {
        return this.output_step ? Buffer.from(this.output_step) : null;
    }

    /**
     * Gets both WRL and STEP content in a structured format.
     * @returns {Object} Object containing name, wrl and step content
     */
    getAllContent() {
        return {
            name: this.output ? this.output.name : null,
            wrl: this.getWrlContent(),
            step: this.getStepContent()
        };
    }

    /**
     * Exports the WRL and STEP files to the given library path.
     * @param {string} libPath - The base path where files will be written.
     */
    export(libPath) {
        if (this.output) {
            fs.writeFileSync(
                `${libPath}.3dshapes/${this.output.name}.wrl`,
                this.output.raw_wrl,
                { encoding: "utf-8" }
            );
        }
        if (this.output_step) {
            fs.writeFileSync(
                `${libPath}.3dshapes/${this.output.name}.step`,
                Buffer.from(this.output_step),
                { encoding: "binary" }
            );
        }
    }
}

module.exports = {
    generateWrlModel,
    Exporter3dModelKicad,
};