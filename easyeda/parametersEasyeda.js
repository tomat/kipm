// parameters_easyeda.js

// --- Global Imports ---
const { parse_svg_path } = require("./svgPathParser"); // adjust the path as needed

// --- EasyedaPinType Enum ---
const EasyedaPinType = {
    unspecified: 0,
    _input: 1,
    output: 2,
    bidirectional: 3,
    power: 4,
};
Object.freeze(EasyedaPinType);

// ------------------------- SYMBOL MODELS -------------------------

// EeSymbolBbox
class EeSymbolBbox {
    constructor({ x, y }) {
        this.x = x;
        this.y = y;
    }
    static get fields() {
        return ["x", "y"];
    }
}

// ------------------------- PIN MODELS -------------------------

// EeSymbolPinSettings
class EeSymbolPinSettings {
    constructor(data) {
        // Convert "show" to true; otherwise leave as provided.
        this.is_displayed = data.is_displayed === "show" ? true : data.is_displayed;
        // Convert type from a string/number to an EasyedaPinType value.
        const t = parseInt(data.type || "0", 10);
        this.type = [0, 1, 2, 3, 4].includes(t) ? t : EasyedaPinType.unspecified;
        this.spice_pin_number = data.spice_pin_number;
        this.pos_x = data.pos_x;
        this.pos_y = data.pos_y;
        this.rotation = data.rotation || 0.0;
        this.id = data.id;
        this.is_locked = data.is_locked || false;
    }
    static get fields() {
        return [
            "is_displayed",
            "type",
            "spice_pin_number",
            "pos_x",
            "pos_y",
            "rotation",
            "id",
            "is_locked",
        ];
    }
}

// EeSymbolPinDot
class EeSymbolPinDot {
    constructor({ dot_x, dot_y }) {
        this.dot_x = dot_x;
        this.dot_y = dot_y;
    }
    static get fields() {
        return ["dot_x", "dot_y"];
    }
}

// EeSymbolPinPath
class EeSymbolPinPath {
    constructor({ path, color }) {
        // Replace all occurrences of "v" with "h"
        this.path = path.replace(/v/g, "h");
        this.color = color;
    }
    static get fields() {
        return ["path", "color"];
    }
}

// EeSymbolPinName
class EeSymbolPinName {
    constructor(data) {
        this.is_displayed = data.is_displayed === "show" ? true : data.is_displayed;
        this.pos_x = data.pos_x;
        this.pos_y = data.pos_y;
        this.rotation = data.rotation || 0.0;
        this.text = data.text;
        this.text_anchor = data.text_anchor;
        this.font = data.font;
        if (typeof data.font_size === "string" && data.font_size.includes("pt")) {
            this.font_size = parseFloat(data.font_size.replace("pt", ""));
        } else {
            this.font_size = data.font_size || 7.0;
        }
    }
    static get fields() {
        return [
            "is_displayed",
            "pos_x",
            "pos_y",
            "rotation",
            "text",
            "text_anchor",
            "font",
            "font_size"
        ];
    }
}

// EeSymbolPinDotBis
class EeSymbolPinDotBis {
    constructor(data) {
        this.is_displayed = data.is_displayed === "show" ? true : data.is_displayed;
        this.circle_x = data.circle_x;
        this.circle_y = data.circle_y;
    }
    static get fields() {
        return ["is_displayed", "circle_x", "circle_y"];
    }
}

// EeSymbolPinClock
class EeSymbolPinClock {
    constructor(data) {
        this.is_displayed = data.is_displayed === "show" ? true : data.is_displayed;
        this.path = data.path;
    }
    static get fields() {
        return ["is_displayed", "path"];
    }
}

// EeSymbolPin – aggregates the above models.
class EeSymbolPin {
    constructor({ settings, pin_dot, pin_path, name, dot, clock }) {
        this.settings = new EeSymbolPinSettings(settings);
        this.pin_dot = new EeSymbolPinDot(pin_dot);
        this.pin_path = new EeSymbolPinPath(pin_path);
        this.name = new EeSymbolPinName(name);
        this.dot = new EeSymbolPinDotBis(dot);
        this.clock = new EeSymbolPinClock(clock);
    }
    // (No static fields required for this aggregator class.)
}

