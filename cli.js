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
  .option('--dry-run', 'Run without making any changes to files');

// Default action for root command (install all from components.txt)
program
  .action(async (options) => {
    const baseDir = process.cwd();
    const projectName = path.basename(baseDir);

    // Install all components from components.txt
    if (!fs.existsSync(path.join(baseDir, 'components.txt'))) {
      console.error('No components.txt found in current directory');
      process.exit(1);
    }

    try {
      if (options.dryRun) {
        console.log('Dry run: No files will be modified');
      }
      await installFromComponentsFile(projectName, '.', baseDir, options.dryRun);
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
  .action(async (component, options) => {
    const baseDir = process.cwd();
    const projectName = path.basename(baseDir);

    if (program.opts().dryRun) {
      console.log('Dry run: No files will be modified');
    }

    if (!component) {
      // Install all components from components.txt
      if (!fs.existsSync(path.join(baseDir, 'components.txt'))) {
        console.error('No components.txt found in current directory');
        process.exit(1);
      }

      try {
        await installFromComponentsFile(projectName, '.', baseDir, program.opts().dryRun);
        cleanupTempDir();
      } catch (error) {
        console.error(`Error installing components: ${error.message}`);
        cleanupTempDir();
        process.exit(1);
      }
    } else {
      // Install specific component
      try {
        await importComponent(projectName, '.', component, baseDir, program.opts().dryRun);
        cleanupTempDir();
      } catch (error) {
        console.error(`Error installing component: ${error.message}`);
        cleanupTempDir();
        process.exit(1);
      }
    }
  });

program.parse();