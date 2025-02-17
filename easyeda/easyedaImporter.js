// easyeda_importer.js

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