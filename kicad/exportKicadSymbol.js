// === Global Imports ===
// Adjust the relative paths as needed for your project structure.
const {
    EasyedaPinType,
    EeSymbol,
    EeSymbolArc,
    EeSymbolBbox,
    EeSymbolCircle,
    EeSymbolEllipse,
    EeSymbolPath,
    EeSymbolPin,
    EeSymbolPolygon,
    EeSymbolPolyline,
    EeSymbolRectangle
} = require("../easyeda/parametersEasyeda");

const { SvgPathEllipticalArc, SvgPathMoveTo } = require("../easyeda/svgPathParser");

const { getMiddleArcPos } = require("../helpers");

const { computeArc } = require("./exportKicadFootprint");

const {
    KiPinType,
    KiPinStyle,
    KiSymbolPin,
    KiSymbolRectangle,
    KiSymbolCircle,
    KiSymbolArc,
    KiSymbolPolygon,
    KiSymbolInfo,
    KiSymbol,
    KicadVersion
} = require("./parametersKicadSymbol");

const eePinTypeToKiPinType = {
    [EasyedaPinType.unspecified]: KiPinType.unspecified,
    [EasyedaPinType._input]: KiPinType._input,
    [EasyedaPinType.output]: KiPinType.output,
    [EasyedaPinType.bidirectional]: KiPinType.bidirectional,
    [EasyedaPinType.power]: KiPinType.power_in,
};

function pxToMil(dim) {
    // Multiply by 10 and truncate to an integer (like Python's int())
    return Math.floor(10 * dim);
}

function pxToMm(dim) {
    return 10.0 * dim * 0.0254;
}

function convertEePins(eePins, eeBbox, kicadVersion) {
    const toKi = kicadVersion === KicadVersion.v5 ? pxToMil : pxToMm;
    const kicadPins = [];

    eePins.forEach(eePin => {
        // Parse the pin length from the pin_path string.
        const pathParts = eePin.pin_path.path.split("h");
        const pinLength = Math.abs(parseInt(parseFloat(pathParts[pathParts.length - 1])));

        const kiPin = new KiSymbolPin({
            name: eePin.name.text.replace(" ", ""),
            number: eePin.settings.spice_pin_number.replace(" ", ""),
            style: KiPinStyle.line,
            length: toKi(pinLength),
            type: eePinTypeToKiPinType[eePin.settings.type],
            orientation: eePin.settings.rotation,
            pos_x: toKi(parseInt(eePin.settings.pos_x) - parseInt(eeBbox.x)),
            pos_y: -toKi(parseInt(eePin.settings.pos_y) - parseInt(eeBbox.y)),
        });

        if (+eePin.dot.is_displayed && +eePin.clock.is_displayed) {
            kiPin.style = KiPinStyle.inverted_clock;
        } else if (+eePin.dot.is_displayed) {
            kiPin.style = KiPinStyle.inverted;
        } else if (+eePin.clock.is_displayed) {
            kiPin.style = KiPinStyle.clock;
        }

        // (The Python code contained commented-out adjustments based on rotation.)

        kicadPins.push(kiPin);
    });

    return kicadPins;
}

function convertEeRectangles(eeRectangles, eeBbox, kicadVersion) {
    const toKi = kicadVersion === KicadVersion.v5 ? pxToMil : pxToMm;
    const kicadRectangles = [];

    eeRectangles.forEach(eeRect => {
        const kiRect = new KiSymbolRectangle({
            pos_x0: toKi(parseInt(eeRect.pos_x) - parseInt(eeBbox.x)),
            pos_y0: -toKi(parseInt(eeRect.pos_y) - parseInt(eeBbox.y)),
        });
        kiRect.pos_x1 = toKi(parseInt(eeRect.width)) + kiRect.pos_x0;
        kiRect.pos_y1 = -toKi(parseInt(eeRect.height)) + kiRect.pos_y0;

        kicadRectangles.push(kiRect);
    });

    return kicadRectangles;
}

function convertEeCircles(eeCircles, eeBbox, kicadVersion) {
    const toKi = kicadVersion === KicadVersion.v5 ? pxToMil : pxToMm;

    return eeCircles.map(eeCircle => new KiSymbolCircle({
        pos_x: toKi(parseInt(eeCircle.center_x) - parseInt(eeBbox.x)),
        pos_y: -toKi(parseInt(eeCircle.center_y) - parseInt(eeBbox.y)),
        radius: toKi(eeCircle.radius),
        background_filling: eeCircle.fill_color,
    }));
}

