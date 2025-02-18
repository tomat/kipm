const zip = require("./zip")

const {
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
    EeSymbolArc
} = require("../easyeda/parametersEasyeda");

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

module.exports = easyeda_handlers;