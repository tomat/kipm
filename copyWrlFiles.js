const fs = require('fs');
const path = require('path');

function copyWrlFiles(importTmpPath, projectPath, projectName) {
  const sourceDir = path.join(importTmpPath, '.3dshapes');
  const targetDir = path.join(projectPath, `${projectName}.3dshapes`);

  // Create target directory if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Copy all .wrl files
  if (fs.existsSync(sourceDir)) {
    const files = fs.readdirSync(sourceDir);
    files.forEach(file => {
      if (file.endsWith('.wrl')) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);
        fs.copyFileSync(sourcePath, targetPath);
      }
    });
  }
}

module.exports = copyWrlFiles;