// ------------------------- RECTANGLE -------------------------

class EeSymbolRectangle {
    constructor(data) {
        this.pos_x = data.pos_x;
        this.pos_y = data.pos_y;
        this.rx = data.rx || null;
        this.ry = data.ry || null;
        this.width = data.width;
        this.height = data.height;
        this.stroke_color = data.stroke_color;
        this.stroke_width = data.stroke_width;
        this.stroke_style = data.stroke_style;
        this.fill_color = data.fill_color;
        this.id = data.id;
        this.is_locked = data.is_locked;
    }
    static get fields() {
        return [
            "pos_x",
            "pos_y",
            "rx",
            "ry",
            "width",
            "height",
            "stroke_color",
            "stroke_width",
            "stroke_style",
            "fill_color",
            "id",
            "is_locked",
        ];
    }
}

// ------------------------- CIRCLE -------------------------

class EeSymbolCircle {
    constructor(data) {
        this.center_x = data.center_x;
        this.center_y = data.center_y;
        this.radius = data.radius;
        this.stroke_color = data.stroke_color;
        this.stroke_width = data.stroke_width;
        this.stroke_style = data.stroke_style;
        // Convert fill_color to a boolean: true if defined and not "none"
        this.fill_color =
            Boolean(data.fill_color) &&
            data.fill_color.toLowerCase() !== "none";
        this.id = data.id;
        this.is_locked = data.is_locked || false;
    }
    static get fields() {
        return [
            "center_x",
            "center_y",
            "radius",
            "stroke_color",
            "stroke_width",
            "stroke_style",
            "fill_color",
            "id",
            "is_locked",
        ];
    }
}

// ------------------------- ARC -------------------------

class EeSymbolArc {
    constructor(data) {
        // Convert the SVG path using our parser.
        this.path = parse_svg_path(data.path);
        this.helper_dots = data.helper_dots;
        this.stroke_color = data.stroke_color;
        this.stroke_width = data.stroke_width;
        this.stroke_style = data.stroke_style;
        this.fill_color =
            Boolean(data.fill_color) &&
            data.fill_color.toLowerCase() !== "none";
        this.id = data.id;
        this.is_locked = data.is_locked || false;
    }
    static get fields() {
        return [
            "path",
            "helper_dots",
            "stroke_color",
            "stroke_width",
            "stroke_style",
            "fill_color",
            "id",
            "is_locked",
        ];
    }
}

// ------------------------- ELLIPSE -------------------------

class EeSymbolEllipse {
    constructor(data) {
        this.center_x = data.center_x;
        this.center_y = data.center_y;
        this.radius_x = data.radius_x;
        this.radius_y = data.radius_y;
        this.stroke_color = data.stroke_color;
        this.stroke_width = data.stroke_width;
        this.stroke_style = data.stroke_style;
        this.fill_color =
            Boolean(data.fill_color) &&
            data.fill_color.toLowerCase() !== "none";
        this.id = data.id;
        this.is_locked = data.is_locked || false;
    }
    static get fields() {
        return [
            "center_x",
            "center_y",
            "radius_x",
            "radius_y",
            "stroke_color",
            "stroke_width",
            "stroke_style",
            "fill_color",
            "id",
            "is_locked",
        ];
    }
}

// ------------------------- POLYLINE -------------------------

class EeSymbolPolyline {
    constructor(data) {
        this.points = data.points;
        this.stroke_color = data.stroke_color;
        this.stroke_width = data.stroke_width;
        this.stroke_style = data.stroke_style;
        this.fill_color =
            Boolean(data.fill_color) &&
            data.fill_color.toLowerCase() !== "none";
        this.id = data.id;
        this.is_locked = data.is_locked || false;
    }
    static get fields() {
        return [
            "points",
            "stroke_color",
            "stroke_width",
            "stroke_style",
            "fill_color",
            "id",
            "is_locked",
        ];
    }
}

// ------------------------- POLYGON -------------------------
// Inherits from EeSymbolPolyline.
class EeSymbolPolygon extends EeSymbolPolyline {
    constructor(data) {
        super(data);
    }
    // Inherit fields from EeSymbolPolyline.
    static get fields() {
        return EeSymbolPolyline.fields;
    }
}

