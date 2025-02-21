// easyeda_importer.js
const OBJFile = require('obj-file-parser');

const { EasyedaApi } = require("./easyedaApi");
const { mat4, vec3, glMatrix, quat } = require("gl-matrix");
const {
    EeSymbol,
    EeSymbolInfo,
    EeSymbolBbox,
    EeSymbolPinSettings,
    EeSymbolPinDot,
    EeSymbolPinPath,
    EeSymbolPinName,
    EeSymbolPinDotBis,
    EeSymbolPinClock,
    EeSymbolPin,
    EeSymbolRectangle,
    EeSymbolPolyline,
    EeSymbolPolygon,
    EeSymbolPath,
    EeSymbolCircle,
    EeSymbolEllipse,
    EeSymbolArc,
    // Footprint models:
    EeFootprintInfo,
    EeFootprintBbox,
    EeFootprintPad,
    EeFootprintTrack,
    EeFootprintHole,
    EeFootprintVia,
    EeFootprintCircle,
    EeFootprintRectangle,
    EeFootprintArc,
    EeFootprintText,
    // 3D model classes:
    Ee3dModel,
    Ee3dModelBase,
    ee_footprint,
} = require("./parametersEasyeda");

// --- Helper: zip two arrays into an object ---
function zip(arr, values) {
    const result = {};
    const len = Math.min(arr.length, values.length);
    for (let i = 0; i < len; i++) {
        result[arr[i]] = values[i];
    }
    return result;
}

// -------------------- EasyEDA Symbol Handlers --------------------

function add_easyeda_pin(pin_data, ee_symbol) {
    const segments = pin_data.split("^^");
    const ee_segments = segments.map((seg) => seg.split("~"));

    // For settings, skip the designator element (index 0)
    const settingsData = zip(EeSymbolPinSettings.fields, ee_segments[0].slice(1));
    const pin_settings = new EeSymbolPinSettings(settingsData);

    const pin_dot = new EeSymbolPinDot({
        dot_x: parseFloat(ee_segments[1][0]),
        dot_y: parseFloat(ee_segments[1][1]),
    });
    const pin_path = new EeSymbolPinPath({
        path: ee_segments[2][0],
        color: ee_segments[2][1],
    });
    const pinNameData = zip(EeSymbolPinName.fields, ee_segments[3]);
    const pin_name = new EeSymbolPinName(pinNameData);

    const pin_dot_bis = new EeSymbolPinDotBis({
        is_displayed: ee_segments[5][0],
        circle_x: parseFloat(ee_segments[5][1]),
        circle_y: parseFloat(ee_segments[5][2]),
    });
    const pin_clock = new EeSymbolPinClock({
        is_displayed: ee_segments[6][0],
        path: ee_segments[6][1],
    });

    ee_symbol.pins.push(
        new EeSymbolPin({
            settings: pin_settings,
            pin_dot: pin_dot,
            pin_path: pin_path,
            name: pin_name,
            dot: pin_dot_bis,
            clock: pin_clock,
        })
    );
}

function add_easyeda_rectangle(rectangle_data, ee_symbol) {
    const data = zip(EeSymbolRectangle.fields, rectangle_data.split("~").slice(1));
    ee_symbol.rectangles.push(new EeSymbolRectangle(data));
}

function add_easyeda_polyline(polyline_data, ee_symbol) {
    const data = zip(
        EeSymbolPolyline.fields,
        polyline_data.split("~").slice(1)
    );
    ee_symbol.polylines.push(new EeSymbolPolyline(data));
}

function add_easyeda_polygon(polygon_data, ee_symbol) {
    const data = zip(EeSymbolPolygon.fields, polygon_data.split("~").slice(1));
    ee_symbol.polygons.push(new EeSymbolPolygon(data));
}

function add_easyeda_path(path_data, ee_symbol) {
    const data = zip(EeSymbolPath.fields, path_data.split("~").slice(1));
    ee_symbol.paths.push(new EeSymbolPath(data));
}

function add_easyeda_circle(circle_data, ee_symbol) {
    const data = zip(EeSymbolCircle.fields, circle_data.split("~").slice(1));
    ee_symbol.circles.push(new EeSymbolCircle(data));
}

function add_easyeda_ellipse(ellipse_data, ee_symbol) {
    const data = zip(EeSymbolEllipse.fields, ellipse_data.split("~").slice(1));
    ee_symbol.ellipses.push(new EeSymbolEllipse(data));
}