function convertEeEllipses(eeEllipses, eeBbox, kicadVersion) {
    const toKi = kicadVersion === KicadVersion.v5 ? pxToMil : pxToMm;

    // Ellipses are not supported in KiCad; only process circles.
    return eeEllipses
        .filter(ellipse => ellipse.radius_x === ellipse.radius_y)
        .map(ellipse => new KiSymbolCircle({
            pos_x: toKi(parseInt(ellipse.center_x) - parseInt(eeBbox.x)),
            pos_y: -toKi(parseInt(ellipse.center_y) - parseInt(eeBbox.y)),
            radius: toKi(ellipse.radius_x),
        }));
}

function convertEeArcs(eeArcs, eeBbox, kicadVersion) {
    const toKi = kicadVersion === KicadVersion.v5 ? pxToMil : pxToMm;
    const kicadArcs = [];

    eeArcs.forEach(eeArc => {
        if (
            !(eeArc.path[0] instanceof SvgPathMoveTo ||
                eeArc.path[1] instanceof SvgPathEllipticalArc)
        ) {
            console.error("Can't convert this arc");
        } else {
            const kiArc = new KiSymbolArc({
                radius: toKi(Math.max(eeArc.path[1].radius_x, eeArc.path[1].radius_y)),
                angle_start: eeArc.path[1].x_axis_rotation,
                start_x: toKi(eeArc.path[0].start_x - eeBbox.x),
                start_y: toKi(eeArc.path[0].start_y - eeBbox.y),
                end_x: toKi(eeArc.path[1].end_x - eeBbox.x),
                end_y: toKi(eeArc.path[1].end_y - eeBbox.y),
            });

            const { center_x, center_y, angle_end } = computeArc({
                start_x: kiArc.start_x,
                start_y: kiArc.start_y,
                radius_x: toKi(eeArc.path[1].radius_x),
                radius_y: toKi(eeArc.path[1].radius_y),
                angle: kiArc.angle_start,
                large_arc_flag: eeArc.path[1].flag_large_arc,
                sweep_flag: eeArc.path[1].flag_sweep,
                end_x: kiArc.end_x,
                end_y: kiArc.end_y,
            });
            kiArc.center_x = center_x;
            kiArc.center_y = eeArc.path[1].flag_large_arc ? center_y : -center_y;
            kiArc.angle_end = eeArc.path[1].flag_large_arc ? (360 - angle_end) : angle_end;

            const { x: middleX, y: middleY } = getMiddleArcPos({
                center_x: kiArc.center_x,
                center_y: kiArc.center_y,
                radius: kiArc.radius,
                angle_start: kiArc.angle_start,
                angle_end: kiArc.angle_end,
            });
            kiArc.middle_x = middleX;
            kiArc.middle_y = middleY;

            kiArc.start_y = eeArc.path[1].flag_large_arc ? kiArc.start_y : -kiArc.start_y;
            kiArc.end_y = eeArc.path[1].flag_large_arc ? kiArc.end_y : -kiArc.end_y;

            kicadArcs.push(kiArc);
        }
    });

    return kicadArcs;
}

function convertEePolylines(eePolylines, eeBbox, kicadVersion) {
    const toKi = kicadVersion === KicadVersion.v5 ? pxToMil : pxToMm;
    const kicadPolygons = [];

    eePolylines.forEach(eePolyline => {
        const rawPts = eePolyline.points.split(" ");
        const xPoints = [];
        const yPoints = [];

        // Process points (assuming even number of items)
        for (let i = 0; i < rawPts.length; i += 2) {
            xPoints.push(toKi(parseInt(parseFloat(rawPts[i])) - parseInt(eeBbox.x)));
            yPoints.push(-toKi(parseInt(parseFloat(rawPts[i + 1])) - parseInt(eeBbox.y)));
        }

        // If the polyline is a polygon or has a fill color, close the shape.
        if (eePolyline instanceof EeSymbolPolygon || eePolyline.fill_color) {
            xPoints.push(xPoints[0]);
            yPoints.push(yPoints[0]);
        }
        if (xPoints.length > 0 && yPoints.length > 0) {
            const points = [];
            const numPoints = Math.min(xPoints.length, yPoints.length);
            for (let i = 0; i < numPoints; i++) {
                points.push([xPoints[i], yPoints[i]]);
            }
            const isClosed =
                xPoints[0] === xPoints[xPoints.length - 1] &&
                yPoints[0] === yPoints[yPoints.length - 1];
            const kicadPolygon = new KiSymbolPolygon({
                points,
                points_number: numPoints,
                is_closed: isClosed,
            });
            kicadPolygons.push(kicadPolygon);
        } else {
            console.warn("Skipping polygon with no parseable points");
        }
    });

    return kicadPolygons;
}

function convertEePolygons(eePolygons, eeBbox, kicadVersion) {
    // Reuse polyline conversion for polygons.
    return convertEePolylines(eePolygons, eeBbox, kicadVersion);
}

