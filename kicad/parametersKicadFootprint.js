// parameters_kicad_footprint.js

// ---------------------------- FOOTPRINT PART ----------------------------

// KiCad footprint template constants
const KI_MODULE_INFO = "(module {package_lib}:{package_name} (layer F.Cu) (tedit {edit})\n";
const KI_DESCRIPTION = `\t(descr "{datasheet_link}, generated with easyeda2kicad.py on {date}")\n`;
const KI_TAGS_INFO = `\t(tags "{tag}")\n`;
const KI_FP_TYPE = "\t(attr {component_type})\n";
const KI_REFERENCE = `\t(fp_text reference REF** (at {pos_x} {pos_y}) (layer F.SilkS)
\t\t(effects (font (size 1 1) (thickness 0.15)))
\t)\n`;
const KI_PACKAGE_VALUE = `\t(fp_text value {package_name} (at {pos_x} {pos_y}) (layer F.Fab)
\t\t(effects (font (size 1 1) (thickness 0.15)))
\t)\n`;
const KI_FAB_REF = `\t(fp_text user %R (at 0 0) (layer F.Fab)
\t\t(effects (font (size 1 1) (thickness 0.15)))
\t)\n`;
const KI_END_FILE = ")";

// Note: Adjusted KI_PAD, KI_LINE, etc., so that they don’t include extra newlines.
const KI_PAD = `\t(pad {number} {type} {shape} (at {pos_x:.2f} {pos_y:.2f} {orientation:.2f}) (size {width:.2f} {height:.2f}) (layers {layers}){drill}{polygon})\n`;
const KI_LINE = `\t(fp_line (start {start_x:.2f} {start_y:.2f}) (end {end_x:.2f} {end_y:.2f}) (layer {layers}) (width {stroke_width:.2f}))\n`;
const KI_HOLE = `\t(pad "" thru_hole circle (at {pos_x:.2f} {pos_y:.2f}) (size {size:.2f} {size:.2f}) (drill {size:.2f}) (layers *.Cu *.Mask))\n`;
const KI_VIA = `\t(pad "" thru_hole circle (at {pos_x:.2f} {pos_y:.2f}) (size {diameter:.2f} {diameter:.2f}) (drill {size:.2f}) (layers *.Cu *.Paste *.Mask))\n`;
const KI_CIRCLE = `\t(fp_circle (center {cx:.2f} {cy:.2f}) (end {end_x:.2f} {end_y:.2f}) (layer {layers}) (width {stroke_width:.2f}))\n`;
const KI_ARC = `\t(fp_arc (start {start_x:.2f} {start_y:.2f}) (end {end_x:.2f} {end_y:.2f}) (angle {angle:.2f}) (layer {layers}) (width {stroke_width:.2f}))\n`;
const KI_TEXT = `\t(fp_text user {text} (at {pos_x:.2f} {pos_y:.2f} {orientation:.2f}) (layer {layers}){display}\n\t\t(effects (font (size {font_size:.2f} {font_size:.2f}) (thickness {thickness:.2f})) (justify left{mirror}))\n\t)\n`;
const KI_MODEL_3D = `\t(model "{file_3d}"\n\t\t(offset (xyz {pos_x:.3f} {pos_y:.3f} {pos_z:.3f}))\n\t\t(scale (xyz 1 1 1))\n\t\t(rotate (xyz {rot_x:.0f} {rot_y:.0f} {rot_z:.0f}))\n\t)\n`;

// Pad shape and layer definitions
const KI_PAD_SHAPE = {
    "ELLIPSE": "circle",
    "RECT": "rect",
    "OVAL": "oval",
    "POLYGON": "custom",
};

const KI_PAD_LAYER = {
    1: "F.Cu F.Paste F.Mask",
    2: "B.Cu B.Paste B.Mask",
    3: "F.SilkS",
    11: "*.Cu *.Paste *.Mask",
    13: "F.Fab",
    15: "Dwgs.User",
};

const KI_PAD_LAYER_THT = {
    1: "F.Cu F.Mask",
    2: "B.Cu B.Mask",
    3: "F.SilkS",
    11: "*.Cu *.Mask",
    13: "F.Fab",
    15: "Dwgs.User",
};

const KI_LAYERS = {
    1: "F.Cu",
    2: "B.Cu",
    3: "F.SilkS",
    4: "B.SilkS",
    5: "F.Paste",
    6: "B.Paste",
    7: "F.Mask",
    8: "B.Mask",
    10: "Edge.Cuts",
    11: "Edge.Cuts",
    12: "Cmts.User",
    13: "F.Fab",
    14: "B.Fab",
    15: "Dwgs.User",
    101: "F.Fab",
};

// ---------------- Helper Function ----------------

// Rounds all numeric properties on an object to two decimals.
function roundFloatValues(obj) {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (typeof obj[key] === "number") {
                obj[key] = Math.round(obj[key] * 100) / 100;
            }
        }
    }
}

// ---------------- Data Classes ----------------

// PAD
class KiFootprintPad {
    constructor({
                    type,
                    shape,
                    pos_x,
                    pos_y,
                    width,
                    height,
                    layers,
                    number,
                    drill,
                    orientation,
                    polygon,
                }) {
        this.type = type;
        this.shape = shape;
        this.pos_x = pos_x;
        this.pos_y = pos_y;
        this.width = width;
        this.height = height;
        this.layers = layers;
        this.number = number;
        this.drill = drill;
        this.orientation = orientation;
        this.polygon = polygon;
        roundFloatValues(this);
    }
}

