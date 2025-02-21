// export_kicad_footprint.js

// Global imports
const { acos, cos, sin, sqrt, PI } = Math;

// Import required EasyEDA and KiCad models and constants
const { ee_footprint, convertToMm } = require("../easyeda/parametersEasyeda");

const {
    KiFootprintInfo,
    Ki3dModel,
    Ki3dModelBase,
    KiFootprint,
    KiFootprintPad,
    KiFootprintTrack,
    KiFootprintHole,
    KiFootprintVia,
    KiFootprintCircle,
    KiFootprintRectangle,
    KiFootprintArc,
    KiFootprintText,
    KI_MODULE_INFO,
    KI_FP_TYPE,
    KI_REFERENCE,
    KI_PACKAGE_VALUE,
    KI_FAB_REF,
    KI_LINE,
    KI_PAD,
    KI_HOLE,
    KI_VIA,
    KI_CIRCLE,
    KI_ARC,
    KI_TEXT,
    KI_MODEL_3D,
    KI_END_FILE, KI_RECT,
} = require("./parametersKicadFootprint");

const { KI_PAD_SHAPE, KI_PAD_LAYER, KI_PAD_LAYER_THT, KI_LAYERS } = require("./parametersKicadFootprint");

function pyStr(num) {
    let s = num.toString();
    // If the number is finite and doesn't already include a decimal point, append ".0"
    if (isFinite(num) && !s.includes('.')) {
        s += '.0';
    }
    return s;
}

// ---------------------------------------
// A simple templating function to handle placeholders like {key} and {key:.2f}
function formatTemplate(template, data) {
    return template.replace(/{(\w+)(:[^}]+)?}/g, (match, key, formatSpec) => {
        let value = data[key];
        if (value === undefined) return match;
        if (formatSpec) {
            // Convert value to a number if possible.
            const num = Number(value);
            if (!isNaN(num)) {
                value = num;
                // Extract the desired number of decimals from the format specifier.
                const m = formatSpec.match(/\.([0-9]+)f/);
                if (m) {
                    const decimals = parseInt(m[1], 10);
                    // Preserve negative zero if needed.
                    const isNegZero = (1 / value === -Infinity);
                    value = value.toFixed(decimals);
                    if (isNegZero && !value.startsWith("-")) {
                        value = "-" + value;
                    }
                }
            }
        }
        return value;
    });
}

function toRadians(n) {
    return (n / 180.0) * PI;
}

function toDegrees(n) {
    return (n / PI) * 180.0;
}