// ------------------------- PATH -------------------------

class EeSymbolPath {
    constructor(data) {
        this.paths = data.paths;
        this.stroke_color = data.stroke_color;
        this.stroke_width = data.stroke_width;
        this.stroke_style = data.stroke_style;
        this.fill_color =
            Boolean(data.fill_color) &&
            data.fill_color.toLowerCase() !== "none";
        this.id = data.id;
        this.is_locked = data.is_locked || false;
    }
    static get fields() {
        return [
            "paths",
            "stroke_color",
            "stroke_width",
            "stroke_style",
            "fill_color",
            "id",
            "is_locked",
        ];
    }
}

// ------------------------- SYMBOL -------------------------

class EeSymbolInfo {
    constructor({
                    name = "",
                    prefix = "",
                    package: pkg = "",
                    manufacturer = "",
                    datasheet = "",
                    lcsc_id = "",
                    jlc_id = "",
                } = {}) {
        this.name = name;
        this.prefix = prefix;
        this.package = pkg;
        this.manufacturer = manufacturer;
        this.datasheet = datasheet;
        this.lcsc_id = lcsc_id;
        this.jlc_id = jlc_id;
    }
    static get fields() {
        return [
            "name",
            "prefix",
            "package",
            "manufacturer",
            "datasheet",
            "lcsc_id",
            "jlc_id",
        ];
    }
}

class EeSymbol {
    constructor({
                    info,
                    bbox,
                    pins = [],
                    rectangles = [],
                    circles = [],
                    arcs = [],
                    ellipses = [],
                    polylines = [],
                    polygons = [],
                    paths = [],
                } = {}) {
        this.info = new EeSymbolInfo(info);
        this.bbox = new EeSymbolBbox(bbox);
        this.pins = pins.map((p) => new EeSymbolPin(p));
        this.rectangles = rectangles.map((r) => new EeSymbolRectangle(r));
        this.circles = circles.map((c) => new EeSymbolCircle(c));
        this.arcs = arcs.map((a) => new EeSymbolArc(a));
        this.ellipses = ellipses.map((e) => new EeSymbolEllipse(e));
        this.polylines = polylines.map((p) => new EeSymbolPolyline(p));
        this.polygons = polygons.map((p) => new EeSymbolPolygon(p));
        this.paths = paths.map((p) => new EeSymbolPath(p));
    }
    // No static fields required for the aggregate class.
}

// ------------------------- FOOTPRINT MODELS -------------------------

// Conversion helper: converts a dimension to millimeters.
function convertToMm(dim) {
    return Number(dim) * 10 * 0.0254;
}

// EeFootprintBbox (for footprints)
class EeFootprintBbox {
    constructor({ x, y }) {
        this.x = x;
        this.y = y;
    }
    convert_to_mm() {
        this.x = convertToMm(this.x);
        this.y = convertToMm(this.y);
    }
    static get fields() {
        return ["x", "y"];
    }
}

// EeFootprintPad
class EeFootprintPad {
    constructor(data) {
        this.shape = data.shape;
        this.center_x = data.center_x;
        this.center_y = data.center_y;
        this.width = data.width;
        this.height = data.height;
        this.layer_id = data.layer_id;
        this.net = data.net;
        this.number = data.number;
        this.hole_radius = data.hole_radius;
        this.points = data.points;
        this.rotation = data.rotation || 0.0;
        this.id = data.id;
        this.hole_length = data.hole_length;
        this.hole_point = data.hole_point;
        this.is_plated = data.is_plated;
        this.is_locked = data.is_locked || false;
    }
    convert_to_mm() {
        this.center_x = convertToMm(this.center_x);
        this.center_y = convertToMm(this.center_y);
        this.width = convertToMm(this.width);
        this.height = convertToMm(this.height);
        this.hole_radius = convertToMm(this.hole_radius);
        this.hole_length = convertToMm(this.hole_length);
    }
    static get fields() {
        return [
            "shape",
            "center_x",
            "center_y",
            "width",
            "height",
            "layer_id",
            "net",
            "number",
            "hole_radius",
            "points",
            "rotation",
            "id",
            "hole_length",
            "hole_point",
            "is_plated",
            "is_locked",
        ];
    }
}

