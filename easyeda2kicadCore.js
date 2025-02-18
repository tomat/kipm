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
const LcscComponent = require("./LcscComponent");

async function convertEasyedaToKicad(componentId, options = {}) {
    const {
        kicadVersion = KicadVersion.v6,
        footprintLibName = 'easyeda2kicad'
    } = options;

    const lcscComponent = new LcscComponent(componentId, kicadVersion, footprintLibName);

    const api = new EasyedaApi();
    lcscComponent.setCadData(await api.getCadDataOfComponent(componentId));

    const uuid = lcscComponent.get3DModelInfo().uuid;
    const rawObj = await api.getRaw3dModelObj(uuid);
    const step = await api.getStep3dModel(uuid);
    lcscComponent.set3dRawObj(rawObj);
    lcscComponent.set3dStep(step);

    const result = {
        symbol: lcscComponent.createSymbolResult(),
        footprint: await lcscComponent.createFootprintResult(),
        model3d: await lcscComponent.create3dModelResult()
    };

    return result;
}

module.exports = { convertEasyedaToKicad };