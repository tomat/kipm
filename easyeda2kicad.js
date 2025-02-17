#!/usr/bin/env node
// __main__.js

const fs = require("fs");
const path = require("path");
const process = require("process");
const dedent = require("dedent"); // npm install dedent
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");

const { __version__ } = require("./__version__");
const { EasyedaApi } = require("./easyeda/easyedaApi");
const {
    Easyeda3dModelImporter,
    EasyedaFootprintImporter,
    EasyedaSymbolImporter,
} = require("./easyeda/easyedaImporter");
const { EeSymbol } = require("./easyeda/parametersEasyeda");
const {
    addComponentInSymbolLibFile,
    getLocalConfig,
    idAlreadyInSymbolLib,
    setLogger,
    updateComponentInSymbolLibFile,
} = require("./helpers");
const { Exporter3dModelKicad } = require("./kicad/exportKicad3dmodel");
const { ExporterFootprintKicad } = require("./kicad/exportKicadFootprint");
const { ExporterSymbolKicad } = require("./kicad/exportKicadSymbol");
const { KicadVersion } = require("./kicad/parametersKicadSymbol");

// -------------------- Argument Parser --------------------

function getParser() {
    return yargs(hideBin(process.argv))
        .usage(
            "Usage: $0 --lcsc_id <id> [--symbol] [--footprint] [--3d] [--full] [--output <file>] [--overwrite] [--v5] [--project-relative] [--debug]"
        )
        .option("lcsc_id", {
            alias: "i",
            describe: "LCSC id",
            type: "string",
            demandOption: true,
        })
        .option("symbol", {
            describe: "Get symbol of this id",
            type: "boolean",
            default: false,
        })
        .option("footprint", {
            describe: "Get footprint of this id",
            type: "boolean",
            default: false,
        })
        .option("3d", {
            describe: "Get the 3d model of this id",
            type: "boolean",
            default: false,
        })
        .option("full", {
            describe:
                "Get the symbol, footprint and 3d model of this id",
            type: "boolean",
            default: false,
        })
        .option("output", {
            describe: "Output file (e.g. path/to/file.kicad_sym)",
            type: "string",
        })
        .option("overwrite", {
            describe:
                "Overwrite symbol and footprint lib if a component with this lcsc_id already exists",
            type: "boolean",
            default: false,
        })
        .option("v5", {
            describe: "Convert library in legacy format for KiCad 5.x",
            type: "boolean",
            default: false,
        })
        .option("project-relative", {
            describe:
                "Set the 3D file path stored relative to the project",
            type: "boolean",
            default: false,
        })
        .option("debug", {
            describe: "Set logging level to debug",
            type: "boolean",
            default: false,
        })
        .help()
        .alias("help", "h");
}

// -------------------- Validation & Helpers --------------------