// EeFootprintTrack
class EeFootprintTrack {
    constructor(data) {
        this.stroke_width = data.stroke_width;
        this.layer_id = data.layer_id;
        this.net = data.net;
        this.points = data.points;
        this.id = data.id;
        this.is_locked = data.is_locked || false;
    }
    convert_to_mm() {
        this.stroke_width = convertToMm(this.stroke_width);
    }
    static get fields() {
        return [
            "stroke_width",
            "layer_id",
            "net",
            "points",
            "id",
            "is_locked",
        ];
    }
}

// EeFootprintHole
class EeFootprintHole {
    constructor(data) {
        this.center_x = data.center_x;
        this.center_y = data.center_y;
        this.radius = data.radius;
        this.id = data.id;
        this.is_locked = data.is_locked || false;
    }
    convert_to_mm() {
        this.center_x = convertToMm(this.center_x);
        this.center_y = convertToMm(this.center_y);
        this.radius = convertToMm(this.radius);
    }
    static get fields() {
        return ["center_x", "center_y", "radius", "id", "is_locked"];
    }
}

// EeFootprintVia
class EeFootprintVia {
    constructor(data) {
        this.center_x = data.center_x;
        this.center_y = data.center_y;
        this.diameter = data.diameter;
        this.net = data.net;
        this.radius = data.radius;
        this.id = data.id;
        this.is_locked = data.is_locked || false;
    }
    convert_to_mm() {
        this.center_x = convertToMm(this.center_x);
        this.center_y = convertToMm(this.center_y);
        this.radius = convertToMm(this.radius);
        this.diameter = convertToMm(this.diameter);
    }
    static get fields() {
        return ["center_x", "center_y", "diameter", "net", "radius", "id", "is_locked"];
    }
}

// EeFootprintCircle
class EeFootprintCircle {
    constructor(data) {
        this.cx = data.cx;
        this.cy = data.cy;
        this.radius = data.radius;
        this.stroke_width = data.stroke_width;
        this.layer_id = data.layer_id;
        this.id = data.id;
        this.is_locked = data.is_locked || false;
    }
    convert_to_mm() {
        this.cx = convertToMm(this.cx);
        this.cy = convertToMm(this.cy);
        this.radius = convertToMm(this.radius);
        this.stroke_width = convertToMm(this.stroke_width);
    }
    static get fields() {
        return ["cx", "cy", "radius", "stroke_width", "layer_id", "id", "is_locked"];
    }
}

// EeFootprintRectangle
class EeFootprintRectangle {
    constructor(data) {
        this.x = data.x;
        this.y = data.y;
        this.width = data.width;
        this.height = data.height;
        this.stroke_width = data.stroke_width;
        this.id = data.id;
        this.layer_id = data.layer_id;
        this.is_locked = data.is_locked;
    }
    convert_to_mm() {
        this.x = convertToMm(this.x);
        this.y = convertToMm(this.y);
        this.width = convertToMm(this.width);
        this.height = convertToMm(this.height);
    }
    static get fields() {
        return ["x", "y", "width", "height", "stroke_width", "id", "layer_id", "is_locked"];
    }
}

// EeFootprintArc
class EeFootprintArc {
    constructor(data) {
        this.stroke_width = data.stroke_width;
        this.layer_id = data.layer_id;
        this.net = data.net;
        this.path = data.path;
        this.helper_dots = data.helper_dots;
        this.id = data.id;
        this.is_locked = data.is_locked;
    }
    // No conversion method defined.
    static get fields() {
        return ["stroke_width", "layer_id", "net", "path", "helper_dots", "id", "is_locked"];
    }
}