function add_easyeda_arc(arc_data, ee_symbol) {
    const data = zip(EeSymbolArc.fields, arc_data.split("~").slice(1));
    ee_symbol.arcs.push(new EeSymbolArc(data));
}

const easyeda_handlers = {
    P: add_easyeda_pin,
    R: add_easyeda_rectangle,
    E: add_easyeda_ellipse,
    C: add_easyeda_circle,
    A: add_easyeda_arc,
    PL: add_easyeda_polyline,
    PG: add_easyeda_polygon,
    PT: add_easyeda_path,
    // "PI": ... (not supported)
};

// -------------------- EasyEDA Symbol Importer --------------------

class EasyedaSymbolImporter {
    constructor(easyedaCpCadData) {
        this.input = easyedaCpCadData;
        this.output = this.extract_easyeda_data(
            easyedaCpCadData,
            easyedaCpCadData.dataStr.head.c_para
        );
    }

    getSymbol() {
        return this.output;
    }

    extract_easyeda_data(ee_data, ee_data_info) {
        const new_ee_symbol = new EeSymbol({
            info: {
                name: ee_data_info["name"],
                prefix: ee_data_info["pre"],
                package: ee_data_info["package"] || null,
                manufacturer: ee_data_info["BOM_Manufacturer"] || null,
                datasheet: ee_data.lcsc ? ee_data.lcsc.url : null,
                lcsc_id: ee_data.lcsc ? ee_data.lcsc.number : null,
                jlc_id: ee_data_info["BOM_JLCPCB Part Class"] || null,
            },
            bbox: new EeSymbolBbox({
                x: parseFloat(ee_data.dataStr.head.x),
                y: parseFloat(ee_data.dataStr.head.y),
            }),
        });

        ee_data.dataStr.shape.forEach((line) => {
            const designator = line.split("~")[0];
            if (easyeda_handlers.hasOwnProperty(designator)) {
                easyeda_handlers[designator](line, new_ee_symbol);
            } else {
                console.warn(`Unknown symbol designator: ${designator}`);
            }
        });

        return new_ee_symbol;
    }
}

// -------------------- EasyEDA Footprint Importer --------------------

class EasyedaFootprintImporter {
    constructor(easyedaCpCadData) {
        this.input = easyedaCpCadData;
    }

    getFootprint() {
        return this.output;
    }

    async extract_easyeda_data(ee_data_str, ee_data_info, is_smd) {
        const new_ee_footprint = new ee_footprint({
            info: {
                name: ee_data_info["package"],
                fp_type: is_smd ? "smd" : "tht",
                model_3d_name: ee_data_info["3DModel"] || null,
            },
            bbox: new EeFootprintBbox({
                x: parseFloat(ee_data_str.head.x),
                y: parseFloat(ee_data_str.head.y),
            }),
            model_3d: null,
        });

        ee_data_str.shape.forEach((line) => {
            const ee_designator = line.split("~")[0];
            const ee_fields = line.split("~").slice(1);
            if (ee_designator === "PAD") {
                const data = zip(EeFootprintPad.fields, ee_fields.slice(0, 18));
                new_ee_footprint.pads.push(new EeFootprintPad(data));
            } else if (ee_designator === "TRACK") {
                const data = zip(EeFootprintTrack.fields, ee_fields);
                new_ee_footprint.tracks.push(new EeFootprintTrack(data));
            } else if (ee_designator === "HOLE") {
                const data = zip(EeFootprintHole.fields, ee_fields);
                new_ee_footprint.holes.push(new EeFootprintHole(data));
            } else if (ee_designator === "VIA") {
                const data = zip(EeFootprintVia.fields, ee_fields);
                new_ee_footprint.vias.push(new EeFootprintVia(data));
            } else if (ee_designator === "CIRCLE") {
                const data = zip(EeFootprintCircle.fields, ee_fields);
                new_ee_footprint.circles.push(new EeFootprintCircle(data));
            } else if (ee_designator === "ARC") {
                const data = zip(EeFootprintArc.fields, ee_fields);
                new_ee_footprint.arcs.push(new EeFootprintArc(data));
            } else if (ee_designator === "RECT") {
                const data = zip(EeFootprintRectangle.fields, ee_fields);
                new_ee_footprint.rectangles.push(new EeFootprintRectangle(data));
            } else if (ee_designator === "TEXT") {
                const data = zip(EeFootprintText.fields, ee_fields);
                new_ee_footprint.texts.push(new EeFootprintText(data));
            } else if (ee_designator === "SVGNODE") {
                /*
                Is this needed? 3d model are downloaded separately...

                new_ee_footprint.model_3d = new Easyeda3dModelImporter(
                    { packageDetail: { dataStr: { shape: [line] } } },
                    false
                );
                const a = 1;

                */
            } else if (ee_designator === "SOLIDREGION") {
                // Not implemented
            } else {
                console.warn(`Unknown footprint designator: ${ee_designator}`);
            }
        });

        /*
        removing this for now. footprint shouldnt need its own copy of the 3d model, injecting main 3d model in main thread instead
        if (new_ee_footprint.model_3d) {
            new_ee_footprint.model_3d = await new_ee_footprint.model_3d.create_3d_model();
        }
        */


        return new_ee_footprint;
    }
}