function validArguments(args) {
    if (!args.lcsc_id.startsWith("C")) {
        console.error("lcsc_id should start by C....");
        return false;
    }

    if (args.full) {
        args.symbol = args.footprint = args["3d"] = true;
    }

    if (!args.symbol && !args.footprint && !args["3d"]) {
        console.error(
            dedent(`
        Missing action arguments.
          e.g.: easyeda2kicad --lcsc_id=C2040 --footprint
                easyeda2kicad --lcsc_id=C2040 --symbol
      `)
        );
        return false;
    }

    args.kicad_version = args.v5 ? KicadVersion.v5 : KicadVersion.v6;

    if (args["project-relative"] && !args.output) {
        console.error(
            dedent(`
        A project specific library path should be given with --output option when using --project-relative.
        For example:
          easyeda2kicad --lcsc_id=C2040 --full --output="C:/path/to/project" --project-relative
      `)
        );
        return false;
    }

    let baseFolder, libName;
    if (args.output) {
        // Normalize path separators
        const normalizedOutput = args.output.replace(/\\/g, "/");
        baseFolder = path.dirname(normalizedOutput);
        libName = path.basename(normalizedOutput).split(".")[0];
        if (!fs.existsSync(baseFolder)) {
            console.error(`Can't find the folder: ${baseFolder}`);
            return false;
        }
    } else {
        // Default folder: ~/Documents/Kicad/easyeda2kicad
        const homeDir = require("os").homedir();
        baseFolder = path.join(homeDir, "Documents", "Kicad", "easyeda2kicad");
        if (!fs.existsSync(baseFolder)) {
            fs.mkdirSync(baseFolder, { recursive: true });
        }
        libName = "easyeda2kicad";
        args.use_default_folder = true;
    }
    args.output = path.join(baseFolder, libName);

    // Create footprint and 3d model folders if needed.
    const footprintFolder = args.output + ".pretty";
    if (!fs.existsSync(footprintFolder)) {
        fs.mkdirSync(footprintFolder);
        console.info(`Created ${libName}.pretty footprint folder in ${baseFolder}`);
    }
    const model3DFolder = args.output + ".3dshapes";
    if (!fs.existsSync(model3DFolder)) {
        fs.mkdirSync(model3DFolder);
        console.info(`Created ${libName}.3dshapes 3D model folder in ${baseFolder}`);
    }

    const libExtension = args.kicad_version === KicadVersion.v6 ? "kicad_sym" : "lib";
    const symbolLibPath = `${args.output}.${libExtension}`;
    if (!fs.existsSync(symbolLibPath)) {
        let header;
        if (args.kicad_version === KicadVersion.v6) {
            header = dedent(`
        (kicad_symbol_lib
          (version 20211014)
          (generator https://github.com/uPesy/easyeda2kicad.py)
        )
`);
        } else {
            header = "EESchema-LIBRARY Version 2.4\n#encoding utf-8\n";
        }
        fs.writeFileSync(symbolLibPath, header, { encoding: "utf-8" });
        console.info(`Created ${libName}.${libExtension} symbol lib in ${baseFolder}`);
    }

    return true;
}

function deleteComponentInSymbolLib(libPath, componentId, componentName) {
    const currentLib = fs.readFileSync(libPath, { encoding: "utf-8" });
    // Remove the component block matching the given component name and id.
    const newData = currentLib.replace(
        new RegExp(
            `(#\\n# ${componentName}\\n#\\n.*?F6 "${componentId}".*?ENDDEF\\n)`,
            "s"
        ),
        ""
    );
    fs.writeFileSync(libPath, newData, { encoding: "utf-8" });
}

function fpAlreadyInFootprintLib(libPath, packageName) {
    const fpPath = path.join(libPath, `${packageName}.kicad_mod`);
    if (fs.existsSync(fpPath)) {
        console.warn(`The footprint for this id is already in ${libPath}`);
        return true;
    }
    return false;
}

// -------------------- Main --------------------

