const fs = require('fs');
const path = require('path');

function isComponentAlreadyImported(projectPath, lcscId) {
  const componentsJsonPath = path.join(projectPath, 'components.json');
  
  if (!fs.existsSync(componentsJsonPath)) {
    return false;
  }

  try {
    const jsonContent = fs.readFileSync(componentsJsonPath, 'utf8');
    const componentsData = JSON.parse(jsonContent);
    return componentsData.components.some(comp => comp.lcscId === lcscId);
  } catch (err) {
    console.error(`Error reading components.json: ${err}`);
    return false;
  }
}

async function updateComponentsJson(projectPath, lcscId, importedFiles) {
  const componentsJsonPath = path.join(projectPath, 'components.json');
  let componentsData = {
    components: []
  };

  if (fs.existsSync(componentsJsonPath)) {
    try {
      const jsonContent = fs.readFileSync(componentsJsonPath, 'utf8');
      componentsData = JSON.parse(jsonContent);
    } catch (err) {
      console.error(`Error reading components.json: ${err}`);
      componentsData = { components: [] };
    }
  }

  // Skip if component already exists
  if (componentsData.components.some(comp => comp.lcscId === lcscId)) {
    console.log(`Component ${lcscId} already exists in components.json, skipping update`);
    return;
  }

  const componentEntry = {
    lcscId: lcscId,
    symbols: importedFiles.symbols,
    files: importedFiles.files
  };

  componentsData.components.push(componentEntry);

  try {
    fs.writeFileSync(
      componentsJsonPath,
      JSON.stringify(componentsData, null, 2)
    );
    // console.log(`Updated components.json with LCSC ID: ${lcscId}`);
  } catch (err) {
    console.error(`Error writing to components.json: ${err}`);
  }
}

module.exports = {
  isComponentAlreadyImported,
  updateComponentsJson
};