// Elliptical arc implementation (based on SVG specification notes)
function computeArc(
    start_x,
    start_y,
    radius_x,
    radius_y,
    angle,
    large_arc_flag,
    sweep_flag,
    end_x,
    end_y
) {
    // Compute the half distance between the current and final point
    const dx2 = (start_x - end_x) / 2.0;
    const dy2 = (start_y - end_y) / 2.0;

    // Convert angle from degrees to radians
    angle = toRadians(angle % 360.0);
    const cos_angle = cos(angle);
    const sin_angle = sin(angle);

    // Step 1: Compute (x1, y1)
    const x1 = cos_angle * dx2 + sin_angle * dy2;
    const y1 = -sin_angle * dx2 + cos_angle * dy2;

    // Ensure radii are large enough
    radius_x = Math.abs(radius_x);
    radius_y = Math.abs(radius_y);
    let Pradius_x = radius_x * radius_x;
    let Pradius_y = radius_y * radius_y;
    const Px1 = x1 * x1;
    const Py1 = y1 * y1;

    // Check that radii are large enough
    let radiiCheck =
        Pradius_x !== 0 && Pradius_y !== 0 ? Px1 / Pradius_x + Py1 / Pradius_y : 0;
    if (radiiCheck > 1) {
        const factor = sqrt(radiiCheck);
        radius_x = factor * radius_x;
        radius_y = factor * radius_y;
        Pradius_x = radius_x * radius_x;
        Pradius_y = radius_y * radius_y;
    }

    // Step 2: Compute (cx1, cy1)
    const sign = large_arc_flag === sweep_flag ? -1 : 1;
    let sq = 0;
    if (Pradius_x * Py1 + Pradius_y * Px1 > 0) {
        sq =
            (Pradius_x * Pradius_y - Pradius_x * Py1 - Pradius_y * Px1) /
            (Pradius_x * Py1 + Pradius_y * Px1);
    }
    sq = Math.max(sq, 0);
    const coef = sign * sqrt(sq);
    const cx1 = coef * ((radius_x * y1) / radius_y);
    const cy1 = radius_x !== 0 ? coef * -((radius_y * x1) / radius_x) : 0;

    // Step 3: Compute (cx, cy) from (cx1, cy1)
    const sx2 = (start_x + end_x) / 2.0;
    const sy2 = (start_y + end_y) / 2.0;
    const cx = sx2 + (cos_angle * cx1 - sin_angle * cy1);
    const cy = sy2 + (sin_angle * cx1 + cos_angle * cy1);

    // Step 4: Compute the angle extent (dangle)
    const ux = radius_x !== 0 ? (x1 - cx1) / radius_x : 0;
    const uy = radius_y !== 0 ? (y1 - cy1) / radius_y : 0;
    const vx = radius_x !== 0 ? (-x1 - cx1) / radius_x : 0;
    const vy = radius_y !== 0 ? (-y1 - cy1) / radius_y : 0;

    const n = sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    const p = ux * vx + uy * vy;
    const sign2 = ux * vy - uy * vx < 0 ? -1 : 1;
    let angle_extent;
    if (n !== 0) {
        const ratio = p / n;
        if (Math.abs(ratio) < 1) {
            angle_extent = toDegrees(sign2 * acos(ratio));
        } else {
            angle_extent = 360 + 359; // Fallback value
        }
    } else {
        angle_extent = 360 + 359;
    }
    if (!sweep_flag && angle_extent > 0) {
        angle_extent -= 360;
    } else if (sweep_flag && angle_extent < 0) {
        angle_extent += 360;
    }

    const angleExtent_sign = angle_extent < 0 ? 1 : -1;
    angle_extent = (Math.abs(angle_extent) % 360) * angleExtent_sign;

    return [cx, cy, angle_extent];
}

// ---------------------------------------

function fpToKi(dim) {
    if (dim !== "" && dim !== null && !isNaN(parseFloat(dim))) {
        return parseFloat((parseFloat(dim) * 10 * 0.0254).toFixed(2));
    }
    return dim;
}

// ---------------------------------------

function drillToKi(hole_radius, hole_length, pad_height, pad_width) {
    if (
        hole_radius > 0 &&
        hole_length !== "" &&
        hole_length !== null &&
        hole_length !== 0
    ) {
        const max_distance_hole = Math.max(hole_radius * 2, hole_length);
        const pos_0 = pad_height - max_distance_hole;
        const pos_90 = pad_width - max_distance_hole;
        const max_distance = Math.max(pos_0, pos_90);

        if (max_distance === pos_0) {
            return `(drill oval ${hole_radius * 2} ${hole_length})`;
        } else {
            return `(drill oval ${hole_length} ${hole_radius * 2})`;
        }
    }
    if (hole_radius > 0) {
        return `(drill ${2 * hole_radius})`;
    }
    return "";
}

// ---------------------------------------

function angleToKi(rotation) {
    if (!isNaN(rotation)) {
        return rotation > 180 ? -(360 - rotation) : rotation;
    }
    return "";
}

// ---------------------------------------

function rotate(x, y, degrees) {
    const radians = (degrees / 180) * 2 * PI;
    const new_x = x * cos(radians) - y * sin(radians);
    const new_y = x * sin(radians) + y * cos(radians);
    return [new_x, new_y];
}

// ---------------------------------------

// ExporterFootprintKicad class
class ExporterFootprintKicad {
    constructor(footprint, model_3d, translation) {
        this.model_3d = model_3d;
        this.input = footprint;
        this.translation = translation;
        if (!(this.input instanceof ee_footprint)) {
            console.error("Unsupported conversion");
        } else {
            this.generateKicadFootprint();
        }
    }

