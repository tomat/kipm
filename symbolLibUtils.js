const fs = require('fs');
const { KicadVersion } = require('./kicad/parametersKicadSymbol');

function idAlreadyInSymbolLib(libPath, componentName, kicadVersion) {
  if (!fs.existsSync(libPath)) {
    return false;
  }
  const content = fs.readFileSync(libPath, 'utf8');
  const pattern = kicadVersion === KicadVersion.V5 ? `DEF ${componentName}` : `symbol "${componentName}"`;
  return content.includes(pattern);
}

function updateComponentInSymbolLibFile(libPath, componentName, componentContent, kicadVersion) {
  if (!fs.existsSync(libPath)) {
    throw new Error(`Symbol library file ${libPath} not found`);
  }
  const content = fs.readFileSync(libPath, 'utf8');
  const pattern = kicadVersion === KicadVersion.V5 ?
    new RegExp(`\\n?# ${componentName}[\\s\\S]*?ENDDEF[\\s]*`, 'm') :
    new RegExp(`\\n?#[\\s\\S]*?symbol "${componentName}"[\\s\\S]*?\\)\\n`, 'm');
  const updatedContent = content.replace(pattern, '\n' + componentContent);
  fs.writeFileSync(libPath, updatedContent);
}

function addComponentInSymbolLibFile(libPath, componentContent, kicadVersion) {
  if (!fs.existsSync(libPath)) {
    const defaultContent = kicadVersion === KicadVersion.V5 ?
      'EESchema-LIBRARY Version 2.4\n#encoding utf-8\n' :
      '(kicad_symbol_lib (version 20211014) (generator kicad_symbol_editor)\n)\n';
    fs.writeFileSync(libPath, defaultContent);
  }
  const content = fs.readFileSync(libPath, 'utf8');
  const newContent = kicadVersion === KicadVersion.V5 ?
    content + componentContent :
    content.replace(/\)\s*$/, componentContent + ')');
  fs.writeFileSync(libPath, newContent);
}

module.exports = {
  idAlreadyInSymbolLib,
  updateComponentInSymbolLibFile,
  addComponentInSymbolLibFile
};