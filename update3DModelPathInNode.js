const path = require('path');

function update3DModelPathInNode(node, projectName) {
  if (node.type === 'list') {
    // Check if this is a model path
    if (node.items.length >= 2 &&
        node.items[0].type === 'atom' && node.items[0].value === 'model' &&
        node.items[1].type === 'atom' && node.items[1].value.includes('.wrl')) {
      
      // Update the model path to point to the new location
      const modelPath = node.items[1].value.replace(/^"|"$/g, ''); // Remove quotes
      const modelFileName = path.basename(modelPath);
      node.items[1].value = `"./${projectName}.3dshapes/${modelFileName}"`;
    }
    
    // Recursively process all items in the list
    node.items.forEach(item => update3DModelPathInNode(item, projectName));
  }
  
  return node;
}

module.exports = update3DModelPathInNode;