    generateKicadFootprint() {
        // Convert dimensions from EasyEDA to KiCad (assumes convert_to_mm method exists)
        this.input.bbox.convert_to_mm();

        const fields = [
            this.input.pads,
            this.input.tracks,
            this.input.holes,
            this.input.vias,
            this.input.circles,
            this.input.rectangles,
            this.input.texts,
        ];
        fields.forEach(fieldArray => {
            fieldArray.forEach(field => {
                if (typeof field.convert_to_mm === "function") {
                    field.convert_to_mm();
                }
            });
        });

        // Ensure input.info exists. If not, set defaults.
        const infoData = this.input.info || { name: "unknown", fp_type: "tht" };
        const ki_info = new KiFootprintInfo({
            name: infoData.name,
            fp_type: infoData.fp_type,
        });


        let ki_3d_model_info = null;
        if (this.model_3d !== null && this.model_3d !== undefined) {
            this.model_3d.convert_to_mm();

            // @todo console.log(' Need to fix offset here...');

            // Old easyeda2kicad z calculation:
            // z: this.input.info && this.input.info.fp_type === "smd" ? -parseFloat(this.model_3d.translation.z.toFixed(2)) : 0,

            if (!this.translation.fixedZHere) {
                this.translation.fixedZHere = true;
                this.translation.z += parseFloat(this.model_3d.translation.z.toFixed(2));
            }
            ki_3d_model_info = new Ki3dModel({
                name: this.model_3d.name,
                translation: this.translation,
                rotation: new Ki3dModelBase({
                    x: (360 - this.model_3d.rotation.x) % 360,
                    y: (360 - this.model_3d.rotation.y) % 360,
                    z: (360 - this.model_3d.rotation.z) % 360,
                }),
                raw_wrl: null,
            });
        }

        this.output = new KiFootprint({
            info: ki_info,
            model_3d: ki_3d_model_info,
        });

        // For pads
        this.input.pads.forEach(ee_pad => {
            const ki_pad = new KiFootprintPad({
                type: ee_pad.hole_radius > 0 ? "thru_hole" : "smd",
                shape: KI_PAD_SHAPE.hasOwnProperty(ee_pad.shape)
                    ? KI_PAD_SHAPE[ee_pad.shape]
                    : "custom",
                pos_x: ee_pad.center_x - this.input.bbox.x,
                pos_y: ee_pad.center_y - this.input.bbox.y,
                width: Math.max(ee_pad.width, 0.01),
                height: Math.max(ee_pad.height, 0.01),
                layers:
                    (ee_pad.hole_radius <= 0 ? KI_PAD_LAYER : KI_PAD_LAYER_THT)[
                        ee_pad.layer_id
                        ] || "",
                number: ee_pad.number,
                drill: 0.0,
                orientation: angleToKi(ee_pad.rotation),
                polygon: "",
            });

            ki_pad.drill = drillToKi(
                ee_pad.hole_radius,
                ee_pad.hole_length,
                ki_pad.height,
                ki_pad.width
            );
            if (ki_pad.number.includes("(") && ki_pad.number.includes(")")) {
                const match = ki_pad.number.match(/\(([^)]+)\)/);
                if (match) {
                    ki_pad.number = match[1];
                }
            }

            // For custom polygon
            if (ki_pad.shape === "custom") {
                const point_list = ee_pad.points.split(" ").map(fpToKi);
                if (point_list.length <= 0) {
                    console.warn(
                        `PAD ${ee_pad.id} is a polygon, but has no points defined`
                    );
                } else {
                    // Set the pad width and height to the smallest value allowed by KiCad.
                    ki_pad.width = 0.005;
                    ki_pad.height = 0.005;
                    // The points of the polygon always seem to correspond to coordinates when orientation=0.
                    ki_pad.orientation = 0;
                    // Generate polygon with coordinates relative to the base pad's position.
                    let path = "";
                    for (let i = 0; i < point_list.length; i += 2) {
                        const x_val = parseFloat(
                            (point_list[i] - this.input.bbox.x - ki_pad.pos_x).toFixed(2)
                        );
                        const y_val = parseFloat(
                            (point_list[i + 1] - this.input.bbox.y - ki_pad.pos_y).toFixed(2)
                        );
                        path += `(xy ${x_val} ${y_val})`;
                    }
                    ki_pad.polygon = `\n\t\t(primitives \n\t\t\t(gr_poly \n\t\t\t\t(pts ${path}\n\t\t\t\t) \n\t\t\t\t(width 0.1) \n\t\t\t)\n\t\t)\n\t`;
                }
            }

            this.output.pads.push(ki_pad);
        });