function convertEePaths(eePaths, eeBbox, kicadVersion) {
    const toKi = kicadVersion === KicadVersion.v5 ? pxToMil : pxToMm;
    const kicadPolygons = [];
    const kicadBeziers = [];

    eePaths.forEach(eePath => {
        const rawPts = eePath.paths.split(" ");
        const xPoints = [];
        const yPoints = [];
        let i = 0;
        while (i < rawPts.length) {
            const cmd = rawPts[i];
            if (cmd === "M" || cmd === "L") {
                const x = toKi(parseInt(parseFloat(rawPts[i + 1])) - parseInt(eeBbox.x));
                const y = -toKi(parseInt(parseFloat(rawPts[i + 2])) - parseInt(eeBbox.y));
                xPoints.push(x);
                yPoints.push(y);
                i += 3;
            } else if (cmd === "Z") {
                if (xPoints.length > 0 && yPoints.length > 0) {
                    xPoints.push(xPoints[0]);
                    yPoints.push(yPoints[0]);
                }
                i++;
            } else if (cmd === "C") {
                // TODO: Add bezier support.
                i += 7;
            } else {
                i++;
            }
        }
        if (xPoints.length > 0 && yPoints.length > 0) {
            const points = [];
            const numPoints = Math.min(xPoints.length, yPoints.length);
            for (let j = 0; j < numPoints; j++) {
                points.push([xPoints[j], yPoints[j]]);
            }
            const isClosed =
                xPoints[0] === xPoints[xPoints.length - 1] &&
                yPoints[0] === yPoints[yPoints.length - 1];
            const kiPolygon = new KiSymbolPolygon({
                points,
                points_number: numPoints,
                is_closed: isClosed,
            });
            kicadPolygons.push(kiPolygon);
        } else {
            console.warn("Skipping path with no parseable points");
        }
    });

    return [kicadPolygons, kicadBeziers];
}

function convertToKicad(eeSymbol, kicadVersion) {
    const kiInfo = new KiSymbolInfo({
        name: eeSymbol.info.name,
        prefix: eeSymbol.info.prefix.replace("?", ""),
        package: eeSymbol.info.package,
        manufacturer: eeSymbol.info.manufacturer,
        datasheet: eeSymbol.info.datasheet,
        lcsc_id: eeSymbol.info.lcsc_id,
        jlc_id: eeSymbol.info.jlc_id,
    });

    const kicadSymbol = new KiSymbol({
        info: kiInfo,
        pins: convertEePins(eeSymbol.pins, eeSymbol.bbox, kicadVersion),
        rectangles: convertEeRectangles(eeSymbol.rectangles, eeSymbol.bbox, kicadVersion),
        circles: convertEeCircles(eeSymbol.circles, eeSymbol.bbox, kicadVersion),
        arcs: convertEeArcs(eeSymbol.arcs, eeSymbol.bbox, kicadVersion),
    });

    // Append ellipses (converted to circles)
    kicadSymbol.circles = kicadSymbol.circles.concat(
        convertEeEllipses(eeSymbol.ellipses, eeSymbol.bbox, kicadVersion)
    );

    // Process paths (polygons and beziers)
    const [polygonsFromPaths, beziers] = convertEePaths(eeSymbol.paths, eeSymbol.bbox, kicadVersion);
    kicadSymbol.polygons = polygonsFromPaths;
    kicadSymbol.beziers = beziers;

    // Process additional polylines and polygons
    kicadSymbol.polygons = kicadSymbol.polygons.concat(
        convertEePolylines(eeSymbol.polylines, eeSymbol.bbox, kicadVersion),
        convertEePolygons(eeSymbol.polygons, eeSymbol.bbox, kicadVersion)
    );

    return kicadSymbol;
}

function tuneFootprintRefPath(kiSymbol, footprintLibName) {
    // Adjust the package reference by prepending the library name.
    kiSymbol.info.package = `${footprintLibName}:${kiSymbol.info.package}`;
}

class ExporterSymbolKicad {
    constructor(symbol, kicadVersion) {
        this.input = symbol;
        this.version = kicadVersion;
        if (this.input instanceof EeSymbol) {
            this.output = convertToKicad(this.input, kicadVersion);
        } else {
            console.error("Unknown input symbol format");
        }
    }

    export(footprintLibName) {
        tuneFootprintRefPath(this.output, footprintLibName);
        // Assuming the export method of KiSymbol accepts an object with the version.
        return this.output.export(this.version);
    }
}

// === Usage Example ===
// const exporter = new ExporterSymbolKicad(myEeSymbol, KicadVersion.v6);
// const kicadSymbolString = exporter.export("MyFootprintLib");
// console.log(kicadSymbolString);

module.exports = {
    pxToMil,
    pxToMm,
    convertEePins,
    convertEeRectangles,
    convertEeCircles,
    convertEeEllipses,
    convertEeArcs,
    convertEePolylines,
    convertEePolygons,
    convertEePaths,
    convertToKicad,
    tuneFootprintRefPath,
    ExporterSymbolKicad,
};