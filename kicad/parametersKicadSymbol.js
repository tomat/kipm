// parameters_kicad_symbol.js

function dedent(text) {
    // Split the text into lines
    const lines = text.split('\n');

    // Determine the minimum indentation (ignoring blank lines)
    let minIndent = Infinity;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue; // Skip empty or whitespace-only lines
        const match = line.match(/^(\s*)/);
        if (match) {
            const indentLength = match[1].length;
            if (indentLength < minIndent) {
                minIndent = indentLength;
            }
        }
    }

    // If no non-blank lines were found, return the original text
    if (minIndent === Infinity) {
        return text;
    }

    // Remove the common leading whitespace from each line
    const dedented = lines.map(line => {
        // Only remove if the line has at least minIndent whitespace at the beginning
        return line.startsWith(' '.repeat(minIndent))
          ? line.slice(minIndent)
          : line;
    }).join('\n');

    return dedented;
}

function toFixedPreserveSign(num, decimals) {
    // Check for negative zero using Object.is
    if (Object.is(num, -0)) {
        // Return a string with the negative sign explicitly
        return '-' + (0).toFixed(decimals);
    }
    return num.toFixed(decimals);
}

// -------------------- ENUMS & CONFIGURATIONS --------------------

// KicadVersion
const KicadVersion = {
    v5: "v5",
    v6: "v6",
    v6_99: "v6_99",
};
Object.freeze(KicadVersion);

// KiPinType
const KiPinType = {
    _input: "_input",
    output: "output",
    bidirectional: "bidirectional",
    tri_state: "tri_state",
    passive: "passive",
    free: "free",
    unspecified: "unspecified",
    power_in: "power_in",
    power_out: "power_out",
    open_collector: "open_collector",
    open_emitter: "open_emitter",
    no_connect: "no_connect",
};
Object.freeze(KiPinType);

// KiPinStyle
const KiPinStyle = {
    line: "line",
    inverted: "inverted",
    clock: "clock",
    inverted_clock: "inverted_clock",
    input_low: "input_low",
    clock_low: "clock_low",
    output_low: "output_low",
    edge_clock_high: "edge_clock_high",
    non_logic: "non_logic",
};
Object.freeze(KiPinStyle);

// KiBoxFill
const KiBoxFill = {
    none: "none",
    outline: "outline",
    background: "background",
};
Object.freeze(KiBoxFill);

// Config V5 (dimensions in mil)
const KiExportConfigV5 = {
    PIN_LENGTH: 100,
    PIN_SPACING: 100,
    PIN_NUM_SIZE: 50,
    PIN_NAME_SIZE: 50,
    PIN_NAME_OFFSET: 40,
    DEFAULT_BOX_LINE_WIDTH: 0,
    FIELD_FONT_SIZE: 60,
    FIELD_OFFSET_START: 200,
    FIELD_OFFSET_INCREMENT: 100,
};
Object.freeze(KiExportConfigV5);

// Mapping dictionaries for V5
const ki_pin_type_v5_format = {
    [KiPinType._input]: "I",
    [KiPinType.output]: "O",
    [KiPinType.bidirectional]: "B",
    [KiPinType.tri_state]: "T",
    [KiPinType.passive]: "P",
    [KiPinType.free]: "U",
    [KiPinType.unspecified]: "U",
    [KiPinType.power_in]: "W",
    [KiPinType.power_out]: "W",
    [KiPinType.open_collector]: "C",
    [KiPinType.open_emitter]: "E",
    [KiPinType.no_connect]: "N",
};

const ki_pin_style_v5_format = {
    [KiPinStyle.line]: "",
    [KiPinStyle.inverted]: "I",
    [KiPinStyle.clock]: "C",
    [KiPinStyle.inverted_clock]: "F",
    [KiPinStyle.input_low]: "L",
    [KiPinStyle.clock_low]: "CL",
    [KiPinStyle.output_low]: "V",
    [KiPinStyle.edge_clock_high]: "C",
    [KiPinStyle.non_logic]: "X",
};