        // For tracks
        this.input.tracks.forEach(ee_track => {
            const ki_track = new KiFootprintTrack({
                layers: KI_PAD_LAYER.hasOwnProperty(ee_track.layer_id)
                    ? KI_PAD_LAYER[ee_track.layer_id]
                    : "F.Fab",
                stroke_width: Math.max(ee_track.stroke_width, 0.01),
            });

            const point_list = ee_track.points.split(" ").map(fpToKi);
            for (let i = 0; i < point_list.length - 3; i += 2) {
                ki_track.points_start_x.push(
                    parseFloat((point_list[i] - this.input.bbox.x).toFixed(2))
                );
                ki_track.points_start_y.push(
                    parseFloat((point_list[i + 1] - this.input.bbox.y).toFixed(2))
                );
                ki_track.points_end_x.push(
                    parseFloat((point_list[i + 2] - this.input.bbox.x).toFixed(2))
                );
                ki_track.points_end_y.push(
                    parseFloat((point_list[i + 3] - this.input.bbox.y).toFixed(2))
                );
            }

            this.output.tracks.push(ki_track);
        });

        // For holes
        this.input.holes.forEach(ee_hole => {
            const ki_hole = new KiFootprintHole({
                pos_x: ee_hole.center_x - this.input.bbox.x,
                pos_y: ee_hole.center_y - this.input.bbox.y,
                size: ee_hole.radius * 2,
            });
            this.output.holes.push(ki_hole);
        });

        // For vias
        this.input.vias.forEach(ee_via => {
            const ki_via = new KiFootprintVia({
                pos_x: ee_via.center_x - this.input.bbox.x,
                pos_y: ee_via.center_y - this.input.bbox.y,
                size: ee_via.radius * 2,
                diameter: ee_via.diameter,
            });
            this.output.vias.push(ki_via);
        });

        // For circles
        this.input.circles.forEach(ee_circle => {
            const ki_circle = new KiFootprintCircle({
                cx: ee_circle.cx - this.input.bbox.x,
                cy: ee_circle.cy - this.input.bbox.y,
                end_x: 0.0,
                end_y: 0.0,
                layers: KI_LAYERS.hasOwnProperty(ee_circle.layer_id)
                    ? KI_LAYERS[ee_circle.layer_id]
                    : "F.Fab",
                stroke_width: Math.max(ee_circle.stroke_width, 0.01),
            });
            ki_circle.end_x = ki_circle.cx + ee_circle.radius;
            ki_circle.end_y = ki_circle.cy;
            this.output.circles.push(ki_circle);
        });

        // For rectangles
        this.input.rectangles.forEach(ee_rectangle => {
            const ki_rectangle = new KiFootprintRectangle({
                layers: KI_PAD_LAYER.hasOwnProperty(ee_rectangle.layer_id)
                    ? KI_PAD_LAYER[ee_rectangle.layer_id]
                    : "F.Fab",
                stroke_width: Math.max(ee_rectangle.stroke_width, 0.01),
            });
            const start_x = ee_rectangle.x - this.input.bbox.x;
            const start_y = ee_rectangle.y - this.input.bbox.y;
            const width = ee_rectangle.width;
            const height = ee_rectangle.height;

            ki_rectangle.points_start_x = [
                start_x,
                start_x + width,
                start_x + width,
                start_x,
            ];
            ki_rectangle.points_start_y = [
                start_y,
                start_y,
                start_y + height,
                start_y + height,
            ];
            ki_rectangle.points_end_x = [
                start_x + width,
                start_x + width,
                start_x,
                start_x,
            ];
            ki_rectangle.points_end_y = [
                start_y,
                start_y + height,
                start_y + height,
                start_y,
            ];

            this.output.rectangles.push(ki_rectangle);
        });

