// easyeda_importer.js
const OBJFile = require('obj-file-parser');

const { EasyedaApi } = require("./easyedaApi");
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
                new_ee_footprint.model_3d = new Easyeda3dModelImporter(
                    { packageDetail: { dataStr: { shape: [line] } } },
                    false
                );
            } else if (ee_designator === "SOLIDREGION") {
                // Not implemented
            } else {
                console.warn(`Unknown footprint designator: ${ee_designator}`);
            }
        });

        if (new_ee_footprint.model_3d) {
            new_ee_footprint.model_3d = await new_ee_footprint.model_3d.create_3d_model();
        }

        console.log('');
        console.log('');
        console.log('Step 3');
        console.log('------');
        console.log('Variable: "ee_data_str", in easyedaImporter.js');
        console.log('Source: ee_data_str.head');

        console.log(JSON.stringify(
            {
                'ee_data_str.head.x': ee_data_str.head.x,
                'ee_data_str.head.y': ee_data_str.head.y,
                'is_smd': is_smd,
            },
            null,
            2
        ));


        return new_ee_footprint;
    }
}

// -------------------- EasyEDA 3D Model Importer --------------------

class Easyeda3dModelImporter {
    constructor(easyedaCpCadData, downloadRaw3dModel) {
        this.input = easyedaCpCadData;
        this.downloadRaw3dModel = downloadRaw3dModel;
    }

    async create_3d_model() {
        const ee_data =
            typeof this.input === "object" && !Array.isArray(this.input)
                ? this.input.packageDetail.dataStr.shape
                : this.input;
        const model_3d_info = this.get_3d_model_info(ee_data);
        if (model_3d_info) {
            const model_3d = this.parse_3d_model_info(model_3d_info);
            if (this.downloadRaw3dModel) {
                const api = new EasyedaApi();
                model_3d.raw_obj = await api.getRaw3dModelObj(model_3d.uuid);
                model_3d.step = await api.getStep3dModel(model_3d.uuid);

                // EasyEda transform test
                if (false) {
                    const isSMD = this.input.SMT;

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


                    // Step 1: Calculate center point for centering transformation
                    const centerX = (boundingBox.maxX + boundingBox.minX) / 2;
                    const centerY = (boundingBox.maxY + boundingBox.minY) / 2;
                    const centerZ = boundingBox.minZ;

                    // Step 4: Z offset calculation based on bbox dimensions
                    // Calculate the scaling factor based on width/height ratio
                    const width = boundingBox.maxX - boundingBox.minX;
                    const height = boundingBox.maxY - boundingBox.minY;


                    console.log('c_width:', model_3d_info.c_width);
                    console.log('c_width_mm:', model_3d_info.c_width / 3.937);
                    console.log('c_height:', model_3d_info.c_height / 3.937);
                    console.log('c_origin:', model_3d_info.c_origin);
                    console.log('z:', model_3d_info.z);
                    console.log('-----');
                    console.log('calculated width:', width);
                    console.log('calculated height:', height);


                    const scaleFactor = Math.min(width / (boundingBox.maxX - boundingBox.minX),
                        height / (boundingBox.maxY - boundingBox.minY));

                    // Calculate zOffsetMils based on the bbox's z-dimension and scale factor
                    const zOffsetMils = -boundingBox.minZ * scaleFactor;
                    const zOffsetMm = zOffsetMils / 3.937007874;

                    // Calculate final transformations
                    const transformation = {
                        x: parseFloat((-centerX).toFixed(3)),
                        y: parseFloat((-centerY).toFixed(3)),
                        z: isSMD ?
                            parseFloat((-centerZ + zOffsetMm).toFixed(3)) :
                            parseFloat((-centerZ).toFixed(3))
                    };

                    // Log the calculations
                    console.log('\nBounding Box:', boundingBox);
                    console.log('Step 1 - Center point:', {
                        x: centerX.toFixed(3),
                        y: centerY.toFixed(3),
                        z: centerZ.toFixed(3)
                    });
                    console.log('Step 4 - Position offset:', {
                        zOffsetMils: zOffsetMils,
                        zOffsetMm: zOffsetMm.toFixed(3)
                    });

                    console.log('Final transformation values:', transformation);
                    console.log('');
                }

            }
            console.log('Step 2 - translation values on model_3d:', );

            console.log('');
            console.log('');
            console.log('Step 2');
            console.log('------');
            console.log('Variable: "model_3d", in easyedaImporter.js');
            console.log('Source: "info" variable from step 1');

            console.log(JSON.stringify(
                {
                    'model_3d.translation.x': model_3d.translation.x,
                    'model_3d.translation.y': model_3d.translation.y,
                    'model_3d.translation.z': model_3d.translation.z
                },
                null,
                2
            ));

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
        console.log('');
        console.log('');
        console.log('Step 1');
        console.log('------');
        console.log('Variable: "info", in easyedaImporter.js');
        console.log('Source: from input.packageDetail.dataStr.shape (SVGNODE~{"gId":"g1_outline"[...])');

        console.log(JSON.stringify(
            {
                'info.c_origin[0]': info.c_origin.split(',')[0],
                'info.c_origin[1]': info.c_origin.split(',')[1],
                'info.z': info.z,
                'info.c_width': info.c_width,
                'info.c_height': info.c_height
            },
            null,
            2
        ));

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