// EeFootprintText
class EeFootprintText {
    constructor(data) {
        this.type = data.type;
        this.center_x = data.center_x;
        this.center_y = data.center_y;
        this.stroke_width = data.stroke_width;
        this.rotation = data.rotation;
        this.miror = data.miror;
        this.layer_id = data.layer_id;
        this.net = data.net;
        this.font_size = data.font_size;
        this.text = data.text;
        this.text_path = data.text_path;
        this.is_displayed = data.is_displayed;
        this.id = data.id;
        this.is_locked = data.is_locked;
    }
    convert_to_mm() {
        this.center_x = convertToMm(this.center_x);
        this.center_y = convertToMm(this.center_y);
        this.stroke_width = convertToMm(this.stroke_width);
        this.font_size = convertToMm(this.font_size);
    }
    static get fields() {
        return ["type", "center_x", "center_y", "stroke_width", "rotation", "miror", "layer_id", "net", "font_size", "text", "text_path", "is_displayed", "id", "is_locked"];
    }
}

// EeFootprintInfo
class EeFootprintInfo {
    constructor({ name, fp_type, model_3d_name }) {
        this.name = name;
        this.fp_type = fp_type;
        this.model_3d_name = model_3d_name;
    }
    static get fields() {
        return ["name", "fp_type", "model_3d_name"];
    }
}

// ------------------------- 3D MODEL -------------------------

// Ee3dModelBase
class Ee3dModelBase {
    constructor({ x = 0.0, y = 0.0, z = 0.0 } = {}) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    convert_to_mm() {
        this.x = convertToMm(this.x);
        this.y = convertToMm(this.y);
        this.z = convertToMm(this.z);
    }
    static get fields() {
        return ["x", "y", "z"];
    }
}

// Ee3dModel
class Ee3dModel {
    constructor({ name, uuid, translation, rotation, raw_obj = null, step = null }) {
        this.name = name;
        this.uuid = uuid;
        this.translation = new Ee3dModelBase(translation);
        this.rotation = new Ee3dModelBase(rotation);
        this.raw_obj = raw_obj;
        this.step = step;
    }
    convert_to_mm() {
        this.translation.convert_to_mm();
        // Optionally adjust z if needed.
    }
    static get fields() {
        return ["name", "uuid", "translation", "rotation", "raw_obj", "step"];
    }
}

// ee_footprint
class ee_footprint {
    constructor({
                    info,
                    bbox,
                    model_3d,
                    pads = [],
                    tracks = [],
                    holes = [],
                    vias = [],
                    circles = [],
                    arcs = [],
                    rectangles = [],
                    texts = [],
                }) {
        this.info = new EeFootprintInfo(info);
        this.bbox = new EeFootprintBbox(bbox);
        this.model_3d = model_3d ? new Ee3dModel(model_3d) : null;
        this.pads = pads.map((p) => new EeFootprintPad(p));
        this.tracks = tracks.map((t) => new EeFootprintTrack(t));
        this.holes = holes.map((h) => new EeFootprintHole(h));
        this.vias = vias.map((v) => new EeFootprintVia(v));
        this.circles = circles.map((c) => new EeFootprintCircle(c));
        this.arcs = arcs.map((a) => new EeFootprintArc(a));
        this.rectangles = rectangles.map((r) => new EeFootprintRectangle(r));
        this.texts = texts.map((t) => new EeFootprintText(t));
    }
    // No static fields for this aggregate class.
}

// ------------------------- EXPORTS -------------------------

module.exports = {
    // Easyeda Models
    EasyedaPinType,
    EeSymbolBbox,
    EeSymbolPinSettings,
    EeSymbolPinDot,
    EeSymbolPinPath,
    EeSymbolPinName,
    EeSymbolPinDotBis,
    EeSymbolPinClock,
    EeSymbolPin,
    EeSymbolRectangle,
    EeSymbolCircle,
    EeSymbolArc,
    EeSymbolEllipse,
    EeSymbolPolyline,
    EeSymbolPolygon,
    EeSymbolPath,
    EeSymbolInfo,
    EeSymbol,
    // Footprint Models
    convertToMm,
    EeFootprintBbox,
    EeFootprintPad,
    EeFootprintTrack,
    EeFootprintHole,
    EeFootprintVia,
    EeFootprintCircle,
    EeFootprintRectangle,
    EeFootprintArc,
    EeFootprintText,
    EeFootprintInfo,
    Ee3dModelBase,
    Ee3dModel,
    ee_footprint,
};