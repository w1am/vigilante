/**
 * This hook is necessary because electron-builder's dependency collector fails
 * to properly resolve transitive dependencies when using Bun's symlinked
 * node_modules structure. The collector only bundles ~66 of ~350 required
 * modules, causing runtime errors.
 */
const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const applicationDirectory = path.join(context.appOutDir, 'resources', 'app');
  const source = path.join(context.packager.projectDir, 'node_modules');
  const target = path.join(applicationDirectory, 'node_modules');

  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }

  fs.cpSync(source, target, { recursive: true });
};
