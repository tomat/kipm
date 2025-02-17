const fs = require('fs');
const path = require('path');
const update3DModelPath = require('./update3DModelPath');

function copyAndUpdateFootprintFiles(importTmpPath, projectPath, projectName) {
  const sourceDir = path.join(importTmpPath, '.pretty');
  const targetDir = path.join(projectPath, `${projectName}.pretty`);

  // Create target directory if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Copy all .kicad_mod files and update their 3D model paths
  if (fs.existsSync(sourceDir)) {
    const files = fs.readdirSync(sourceDir);
    files.forEach(file => {
      if (file.endsWith('.kicad_mod')) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);
        
        // Read the file content
        const content = fs.readFileSync(sourcePath, 'utf8');
        
        // Update 3D model paths in the content
        const updatedContent = update3DModelPath(content, projectName);
        
        // Write the updated content to the target file
        fs.writeFileSync(targetPath, updatedContent);
        // console.log(`Copied and updated footprint: ${file}`);
      }
    });
  }
}

module.exports = copyAndUpdateFootprintFiles;