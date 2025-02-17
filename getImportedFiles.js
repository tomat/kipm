const fs = require('fs');
const path = require('path');
const getSymbolsFromFile = require('./getSymbolsFromFile');

async function getImportedFiles(importTmpPath, projectPath, projectDirectory, existingSymbols) {
  const result = {
    symbols: [],
    files: []
  };

  // Track only newly added symbols from .kicad_sym
  const symPath = path.join(importTmpPath, '.kicad_sym');
  if (fs.existsSync(symPath)) {
    const currentSymbols = getSymbolsFromFile(symPath);
    // Filter out existing symbols to get only new ones
    result.symbols = currentSymbols.filter(symbol => !existingSymbols.includes(symbol));
  }

  // Track footprint files (.kicad_mod)
  const prettyDir = path.join(importTmpPath, '.pretty');
  if (fs.existsSync(prettyDir)) {
    const footprintFiles = fs.readdirSync(prettyDir)
      .filter(f => f.endsWith('.kicad_mod'))
      .map(file => path.join(`${projectDirectory}.pretty`, file));
    result.files.push(...footprintFiles);
  }

  // Track 3D model files (.wrl)
  const shapesDir = path.join(importTmpPath, '.3dshapes');
  if (fs.existsSync(shapesDir)) {
    const modelFiles = fs.readdirSync(shapesDir)
      .filter(f => f.endsWith('.wrl'))
      .map(file => path.join(`${projectDirectory}.3dshapes`, file));
    result.files.push(...modelFiles);
  }

  return result;
}

module.exports = getImportedFiles;