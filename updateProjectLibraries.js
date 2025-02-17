const fs = require('fs');
const path = require('path');

function updateProjectLibraries(projectPath, projectName) {
  const projectFile = path.join(projectPath, `${projectName}.kicad_pro`);
  
  // Read the project file
  let projectData;
  try {
    const content = fs.readFileSync(projectFile, 'utf8');
    projectData = JSON.parse(content);
  } catch (err) {
    console.error(`Error reading project file: ${err}`);
    return;
  }

  // Ensure libraries section exists
  if (!projectData.libraries) {
    projectData.libraries = {};
  }

  // Ensure arrays exist and add project name if not present
  if (!Array.isArray(projectData.libraries.pinned_footprint_libs)) {
    projectData.libraries.pinned_footprint_libs = [];
  }
  if (!Array.isArray(projectData.libraries.pinned_symbol_libs)) {
    projectData.libraries.pinned_symbol_libs = [];
  }

  // Add project name to arrays if not already present
  if (!projectData.libraries.pinned_footprint_libs.includes(projectName)) {
    projectData.libraries.pinned_footprint_libs.push(projectName);
  }
  if (!projectData.libraries.pinned_symbol_libs.includes(projectName)) {
    projectData.libraries.pinned_symbol_libs.push(projectName);
  }

  // Write back the updated project file
  try {
    fs.writeFileSync(projectFile, JSON.stringify(projectData, null, 2));
    // console.log(`Updated libraries in ${projectFile}`);
  } catch (err) {
    console.error(`Error writing project file: ${err}`);
  }
}

module.exports = updateProjectLibraries;