const ki_pin_orientation_v5_format = {
    "0": "L",
    "90": "D",
    "180": "R",
    "270": "U",
};

const ki_box_fill_v5_format = {
    [KiBoxFill.none]: "N",
    [KiBoxFill.outline]: "F",
    [KiBoxFill.background]: "f",
};

// Config V6 (dimensions in mm)
const KiExportConfigV6 = {
    PIN_LENGTH: 2.54,
    PIN_SPACING: 2.54,
    PIN_NUM_SIZE: 1.27,
    PIN_NAME_SIZE: 1.27,
    DEFAULT_BOX_LINE_WIDTH: 0,
    PROPERTY_FONT_SIZE: 1.27,
    FIELD_OFFSET_START: 5.08,
    FIELD_OFFSET_INCREMENT: 2.54,
};
Object.freeze(KiExportConfigV6);

// -------------------- HELPER FUNCTIONS --------------------

// Simple indent helper that adds a given number of spaces to each line.
function indent(str, numSpaces) {
    const spaces = " ".repeat(numSpaces);
    return str
      .split("\n")
      .map((line) => (line !== "" ? '' + spaces + '' + line : line))
      .join("\n");
}

function sanitize_fields(name) {
    return name.replace(/ /g, "").replace(/\//g, "_");
}

function apply_text_style(text, kicad_version) {
    if (text.endsWith("#")) {
        text =
          kicad_version === KicadVersion.v6
            ? `~{${text.slice(0, -1)}}`
            : `~${text.slice(0, -1)}~`;
    }
    return text;
}

function apply_pin_name_style(pin_name, kicad_version) {
    return pin_name
      .split("/")
      .map((txt) => apply_text_style(txt, kicad_version))
      .join("/");
}

// -------------------- INFO HEADER --------------------

class KiSymbolInfo {
    constructor({
                    name,
                    prefix,
                    package: pkg,
                    manufacturer,
                    datasheet,
                    lcsc_id,
                    jlc_id,
                    y_low = 0,
                    y_high = 0,
                }) {
        this.name = name;
        this.prefix = prefix;
        this.package = pkg;
        this.manufacturer = manufacturer;
        this.datasheet = datasheet;
        this.lcsc_id = lcsc_id;
        this.jlc_id = jlc_id;
        this.y_low = y_low;
        this.y_high = y_high;
    }

    export_v5() {
        let field_offset_y = KiExportConfigV5.FIELD_OFFSET_START;
        let header = [
            `DEF ${sanitize_fields(this.name)} ${this.prefix} 0 ${KiExportConfigV5.PIN_NAME_OFFSET} Y Y 1 L N`,
            `F0 "${this.prefix}" 0 ${this.y_high + field_offset_y} ${KiExportConfigV5.FIELD_FONT_SIZE} H V C CNN`,
            `F1 "${this.name}" 0 ${this.y_low - field_offset_y} ${KiExportConfigV5.FIELD_FONT_SIZE} H V C CNN`,
        ];
        if (this.package) {
            field_offset_y += KiExportConfigV5.FIELD_OFFSET_INCREMENT;
            header.push(
              `F2 "${this.package}" 0 ${this.y_low - field_offset_y} ${KiExportConfigV5.FIELD_FONT_SIZE} H I C CNN`
            );
        }
        if (this.datasheet) {
            field_offset_y += KiExportConfigV5.FIELD_OFFSET_INCREMENT;
            header.push(
              `F3 "${this.datasheet}" 0 ${this.y_low - field_offset_y} ${KiExportConfigV5.FIELD_FONT_SIZE} H I C CNN`
            );
        }
        if (this.manufacturer) {
            header.push(`F4 "${this.manufacturer}" 0 0 0 H I C CNN "Manufacturer"`);
        }
        if (this.lcsc_id) {
            header.push(`F6 "${this.lcsc_id}" 0 0 0 H I C CNN "LCSC Part"`);
        }
        if (this.jlc_id) {
            header.push(`F7 "${this.jlc_id}" 0 0 0 H I C CNN "JLC Part"`);
        }
        header.push("DRAW\n");
        return header.join("\n");
    }

    export_v6() {
        const property_template = (
          key,
          value,
          id_,
          pos_y,
          font_size,
          style,
          hide
        ) => {
            return dedent(`
        (property
          "${key}"
          "${value}"
          (id ${id_})
          (at 0 ${parseFloat(pos_y).toFixed(2)} 0)
          (effects (font (size ${font_size} ${font_size}) ${style}) ${hide})
        )
`);
        };

        let field_offset_y = KiExportConfigV6.FIELD_OFFSET_START;
        let header = [
            property_template(
              "Reference",
              this.prefix,
              0,
              this.y_high + field_offset_y,
              KiExportConfigV6.PROPERTY_FONT_SIZE,
              "",
              ""
            ),
            property_template(
              "Value",
              this.name,
              1,
              this.y_low - field_offset_y,
              KiExportConfigV6.PROPERTY_FONT_SIZE,
              "",
              ""
            ),
        ];
        if (this.package) {
            field_offset_y += KiExportConfigV6.FIELD_OFFSET_INCREMENT;
            header.push(
              property_template(
                "Footprint",
                this.package,
                2,
                this.y_low - field_offset_y,
                KiExportConfigV6.PROPERTY_FONT_SIZE,
                "",
                "hide"
              )
            );
        }
        if (this.datasheet) {
            field_offset_y += KiExportConfigV6.FIELD_OFFSET_INCREMENT;
            header.push(
              property_template(
                "Datasheet",
                this.datasheet,
                3,
                this.y_low - field_offset_y,
                KiExportConfigV6.PROPERTY_FONT_SIZE,
                "",
                "hide"
              )
            );
        }
        if (this.manufacturer) {
            field_offset_y += KiExportConfigV6.FIELD_OFFSET_INCREMENT;
            header.push(
              property_template(
                "Manufacturer",
                this.manufacturer,
                4,
                this.y_low - field_offset_y,
                KiExportConfigV6.PROPERTY_FONT_SIZE,
                "",
                "hide"
              )
            );
        }
        if (this.lcsc_id) {
            field_offset_y += KiExportConfigV6.FIELD_OFFSET_INCREMENT;
            header.push(
              property_template(
                "LCSC Part",
                this.lcsc_id,
                5,
                this.y_low - field_offset_y,
                KiExportConfigV6.PROPERTY_FONT_SIZE,
                "",
                "hide"
              )
            );
        }
        if (this.jlc_id) {
            field_offset_y += KiExportConfigV6.FIELD_OFFSET_INCREMENT;
            header.push(
              property_template(
                "JLC Part",
                this.jlc_id,
                6,
                this.y_low - field_offset_y,
                KiExportConfigV6.PROPERTY_FONT_SIZE,
                "",
                "hide"
              )
            );
        }
        return header;
    }
}

// -------------------- PIN --------------------

class KiSymbolPin {
    constructor({ name, number, style, length, type, orientation, pos_x, pos_y }) {
        this.name = name;
        this.number = number;
        this.style = style; // Should be one of KiPinStyle values.
        this.length = length;
        this.type = type; // Should be one of KiPinType values.
        this.orientation = orientation;
        this.pos_x = pos_x;
        this.pos_y = pos_y;
    }

    export_v5() {
        const orientationKey = String(this.orientation);
        const orientationFormatted = Object.prototype.hasOwnProperty.call(
          ki_pin_orientation_v5_format,
          orientationKey
        )
          ? ki_pin_orientation_v5_format[orientationKey]
          : ki_pin_orientation_v5_format["0"];
        return `X ${apply_pin_name_style(this.name, KicadVersion.v5)} ${this.number} ${this.pos_x} ${this.pos_y} ${Math.round(
          this.length
        )} ${orientationFormatted} ${KiExportConfigV5.PIN_NUM_SIZE} ${KiExportConfigV5.PIN_NAME_SIZE} 1 1 ${ki_pin_type_v5_format[this.type]} ${ki_pin_style_v5_format[this.style]}\n`;
    }

    export_v6() {
        // Remove leading underscore if present.
        const typeName =
          this.type.startsWith("_") ? this.type.slice(1) : this.type;
        const styleName = this.style;
        return dedent(`
      (pin ${typeName} ${styleName}
        (at ${toFixedPreserveSign(this.pos_x, 2)} ${toFixedPreserveSign(this.pos_y, 2)} ${((180 + +this.orientation) % 360).toFixed(0)})
        (length ${this.length})
        (name "${apply_pin_name_style(this.name, KicadVersion.v6)}" (effects (font (size ${KiExportConfigV6.PIN_NAME_SIZE} ${KiExportConfigV6.PIN_NAME_SIZE}))))
        (number "${this.number}" (effects (font (size ${KiExportConfigV6.PIN_NUM_SIZE} ${KiExportConfigV6.PIN_NUM_SIZE}))))
      )
`);
    }
}

// -------------------- RECTANGLE --------------------

class KiSymbolRectangle {
    constructor({ pos_x0 = 0, pos_y0 = 0, pos_x1 = 0, pos_y1 = 0 } = {}) {
        this.pos_x0 = pos_x0;
        this.pos_y0 = pos_y0;
        this.pos_x1 = pos_x1;
        this.pos_y1 = pos_y1;
    }

    export_v5() {
        return `S ${Math.round(this.pos_x0)} ${Math.round(this.pos_y0)} ${Math.round(
          this.pos_x1
        )} ${Math.round(this.pos_y1)} 1 1 ${KiExportConfigV5.DEFAULT_BOX_LINE_WIDTH} ${ki_box_fill_v5_format[KiBoxFill.background]}\n`;
    }

    export_v6() {
        return dedent(`
      (rectangle
        (start ${this.pos_x0.toFixed(2)} ${this.pos_y0.toFixed(2)})
        (end ${this.pos_x1.toFixed(2)} ${this.pos_y1.toFixed(2)})
        (stroke (width ${KiExportConfigV6.DEFAULT_BOX_LINE_WIDTH}) (type default) (color 0 0 0 0))
        (fill (type ${KiBoxFill.background}))
      )
`);
    }
}

// -------------------- POLYGON --------------------

class KiSymbolPolygon {
    constructor({ points = [], points_number = 0, is_closed = false } = {}) {
        this.points = points; // Array of [x, y] pairs.
        this.points_number = points_number;
        this.is_closed = is_closed;
    }

    export_v5() {
        const flatPoints = this.points.flat().join(" ");
        return `P ${this.points_number} 1 1 ${KiExportConfigV5.DEFAULT_BOX_LINE_WIDTH} ${flatPoints} ${
          this.is_closed
            ? ki_box_fill_v5_format[KiBoxFill.background]
            : ki_box_fill_v5_format[KiBoxFill.none]
        }\n`;
    }

    export_v6() {
        const polyline_path = this.points
          .map((pts) => `(xy ${toFixedPreserveSign(pts[0], 2)} ${toFixedPreserveSign(pts[1], 2)})`)
          .join(" ");
        return dedent(`
      (polyline
        (pts
          ${polyline_path}
        )
        (stroke (width ${KiExportConfigV6.DEFAULT_BOX_LINE_WIDTH}) (type default) (color 0 0 0 0))
        (fill (type ${this.is_closed ? KiBoxFill.background : KiBoxFill.none}))
      )
`);
    }
}

// -------------------- CIRCLE --------------------

class KiSymbolCircle {
    constructor({ pos_x = 0, pos_y = 0, radius = 0, background_filling = false } = {}) {
        this.pos_x = pos_x;
        this.pos_y = pos_y;
        this.radius = radius;
        this.background_filling = background_filling;
    }

    export_v5() {
        return `C ${Math.round(this.pos_x)} ${Math.round(this.pos_y)} ${Math.round(
          this.radius
        )} 1 1 ${KiExportConfigV5.DEFAULT_BOX_LINE_WIDTH} ${
          this.background_filling
            ? ki_box_fill_v5_format[KiBoxFill.background]
            : ki_box_fill_v5_format[KiBoxFill.none]
        }\n`;
    }

    export_v6() {
        return dedent(`
      (circle
        (center ${this.pos_x.toFixed(2)} ${this.pos_y.toFixed(2)})
        (radius ${this.radius.toFixed(2)})
        (stroke (width ${KiExportConfigV6.DEFAULT_BOX_LINE_WIDTH}) (type default) (color 0 0 0 0))
        (fill (type ${this.background_filling ? KiBoxFill.background : KiBoxFill.none}))
      )
`);
    }
}

// -------------------- ARC --------------------

class KiSymbolArc {
    constructor({
                    center_x = 0,
                    center_y = 0,
                    radius = 0,
                    angle_start = 0,
                    angle_end = 0,
                    start_x = 0,
                    start_y = 0,
                    middle_x = 0,
                    middle_y = 0,
                    end_x = 0,
                    end_y = 0,
                } = {}) {
        this.center_x = center_x;
        this.center_y = center_y;
        this.radius = radius;
        this.angle_start = angle_start;
        this.angle_end = angle_end;
        this.start_x = start_x;
        this.start_y = start_y;
        this.middle_x = middle_x;
        this.middle_y = middle_y;
        this.end_x = end_x;
        this.end_y = end_y;
    }

    export_v5() {
        return `A ${Math.round(this.center_x)} ${Math.round(this.center_y)} ${Math.round(
          this.radius
        )} ${Math.round(this.angle_start * 10)} ${Math.round(
          this.angle_end * 10
        )} 1 1 ${KiExportConfigV5.DEFAULT_BOX_LINE_WIDTH} ${
          this.angle_start === this.angle_end
            ? ki_box_fill_v5_format[KiBoxFill.background]
            : ki_box_fill_v5_format[KiBoxFill.none]
        } ${Math.round(this.start_x)} ${Math.round(this.start_y)} ${Math.round(
          this.end_x
        )} ${Math.round(this.end_y)}\n`;
    }

    export_v6() {
        return dedent(`
      (arc
        (start ${this.start_x.toFixed(2)} ${this.start_y.toFixed(2)})
        (mid ${this.middle_x.toFixed(2)} ${this.middle_y.toFixed(2)})
        (end ${this.end_x.toFixed(2)} ${this.end_y.toFixed(2)})
        (stroke (width ${KiExportConfigV6.DEFAULT_BOX_LINE_WIDTH}) (type default) (color 0 0 0 0))
        (fill (type ${this.angle_start === this.angle_end ? KiBoxFill.background : KiBoxFill.none}))
      )
`);
    }
}

// -------------------- BEZIER CURVE --------------------

class KiSymbolBezier {
    constructor({ points = [], points_number = 0, is_closed = false } = {}) {
        this.points = points;
        this.points_number = points_number;
        this.is_closed = is_closed;
    }

    export_v5() {
        const flatPoints = this.points.flat().join(" ");
        return `B ${this.points_number} 1 1 ${KiExportConfigV5.DEFAULT_BOX_LINE_WIDTH} ${flatPoints} ${
          this.is_closed
            ? ki_box_fill_v5_format[KiBoxFill.background]
            : ki_box_fill_v5_format[KiBoxFill.none]
        }\n`;
    }

    export_v6() {
        const polyline_path = this.points
          .map((pts) => ` (xy ${pts[0]} ${pts[1]})`)
          .join("");
        return dedent(`
      (gr_curve
        (pts${polyline_path})
        (stroke (width ${KiExportConfigV6.DEFAULT_BOX_LINE_WIDTH}) (type default) (color 0 0 0 0))
        (fill (type ${this.is_closed ? KiBoxFill.background : KiBoxFill.none}))
      )
`);
    }
}

// -------------------- SYMBOL --------------------

class KiSymbol {
    constructor({
                    info,
                    pins = [],
                    rectangles = [],
                    circles = [],
                    arcs = [],
                    polygons = [],
                    beziers = [],
                } = {}) {
        this.info = info; // Instance of KiSymbolInfo
        this.pins = pins; // Array of KiSymbolPin
        this.rectangles = rectangles; // Array of KiSymbolRectangle
        this.circles = circles; // Array of KiSymbolCircle
        this.arcs = arcs; // Array of KiSymbolArc
        this.polygons = polygons; // Array of KiSymbolPolygon
        this.beziers = beziers; // Array of KiSymbolBezier
    }

    export_handler(kicad_version) {
        if (this.pins.length > 0) {
            this.info.y_low = Math.min(...this.pins.map(pin => pin.pos_y));
            this.info.y_high = Math.max(...this.pins.map(pin => pin.pos_y));
        } else {
            this.info.y_low = 0;
            this.info.y_high = 0;
        }

        const data = {};
        for (const key in this) {
            if (Object.prototype.hasOwnProperty.call(this, key)) {
                const value = this[key];
                if (Array.isArray(value)) {
                    data[key] = value.map((item) =>
                      typeof item[`export_v${kicad_version}`] === "function"
                        ? item[`export_v${kicad_version}`]()
                        : ""
                    );
                } else if (
                  value &&
                  typeof value[`export_v${kicad_version}`] === "function"
                ) {
                    data[key] = value[`export_v${kicad_version}`]();
                }
            }
        }
        return data;
    }

    export_v5() {
        const exportData = this.export_handler("5");
        const sym_info = exportData.info;
        // Gather all graphic items from all arrays (pins, rectangles, circles, arcs, polygons, beziers)
        const graphicItems = Object.keys(exportData)
          .filter((key) => key !== "info")
          .map((key) => exportData[key])
          .flat();
        return `#
# ${sanitize_fields(this.info.name)}
#
${sym_info}${graphicItems.join("")}ENDDRAW
ENDDEF
`;
    }

    export_v6() {
        const exportData = this.export_handler("6");
        const sym_info = exportData.info;
        const sym_pins = exportData.pins;
        const graphicItems = Object.keys(exportData)
          .filter((key) => key !== "info" && key !== "pins")
          .map((key) => exportData[key])
          .flat();

        const r = indent(sym_info.join("\n"), 8);

        // console.log(({ r }));

        const x = `
      (symbol "${sanitize_fields(this.info.name)}"
        (in_bom yes)
        (on_board yes)
        ${r}
        (symbol "${sanitize_fields(this.info.name)}_0_1"
          ${indent(graphicItems.join("\n"), 10)}
          ${indent(sym_pins.join("\n"), 10)}
        )
      )
`;

        // console.log({ x: dedent(x) });

        // Use dedent to remove unwanted leading spaces, and indent() to add nested indenting where desired.
        const a = indent(dedent(x), 2);

        // console.log({ a });

        return a;
    }

    export(kicad_version) {
        let component_data =
          kicad_version === KicadVersion.v5
            ? this.export_v5()
            : this.export_v6() || "";
        // Remove extra blank lines.
        return component_data.replace(/\n\s*\n/g, "\n");
    }
}

// -------------------- EXPORTS --------------------

module.exports = {
    KicadVersion,
    KiPinType,
    KiPinStyle,
    KiBoxFill,
    KiExportConfigV5,
    ki_pin_type_v5_format,
    ki_pin_style_v5_format,
    ki_pin_orientation_v5_format,
    ki_box_fill_v5_format,
    KiExportConfigV6,
    sanitize_fields,
    apply_text_style,
    apply_pin_name_style,
    KiSymbolInfo,
    KiSymbolPin,
    KiSymbolRectangle,
    KiSymbolPolygon,
    KiSymbolCircle,
    KiSymbolArc,
    KiSymbolBezier,
    KiSymbol,
};