        // For arcs
        this.input.arcs.forEach(ee_arc => {
            let arc_path = ee_arc.path
                .replace(/,/g, " ")
                .replace("M ", "M")
                .replace("A ", "A");

            // Extract the start coordinates from the arc string.
            const mIndex = arc_path.indexOf("A");
            const startCoords = arc_path.substring(1, mIndex).trim().split(" ");
            let start_x = fpToKi(startCoords[0]) - this.input.bbox.x;
            let start_y = fpToKi(startCoords[1]) - this.input.bbox.y;

            let arcParameters = arc_path.substring(mIndex + 1).replace(/  /g, " ").trim();
            const parts = arcParameters.split(" ");
            const [svg_rx, svg_ry, x_axis_rotation, large_arc, sweep, end_x_str, end_y_str] =
                parts;
            const [rx, ry] = rotate(fpToKi(svg_rx), fpToKi(svg_ry), 0);
            const end_x = fpToKi(end_x_str) - this.input.bbox.x;
            const end_y = fpToKi(end_y_str) - this.input.bbox.y;
            let cx = 0.0,
                cy = 0.0,
                extent = 0.0;
            if (ry !== 0) {
                [cx, cy, extent] = computeArc(
                    start_x,
                    start_y,
                    rx,
                    ry,
                    parseFloat(x_axis_rotation),
                    large_arc === "1",
                    sweep === "1",
                    end_x,
                    end_y
                );
            }
            const ki_arc = new KiFootprintArc({
                start_x: cx,
                start_y: cy,
                end_x: end_x,
                end_y: end_y,
                angle: extent,
                layers: KI_LAYERS.hasOwnProperty(ee_arc.layer_id)
                    ? KI_LAYERS[ee_arc.layer_id]
                    : "F.Fab",
                stroke_width: Math.max(fpToKi(ee_arc.stroke_width), 0.01),
            });
            this.output.arcs.push(ki_arc);
        });

        // For texts
        this.input.texts.forEach(ee_text => {
            const ki_text = new KiFootprintText({
                pos_x: ee_text.center_x - this.input.bbox.x,
                pos_y: ee_text.center_y - this.input.bbox.y,
                orientation: angleToKi(ee_text.rotation),
                text: ee_text.text,
                layers: KI_LAYERS.hasOwnProperty(ee_text.layer_id)
                    ? KI_LAYERS[ee_text.layer_id]
                    : "F.Fab",
                font_size: Math.max(ee_text.font_size, 1),
                thickness: Math.max(ee_text.stroke_width, 0.01),
                display: ee_text.is_displayed === false ? " hide" : "",
                mirror: "",
            });
            if (ee_text.type === "N") {
                ki_text.layers = ki_text.layers.replace(".SilkS", ".Fab");
            }
            ki_text.mirror = ki_text.layers.startsWith("B") ? " mirror" : "";
            this.output.texts.push(ki_text);
        });