async function main(argv) {
    console.log(`-- easyeda2kicad.py v${__version__} --`);

    // Parse arguments.
    const parser = getParser();
    const args = parser.parseSync(argv);
    if (args.debug) {
        setLogger(null, "debug");
    } else {
        setLogger(null, "info");
    }

    if (!validArguments(args)) {
        return 1;
    }

    const componentId = args.lcsc_id;
    const kicad_version = args.kicad_version;
    const symLibExt = kicad_version === KicadVersion.v6 ? "kicad_sym" : "lib";
    const symbolLibPath = `${args.output}.${symLibExt}`;

    // Fetch CAD data via EasyEDA API.
    const api = new EasyedaApi();
    const cadData = await api.getCadDataOfComponent(componentId);
    if (!cadData || Object.keys(cadData).length === 0) {
        console.error(`Failed to fetch data from EasyEDA API for part ${componentId}`);
        return 1;
    }

    // ---------------- SYMBOL ----------------
    if (args.symbol) {
        const importer = new EasyedaSymbolImporter(cadData);
        const easyedaSymbol = importer.getSymbol();
        const idExists = idAlreadyInSymbolLib(
            symbolLibPath,
            easyedaSymbol.info.name,
            kicad_version,
        );
        if (!args.overwrite && idExists) {
            console.error("Use --overwrite to update the older symbol lib");
            return 1;
        }
        const exporter = new ExporterSymbolKicad(
            easyedaSymbol,
            kicad_version,
        );
        const footprintLibName = path.basename(args.output).split(".")[0];
        const kicadSymbolLib = exporter.export(
            footprintLibName,
        ).replace(/[\s\n]+$/, '');
        if (idExists) {
            updateComponentInSymbolLibFile(
                symbolLibPath,
                easyedaSymbol.info.name,
                kicadSymbolLib,
                kicad_version,
            );
        } else {
            addComponentInSymbolLibFile(
                symbolLibPath,
                kicadSymbolLib,
                kicad_version,
            );
        }
        console.info(
            `Created Kicad symbol for ID : ${componentId}\n` +
            `       Symbol name : ${easyedaSymbol.info.name}\n` +
            `       Library path : ${symbolLibPath}`
        );
    }

    // ---------------- FOOTPRINT ----------------
    if (args.footprint) {
        const importer = new EasyedaFootprintImporter(cadData);

        importer.output = await importer.extract_easyeda_data(
            importer.input.packageDetail.dataStr,
            importer.input.packageDetail.dataStr.head.c_para,
            importer.input.SMT && !importer.input.packageDetail.title.includes("-TH_")
        );

        const easyedaFootprint = importer.getFootprint();
        const fpLibExists = fpAlreadyInFootprintLib(
            args.output + ".pretty",
            easyedaFootprint.info.name,
        );
        if (!args.overwrite && fpLibExists) {
            console.error("Use --overwrite to replace the older footprint lib");
            return 1;
        }
        const kiFootprint = new ExporterFootprintKicad(easyedaFootprint);
        const footprintFilename = `${easyedaFootprint.info.name}.kicad_mod`;
        const footprintPath = args.output + ".pretty";
        let model3dPath = (args.output + ".3dshapes")
            .replace(/\\/g, "/")
            .replace(/^\.\//, "/");
        if (args.use_default_folder) {
            model3dPath = "${EASYEDA2KICAD}/easyeda2kicad.3dshapes";
        }
        if (args["project-relative"]) {
            model3dPath = "${KIPRJMOD}" + model3dPath;
        }
        kiFootprint.export(
            path.join(footprintPath, footprintFilename),
            model3dPath,
        );
        console.info(
            `Created Kicad footprint for ID: ${componentId}\n` +
            `       Footprint name: ${easyedaFootprint.info.name}\n` +
            `       Footprint path: ${path.join(footprintPath, footprintFilename)}`
        );
    }

    // ---------------- 3D MODEL ----------------
    if (args["3d"]) {
        const modelImporter = new Easyeda3dModelImporter(
            cadData,
            true,
        );

        modelImporter.output = await modelImporter.create_3d_model();

        const exporter3d = new Exporter3dModelKicad(
            modelImporter.output,
        );
        exporter3d.export(args.output);
        if (exporter3d.output || exporter3d.output_step) {
            const filenameWrl = exporter3d.output ? `${exporter3d.output.name}.wrl` : "";
            const filenameStep = exporter3d.output ? `${exporter3d.output.name}.step` : "";
            const lib3dPath = args.output + ".3dshapes";
            console.info(
                `Created 3D model for ID: ${componentId}\n` +
                `       3D model name: ${exporter3d.output.name}\n` +
                (filenameWrl ? `       3D model path (wrl): ${path.join(lib3dPath, filenameWrl)}\n` : "") +
                (filenameStep ? `       3D model path (step): ${path.join(lib3dPath, filenameStep)}\n` : "")
            );
        }
    }

    return 0;
}
