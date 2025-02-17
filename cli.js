#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const importComponent = require('./importComponent.js');
const installFromComponentsFile = require('./installComponents.js');

function cleanupTempDir() {
  const baseDir = process.cwd();
  const tempDir = path.join(baseDir, '.kipm-tmp');

  if (fs.existsSync(tempDir)) {
    try {
      // Remove directory and all contents recursively
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up temp directory:', error);
    }
  }
}

program
  .name('kipm')
  .description('KiCad component package manager')
  .version('0.0.7');

// Default action for root command (install all from components.txt)
program
  .action(async () => {
    const baseDir = process.cwd();
    const projectName = path.basename(baseDir);

    // Install all components from components.txt
    if (!fs.existsSync(path.join(baseDir, 'components.txt'))) {
      console.error('No components.txt found in current directory');
      process.exit(1);
    }

    try {
      await installFromComponentsFile(projectName, '.', baseDir);
      // console.log('Successfully installed all components');
      cleanupTempDir();
    } catch (error) {
      console.error(`Error installing components: ${error.message}`);

      cleanupTempDir();

      process.exit(1);
    }
  });

// Install command for both specific components and components.txt
program
  .command('install [component]')
  .description('Install all components from components.txt or install a specific component')
  .action(async (component) => {
    const baseDir = process.cwd();
    const projectName = path.basename(baseDir);

    if (!component) {
      // Install all components from components.txt
      if (!fs.existsSync(path.join(baseDir, 'components.txt'))) {
        console.error('No components.txt found in current directory');
        process.exit(1);
      }

      try {
        await installFromComponentsFile(projectName, '.', baseDir);
        // console.log('Successfully installed all components');
        cleanupTempDir();
      } catch (error) {
        console.error(`Error installing components: ${error.message}`);
        cleanupTempDir();
        process.exit(1);
      }
    } else {
      // Install specific component
      try {
        await importComponent(projectName, '.', component, baseDir);
        // console.log(`Successfully installed component: ${component}`);
        cleanupTempDir();
      } catch (error) {
        console.error(`Error installing component: ${error.message}`);
        cleanupTempDir();
        process.exit(1);
      }
    }
  });

program.parse();