// -------------------- EasyEDA 3D Model Importer --------------------

class Easyeda3dModelImporter {
    constructor(lcscComponent) {
        this.lcscComponent = lcscComponent;
        this.downloadRaw3dModel = true;
    }

    async create_3d_model() {
        const model_3d_info = this.lcscComponent.get3DModelInfo();
        if (model_3d_info) {
            const model_3d = this.parse_3d_model_info(model_3d_info);
            if (this.downloadRaw3dModel) {
                model_3d.raw_obj = this.lcscComponent.get3dRawObj();
                model_3d.step = this.lcscComponent.get3dStep();
                let transformMatrix = mat4.create(); // Identity matrix

                const o = {
                    "id": "d7bbe008f7644750b0331176fa9be5bf",
                    "originX": 4196,
                    "originY": -3147.5,
                    "originRotation": 0,
                    "x": -4.527699999999641,
                    "y": 0,
                    "z": 0,
                    "rx": 0,
                    "ry": 0,
                    "rz": 90,
                    "width": 40.1574,
                    "height": 56.017797413,
                    "isTop": true
                };
                const options = {
                    "id": model_3d_info.uuid,
                    //"originX": 4108.5,    # 3D model location on easyeda PCB - ignore
                    //"originY": -3087.5,   # 3D model location on easyeda PCB - ignore
                    //"originRotation": 0,  # 3D model location on easyeda PCB - ignore
                    //"x": 0,
                    //"y": 0,
                    "z": model_3d_info.z,
                    "rx": model_3d_info.c_rotation.split(',')[0],
                    "ry": model_3d_info.c_rotation.split(',')[1],
                    "rz": model_3d_info.c_rotation.split(',')[2],
                    "width": model_3d_info.c_width,
                    "height": model_3d_info.c_height,
                    //"isTop": true         # 3D model location on easyeda PCB - ignore
                }
                const objFile = new OBJFile(model_3d.raw_obj);
                const output = objFile.parse();

                // Calculate bbox from parsed vertices
                const vertices = output.models[0].vertices;
                const boundingBox = vertices.reduce((acc, vertex) => ({
                    maxX: Math.max(acc.maxX, vertex.x),
                    maxY: Math.max(acc.maxY, vertex.y),
                    maxZ: Math.max(acc.maxZ, vertex.z),
                    minX: Math.min(acc.minX, vertex.x),
                    minY: Math.min(acc.minY, vertex.y),
                    minZ: Math.min(acc.minZ, vertex.z)
                }), {
                    maxX: -Infinity,
                    maxY: -Infinity,
                    maxZ: -Infinity,
                    minX: Infinity,
                    minY: Infinity,
                    minZ: Infinity
                });

                model_3d.boundingBox = boundingBox;

                const centerX = (boundingBox.maxX + boundingBox.minX) / 2
                  , centerY = (boundingBox.maxY + boundingBox.minY) / 2
                  , bottomZ = boundingBox.minZ;

                const translationMatrix = mat4.create();
                mat4.translate(translationMatrix, translationMatrix,
                  vec3.fromValues(-centerX, -centerY, -bottomZ));
                // easyeda: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -7.1030225, 0.014705, 1]
                // kipm:     1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -7.1030225, 0.014705, 1

                const rotationZ = glMatrix.toRadian(options.rz);
                const rotationX = glMatrix.toRadian(options.rx);
                const rotationY = glMatrix.toRadian(options.ry);

                const rotationMatrix = mat4.create();
                mat4.rotateZ(rotationMatrix, rotationMatrix, rotationZ);
                mat4.rotateX(rotationMatrix, rotationMatrix, rotationX);
                mat4.rotateY(rotationMatrix, rotationMatrix, rotationY);
                mat4.multiply(transformMatrix, rotationMatrix, translationMatrix);

                // easyeda:  [6.1e-17, 1, 0, 0, -1, 6.1e-17, 0, 0, 0, 0, 1, 0, 7.1030225, -4.3493e-16, 0.014705, 1]
                // kipm:      6.1e-17, 1, 0, 0, -1, 6.1e-17, 0, 0, 0, 0, 1, 0, 7.1030225, -4.3493e-16, 0.014705, 1


                const scaleX = options.width / (boundingBox.maxX - boundingBox.minX);
                const scaleY = options.height / (boundingBox.maxY - boundingBox.minY);
                const uniformScale = Math.min(scaleX, scaleY);

                mat4.scale(transformMatrix, transformMatrix, vec3.fromValues(uniformScale, uniformScale, uniformScale));
                //mat4.translate(transformMatrix, transformMatrix, vec3.fromValues(options.x, options.y, options.z));


                const translation = vec3.create();
                const rotation = quat.create();
                const scale = vec3.create();

                mat4.getTranslation(translation, transformMatrix);
                mat4.getRotation(rotation, transformMatrix);
                mat4.getScaling(scale, transformMatrix);

                function quatToEuler(q) {
                    // Assuming ZXY rotation order based on your original code
                    // q = [x, y, z, w]

                    const x = q[0], y = q[1], z = q[2], w = q[3];

                    // ZXY rotation order
                    const rotX = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)) * 180 / Math.PI;
                    const rotY = Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x)))) * 180 / Math.PI;
                    const rotZ = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * 180 / Math.PI;

                    // Normalize to 0-360
                    return {
                        x: ((rotX % 360) + 360) % 360,
                        y: ((rotY % 360) + 360) % 360,
                        z: ((rotZ % 360) + 360) % 360
                    };
                }

                const rotationDegrees = quatToEuler(rotation);

                rotationDegrees.x = ((rotationDegrees.x % 360) + 360) % 360;
                rotationDegrees.y = ((rotationDegrees.y % 360) + 360) % 360;
                rotationDegrees.z = ((rotationDegrees.z % 360) + 360) % 360;

                console.log("Translation (x, y, z):");
                console.log(`x: ${translation[0].toFixed(2)}, y: ${translation[1].toFixed(2)}, z: ${translation[2].toFixed(2)}`);

                console.log("Rotation (degrees, x, y, z):");
                console.log(`x: ${rotationDegrees.x.toFixed(2)}, y: ${rotationDegrees.y.toFixed(2)}, z: ${rotationDegrees.z.toFixed(2)}`);

                this.lcscComponent.translation.x += +translation[0].toFixed(2);
                this.lcscComponent.translation.y += +translation[1].toFixed(2);
                this.lcscComponent.translation.z += +translation[2].toFixed(2);
            }

            return model_3d;
        }
        console.warn("No 3D model available for this component");
        return null;
    }

    get_3d_model_info(ee_data) {
        for (const line of ee_data) {
            const ee_designator = line.split("~")[0];
            if (ee_designator === "SVGNODE") {
                const raw_json = line.split("~").slice(1)[0];
                return JSON.parse(raw_json).attrs;
            }
        }
        return {};
    }

    parse_3d_model_info(info) {
        return new Ee3dModel({
            name: info.title,
            uuid: info.uuid,
            translation: new Ee3dModelBase({
                x: info.c_origin.split(",")[0],
                y: info.c_origin.split(",")[1],
                z: info.z,
            }),
            rotation: new Ee3dModelBase(
                zip(Ee3dModelBase.fields, info.c_rotation.split(","))
            ),
        });
    }
}

module.exports = {
    EasyedaSymbolImporter,
    EasyedaFootprintImporter,
    Easyeda3dModelImporter,
    add_easyeda_pin,
    add_easyeda_rectangle,
    add_easyeda_polyline,
    add_easyeda_polygon,
    add_easyeda_path,
    add_easyeda_circle,
    add_easyeda_ellipse,
    add_easyeda_arc,
};