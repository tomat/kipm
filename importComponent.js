const fs = require('fs');
const path = require('path');
const dedent = require('dedent');
const updateFpLibTable = require('./updateFpLibTable');
const updateSymLibTable = require('./updateSymLibTable');
const updateProjectLibraries = require('./updateProjectLibraries');
const updateFootprintPath = require('./updateFootprintPath');
const copyWrlFiles = require('./copyWrlFiles');
const copyAndUpdateFootprintFiles = require('./copyAndUpdateFootprintFiles');
const getSymbolsFromFile = require('./getSymbolsFromFile');
const { isComponentAlreadyImported, updateComponentsJson } = require('./componentsJson');
const getImportedFiles = require('./getImportedFiles');
const { convertEasyedaToKicad } = require('./easyeda2kicadCore');
const { KicadVersion } = require('./kicad/parametersKicadSymbol');

async function importComponent(projectName, projectDir, lcscId, baseDir, dryRun = false) {
  const projectPath = path.join(baseDir, projectDir);
  const importTmpPath = path.join(baseDir, '.kipm-tmp');
  const projectSymPath = path.join(projectPath, `${projectName}.kicad_sym`);
  const importTmpSymPath = path.join(importTmpPath, '.kicad_sym');

  // Check if component is already imported
  if (isComponentAlreadyImported(projectPath, lcscId)) {
    // Return null to indicate component was already installed
    return null;
  }

  // Create .import-tmp directory if it doesn't exist
  if (!fs.existsSync(importTmpPath) && !dryRun) {
    fs.mkdirSync(importTmpPath);
  } else if (!dryRun) {
    // Clear all files in .import-tmp directory
    const files = fs.readdirSync(importTmpPath);
    for (const file of files) {
      const filePath = path.join(importTmpPath, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
  }

  // Get existing symbols before import
  const existingSymbols = getSymbolsFromFile(projectSymPath);

  // If project sym file exists, copy it to .import-tmp/.kicad_sym
  // Otherwise create a new one with proper header
  if (fs.existsSync(projectSymPath) && !dryRun) {
    try {
      fs.copyFileSync(projectSymPath, importTmpSymPath);
    } catch (err) {
      throw new Error(`Error copying symbol file: ${err.message}`);
    }
  } else if (!dryRun) {
    // Create new symbol lib file with header
    const header = dedent(`
      (kicad_symbol_lib
        (version 20211014)
        (generator https://github.com/uPesy/easyeda2kicad.py)
      )
    `);
    fs.writeFileSync(importTmpSymPath, header, { encoding: "utf-8" });
  }

  try {
    // Convert the component using our direct JS implementation
    const convertedComponent = await convertEasyedaToKicad(lcscId, {
      footprintLibName: projectName,
      kicadVersion: KicadVersion.v6 // We always use v6 format in this context
    });

    // Write symbol to temp file
    if (convertedComponent.symbol && !dryRun) {
      // Read the file as a Buffer.
      let libData = fs.readFileSync(importTmpSymPath);
      // Remove the last two bytes (assumes these are "\n)" in UTF-8).
      let truncated = libData.slice(0, libData.length - 2);
      let newContent = Buffer.concat([
        truncated,
        Buffer.from(convertedComponent.symbol.content, "utf-8"),
        Buffer.from("\n)", "utf-8"),
      ]);
      fs.writeFileSync(importTmpSymPath, newContent);
      // Update the generator string.
      let newLibData = fs.readFileSync(importTmpSymPath, { encoding: "utf-8" });
      newLibData = newLibData.replace(
        "(generator kicad_symbol_editor)",
        "(generator https://github.com/uPesy/easyeda2kicad.py)"
      );
      fs.writeFileSync(importTmpSymPath, newLibData, { encoding: "utf-8" });
    }

    // Write footprint to temp directory
    if (convertedComponent.footprint && !dryRun) {
      const prettyDir = path.join(importTmpPath, '.pretty');
      if (!fs.existsSync(prettyDir)) {
        fs.mkdirSync(prettyDir);
      }
      fs.writeFileSync(
        path.join(prettyDir, `${convertedComponent.footprint.name}.kicad_mod`),
        convertedComponent.footprint.content
      );
    }

    // Write 3D model to temp directory
    if (convertedComponent.model3d && !dryRun) {
      const shapesDir = path.join(importTmpPath, '.3dshapes');
      if (!fs.existsSync(shapesDir)) {
        fs.mkdirSync(shapesDir);
      }
      if (convertedComponent.model3d.wrlContent) {
        fs.writeFileSync(
          path.join(shapesDir, `${convertedComponent.model3d.name}.wrl`),
          convertedComponent.model3d.wrlContent
        );
      }
      if (convertedComponent.model3d.stepContent) {
        fs.writeFileSync(
          path.join(shapesDir, `${convertedComponent.model3d.name}.step`),
          convertedComponent.model3d.stepContent
        );
      }
    }

    // Get list of all imported files before copying
    const importedFiles = await getImportedFiles(importTmpPath, projectPath, projectName, existingSymbols);

    // Count footprints and 3D models
    const prettyDir = path.join(importTmpPath, '.pretty');
    const shapesDir = path.join(importTmpPath, '.3dshapes');
    
    let footprintCount = 0;
    let modelCount = 0;
    
    if (fs.existsSync(prettyDir)) {
      footprintCount = fs.readdirSync(prettyDir).filter(f => f.endsWith('.kicad_mod')).length;
    }
    
    if (fs.existsSync(shapesDir)) {
      modelCount = fs.readdirSync(shapesDir).filter(f => f.endsWith('.wrl')).length;
    }

    if (!dryRun) {
      // Copy .wrl files from .import-tmp/.3dshapes to project.3dshapes
      copyWrlFiles(importTmpPath, projectPath, projectName);
      
      // Copy and update .kicad_mod files from .import-tmp/.pretty to project.pretty
      copyAndUpdateFootprintFiles(importTmpPath, projectPath, projectName);
      
      // Read the generated symbol file
      const symContent = fs.readFileSync(importTmpSymPath, 'utf8');
      
      // Update only footprint paths in the content
      const updatedContent = updateFootprintPath(symContent, projectName);
      
      // Write the updated content back to the file
      fs.writeFileSync(importTmpSymPath, updatedContent);
      
      // Copy back the modified .kicad_sym file
      fs.copyFileSync(importTmpSymPath, projectSymPath);

      // Update project libraries
      updateProjectLibraries(projectPath, projectName);

      // Update fp-lib-table
      updateFpLibTable(projectPath, projectName);

      // Update sym-lib-table
      updateSymLibTable(projectPath, projectName);

      // Update components.json with the imported component and its files
      await updateComponentsJson(projectPath, lcscId, importedFiles);
    }

    // Return the result
    return {
      symbolName: importedFiles.symbols ? importedFiles.symbols[0] : undefined,
      footprintCount,
      modelCount
    };

  } catch (err) {
    throw err;
  }
}

module.exports = importComponent;