// TRACK
class KiFootprintTrack {
    constructor({
                    points_start_x = [],
                    points_start_y = [],
                    points_end_x = [],
                    points_end_y = [],
                    stroke_width = 0,
                    layers = "",
                } = {}) {
        this.points_start_x = points_start_x;
        this.points_start_y = points_start_y;
        this.points_end_x = points_end_x;
        this.points_end_y = points_end_y;
        this.stroke_width = stroke_width;
        this.layers = layers;
    }
}

// HOLE
class KiFootprintHole {
    constructor({ pos_x, pos_y, size }) {
        this.pos_x = pos_x;
        this.pos_y = pos_y;
        this.size = size;
        roundFloatValues(this);
    }
}

// CIRCLE
class KiFootprintCircle {
    constructor({ cx, cy, end_x, end_y, layers, stroke_width }) {
        this.cx = cx;
        this.cy = cy;
        this.end_x = end_x;
        this.end_y = end_y;
        this.layers = layers;
        this.stroke_width = stroke_width;
        roundFloatValues(this);
    }
}

// RECTANGLE – inherits from KiFootprintTrack
class KiFootprintRectangle extends KiFootprintTrack {
    constructor(options = {}) {
        super(options);
    }
}

// ARC
class KiFootprintArc {
    constructor({ start_x, start_y, end_x, end_y, angle, layers, stroke_width }) {
        this.start_x = start_x;
        this.start_y = start_y;
        this.end_x = end_x;
        this.end_y = end_y;
        this.angle = angle;
        this.layers = layers;
        this.stroke_width = stroke_width;
        roundFloatValues(this);
    }
}

// TEXT
class KiFootprintText {
    constructor({
                    pos_x,
                    pos_y,
                    orientation,
                    text,
                    layers,
                    font_size,
                    thickness,
                    display,
                    mirror,
                }) {
        this.pos_x = pos_x;
        this.pos_y = pos_y;
        this.orientation = orientation;
        this.text = text;
        this.layers = layers;
        this.font_size = font_size;
        this.thickness = thickness;
        this.display = display;
        this.mirror = mirror;
        roundFloatValues(this);
    }
}

// VIA
class KiFootprintVia {
    constructor({ pos_x, pos_y, size, diameter }) {
        this.pos_x = pos_x;
        this.pos_y = pos_y;
        this.size = size;
        this.diameter = diameter;
        roundFloatValues(this);
    }
}

// SOLID REGION
class KiFootprintSolidRegion {
    constructor({ name = "" } = {}) {
        this.name = name;
    }
}

// COPPER AREA
class KiFootprintCopperArea {
    constructor({ name = "" } = {}) {
        this.name = name;
    }
}

// FOOTPRINT INFO
class KiFootprintInfo {
    constructor({ name, fp_type }) {
        this.name = name;
        this.fp_type = fp_type;
    }
}

// 3D MODEL BASE
class Ki3dModelBase {
    constructor({ x = 0.0, y = 0.0, z = 0.0 } = {}) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

// 3D MODEL
class Ki3dModel {
    constructor({ name, translation, rotation, raw_wrl = null }) {
        this.name = name;
        this.translation = translation;
        this.rotation = rotation;
        this.raw_wrl = raw_wrl;
    }
}

// FOOTPRINT
class KiFootprint {
    constructor({
                    info,
                    model_3d,
                    pads = [],
                    tracks = [],
                    vias = [],
                    holes = [],
                    circles = [],
                    arcs = [],
                    rectangles = [],
                    texts = [],
                    solid_regions = [],
                    copper_areas = [],
                } = {}) {
        this.info = info;
        this.model_3d = model_3d;
        this.pads = pads;
        this.tracks = tracks;
        this.vias = vias;
        this.holes = holes;
        this.circles = circles;
        this.arcs = arcs;
        this.rectangles = rectangles;
        this.texts = texts;
        this.solid_regions = solid_regions;
        this.copper_areas = copper_areas;
    }
}

// ---------------- Exports ----------------

module.exports = {
    KI_MODULE_INFO,
    KI_DESCRIPTION,
    KI_TAGS_INFO,
    KI_FP_TYPE,
    KI_REFERENCE,
    KI_PACKAGE_VALUE,
    KI_FAB_REF,
    KI_END_FILE,
    KI_PAD,
    KI_LINE,
    KI_HOLE,
    KI_VIA,
    KI_CIRCLE,
    KI_ARC,
    KI_TEXT,
    KI_MODEL_3D,
    KI_PAD_SHAPE,
    KI_PAD_LAYER,
    KI_PAD_LAYER_THT,
    KI_LAYERS,
    KiFootprintPad,
    KiFootprintTrack,
    KiFootprintHole,
    KiFootprintCircle,
    KiFootprintRectangle,
    KiFootprintArc,
    KiFootprintText,
    KiFootprintVia,
    KiFootprintSolidRegion,
    KiFootprintCopperArea,
    KiFootprintInfo,
    Ki3dModelBase,
    Ki3dModel,
    KiFootprint,
};