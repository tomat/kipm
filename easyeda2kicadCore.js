const { EasyedaApi } = require("./easyeda/easyedaApi");
const {
    Easyeda3dModelImporter,
    EasyedaFootprintImporter,
    EasyedaSymbolImporter,
} = require("./easyeda/easyedaImporter");
const { ExporterSymbolKicad } = require("./kicad/exportKicadSymbol");
const { ExporterFootprintKicad } = require("./kicad/exportKicadFootprint");
const { Exporter3dModelKicad } = require("./kicad/exportKicad3dmodel");
const { KicadVersion } = require("./kicad/parametersKicadSymbol");

async function convertEasyedaToKicad(componentId, options = {}) {
    const {
        kicadVersion = KicadVersion.v6,
        footprintLibName = 'easyeda2kicad'
    } = options;

    // Fetch CAD data via EasyEDA API
    const api = new EasyedaApi();
    const cadData = await api.getCadDataOfComponent(componentId);
    if (!cadData || Object.keys(cadData).length === 0) {
        throw new Error(`Failed to fetch data from EasyEDA API for part ${componentId}`);
    }

    const result = {
        symbol: null,
        footprint: null,
        model3d: null
    };

    // Convert Symbol
    const symbolImporter = new EasyedaSymbolImporter(cadData);
    const easyedaSymbol = symbolImporter.getSymbol();
    const symbolExporter = new ExporterSymbolKicad(easyedaSymbol, kicadVersion);
    result.symbol = {
        name: easyedaSymbol.info.name,
        content: symbolExporter.export(footprintLibName).replace(/[\s\n]+$/, '')
    };

    // Convert Footprint
    const footprintImporter = new EasyedaFootprintImporter(cadData);
    
    const easyedaFootprint = await footprintImporter.extract_easyeda_data(
      footprintImporter.input.packageDetail.dataStr,
      footprintImporter.input.packageDetail.dataStr.head.c_para,
      footprintImporter.input.SMT && !footprintImporter.input.packageDetail.title.includes("-TH_")
    );
    const footprintExporter = new ExporterFootprintKicad(easyedaFootprint);
    
    result.footprint = {
        name: easyedaFootprint.info.name,
        content: footprintExporter.getContent() // This should return the content without writing to file
    };

    // Convert 3D Model
    const modelImporter = new Easyeda3dModelImporter(cadData, true);
    const model3d = await modelImporter.create_3d_model();
    
    if (model3d) {
        const exporter3d = new Exporter3dModelKicad(model3d);
        result.model3d = {
            name: exporter3d.output ? exporter3d.output.name : null,
            wrlContent: exporter3d.getWrlContent(), // This should return the content without writing to file
            stepContent: exporter3d.getStepContent() // This should return the content without writing to file
        };
    }

    return result;
}

module.exports = { convertEasyedaToKicad };