        // calculate the bounding box for the footprint here
    }

    getKiFootprint() {
        return this.output;
    }

    // Add new method to get content without writing to file
    getContent(model_3d_path = "${KIPRJMOD}") {
        const ki = this.output;
        let ki_lib = "";

        ki_lib += formatTemplate(KI_MODULE_INFO, {
            package_lib: "easyeda2kicad",
            package_name: ki.info.name,
            edit: "5DC5F6A4",
        });

        if (ki.info.fp_type) {
            ki_lib += formatTemplate(KI_FP_TYPE, {
                component_type: ki.info.fp_type === "smd" ? "smd" : "through_hole",
            });
        }

        // Get y_min and y_max to position component info.
        const y_values = ki.pads.map(pad => pad.pos_y);
        const y_low = Math.min(...y_values);
        const y_high = Math.max(...y_values);

        ki_lib += formatTemplate(KI_REFERENCE, { pos_x: "0", pos_y: pyStr(y_low - 4) });

        ki_lib += formatTemplate(KI_PACKAGE_VALUE, {
            package_name: ki.info.name,
            pos_x: "0",
            pos_y: pyStr(y_high + 4),
        });
        ki_lib += KI_FAB_REF;

        // ---------------------------------------
        let minY = Infinity;
        let maxY = -Infinity;
        let minX = Infinity;
        let maxX = -Infinity;
        let xPts = [];
        let yPts = [];

        const combinedTracks = ki.tracks.concat(ki.rectangles);
        combinedTracks.forEach(track => {
            for (let i = 0; i < track.points_start_x.length; i++) {
                ki_lib += formatTemplate(KI_LINE, {
                    start_x: track.points_start_x[i],
                    start_y: track.points_start_y[i],
                    end_x: track.points_end_x[i],
                    end_y: track.points_end_y[i],
                    layers: track.layers,
                    stroke_width: track.stroke_width,
                });
            }
            xPts = xPts.concat(track.points_start_x.concat(track.points_end_x));
            yPts = yPts.concat(track.points_start_y.concat(track.points_end_y));
        });

        ki.pads.forEach(pad => {
            ki_lib += formatTemplate(KI_PAD, pad);
            xPts.push(pad.pos_x + pad.width / 2);
            xPts.push(pad.pos_x - pad.width / 2);
            yPts.push(pad.pos_y + pad.height / 2);
            yPts.push(pad.pos_y - pad.height / 2);
        });

        ki.holes.forEach(hole => {
            ki_lib += formatTemplate(KI_HOLE, hole);

            xPts.push(hole.center_x + hole.radius);
            xPts.push(hole.center_x - hole.radius);
            yPts.push(hole.center_y + hole.radius);
            yPts.push(hole.center_y - hole.radius);
        });

        ki.vias.forEach(via => {
            ki_lib += formatTemplate(KI_VIA, via);

            xPts.push(via.center_x + via.radius);
            xPts.push(via.center_x - via.radius);
            yPts.push(via.center_y + via.radius);
            yPts.push(via.center_y - via.radius);
        });

        ki.circles.forEach(circle => {
            ki_lib += formatTemplate(KI_CIRCLE, circle);

            const radius = (circle.cx - circle.end_x);

            xPts.push(circle.cx + radius);
            xPts.push(circle.cx - radius);
            yPts.push(circle.cy + radius);
            yPts.push(circle.cy - radius);
        });

        ki.arcs.forEach(arc => {
            ki_lib += formatTemplate(KI_ARC, arc);
        });

        ki.texts.forEach(text => {
            ki_lib += formatTemplate(KI_TEXT, text);
        });

        // Update max/min values
        for (const p of xPts) {
            if (+p > maxX) {
                maxX = +p;
            }
            if (+p < minX) {
                minX = +p;
            }
        }
        for (const p of yPts) {
            if (+p > maxY) {
                maxY = +p;
            }
            if (+p < minY) {
                minY = +p;
            }
        }

        const hasFiniteMaxMinValues = (isFinite(minY) && isFinite(minX) && isFinite(maxY) && isFinite(maxX));

        if (ki.model_3d !== null && ki.model_3d !== undefined) {
            ki_lib += formatTemplate(KI_MODEL_3D, {
                file_3d: `/${model_3d_path}/${ki.model_3d.name}.wrl`,
                pos_x: this.translation.x - (hasFiniteMaxMinValues ? (minX + maxX) / 2 : 0),
                pos_y: this.translation.y - (hasFiniteMaxMinValues ? (minY + maxY) / 2 : 0),
                pos_z: this.translation.z,
                rot_x: ki.model_3d.rotation.x,
                rot_y: ki.model_3d.rotation.y,
                rot_z: ki.model_3d.rotation.z,
            });
        }

        if (hasFiniteMaxMinValues) {
            ki_lib += formatTemplate(KI_RECT, {
                start_x: minX - 0.5,
                start_y: minY - 0.5,
                end_x: maxX + 0.5,
                end_y: maxY + 0.5,
                layers: 'F.CrtYd',
                stroke_width: '0.05',
            });
        }

        ki_lib += KI_END_FILE;

        return ki_lib;
    }

    // Original export method now uses getContent()
    export(footprint_full_path, model_3d_path) {
        const content = this.getContent(model_3d_path);
        fs.writeFileSync(footprint_full_path, content, { encoding: "utf8" });
    }
}

module.exports = {
    ExporterFootprintKicad,
};