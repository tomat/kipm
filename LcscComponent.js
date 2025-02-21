const {EeSymbol, EeSymbolBbox} = require("./easyeda/parametersEasyeda");

const easyeda_handlers = require("./helpers/easyeda_handlers")
const {ExporterSymbolKicad} = require("./kicad/exportKicadSymbol");
const {EasyedaFootprintImporter, Easyeda3dModelImporter} = require("./easyeda/easyedaImporter");
const {ExporterFootprintKicad} = require("./kicad/exportKicadFootprint");
const {Exporter3dModelKicad} = require("./kicad/exportKicad3dmodel");
const { Ki3dModelBase } = require("./kicad/parametersKicadFootprint");

class LcscComponent {
    constructor(lcscId, kicadVersion, footprintLibName) {
        if (!lcscId || typeof lcscId !== 'string') {
            throw new Error('LCSC ID is required and must be a string');
        }
        this.lcscId = lcscId;
        this.kicadVersion = kicadVersion;
        this.footprintLibName = footprintLibName;
        this.source = {
            cadData: null,
            '3dRawObj': null,
            '3dStep': null,
        };
        this.translation = new Ki3dModelBase({
            x: 0,
            y: 0,
            z: 0,
        });
    }

    getId() {
        return this.lcscId;
    }

    getKicadVersion() {
        return this.kicadVersion;
    }

    getFootprintLibName() {
        return this.footprintLibName;
    }

    set3dRawObj(data) {
        this.source["3dRawObj"] = data;
    }

    get3dRawObj(data) {
        return this.source["3dRawObj"];
    }

    set3dStep(data) {
        this.source["3dStep"] = data;
    }

    get3dStep(data) {
        return this.source["3dStep"];
    }

    setCadData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('CAD data must be a non-null object');
        }
        this.source.cadData = data;
        return this;
    }

    getCadData() {
        if (!this.source.cadData) {
            throw new Error(`No CAD data available for ${this.lcscId}`);
        }
        return this.source.cadData;
    }

    get3DModelInfo() {
        for (const line of this.getCadData().packageDetail.dataStr.shape) {
            const ee_designator = line.split("~")[0];
            if (ee_designator === "SVGNODE") {
                const raw_json = line.split("~").slice(1)[0];
                return JSON.parse(raw_json).attrs;
            }
        }
        return {};
    }

    async create3dModel() {
        const modelImporter = new Easyeda3dModelImporter(this);
        const model3d = await modelImporter.create_3d_model();

        return model3d;
    }

    async createEasyedaFootprint() {
        return await this.createEasyedaFootprintImporter().extract_easyeda_data(
          this.getCadData().packageDetail.dataStr,
          this.getCadData().packageDetail.dataStr.head.c_para,
          this.getCadData().SMT && !this.getCadData().packageDetail.title.includes("-TH_")
        );
    }

    createEasyedaFootprintImporter() {
        return new EasyedaFootprintImporter(this.getCadData());
    }

    async createExporterFootprintKicad() {
        const f = await this.createEasyedaFootprint();
        return new ExporterFootprintKicad(f, await this.create3dModel(), this.translation);
    }

    async createFootprintResult() {
        const easyedaFootprint = await this.createEasyedaFootprint();
        const footprintExporter = await this.createExporterFootprintKicad();

        return {
            name: easyedaFootprint.info.name,
            content: footprintExporter.getContent() // This should return the content without writing to file
        };
    }

    async create3dModelResult() {
        const model3d = await this.create3dModel();

        if (model3d) {
            const exporter3d = new Exporter3dModelKicad(model3d);
            return {
                name: exporter3d.output ? exporter3d.output.name : null,
                wrlContent: exporter3d.getWrlContent(), // This should return the content without writing to file
                stepContent: exporter3d.getStepContent() // This should return the content without writing to file
            };
        }
    }

    createSymbolResult() {
        return {
            name: this.createEeSymbol().info.name,
            content: this.createExporterSymbolKicad().export(this.footprintLibName).replace(/[\s\n]+$/, '')
        };
    }

    createExporterSymbolKicad() {
        return new ExporterSymbolKicad(this.createEeSymbol(), this.kicadVersion);
    }
    
    createEeSymbol() {
        const componentParameters = this.getCadData().dataStr.head.c_para;

        const new_ee_symbol = new EeSymbol({
            info: {
                name: componentParameters["name"],
                prefix: componentParameters["pre"],
                package: componentParameters["package"] || null,
                manufacturer: componentParameters["BOM_Manufacturer"] || null,
                datasheet: this.getCadData().lcsc ? this.getCadData().lcsc.url : null,
                lcsc_id: this.getCadData().lcsc ? this.getCadData().lcsc.number : null,
                jlc_id: componentParameters["BOM_JLCPCB Part Class"] || null,
            },
            bbox: new EeSymbolBbox({
                x: parseFloat(this.getCadData().dataStr.head.x),
                y: parseFloat(this.getCadData().dataStr.head.y),
            }),
        });

        this.getCadData().dataStr.shape.forEach((line) => {
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

module.exports = LcscComponent;