function updateFootprintPathInNode(node, projectName) {
  if (node.type === 'list') {
    // Check if this is a Footprint property
    if (node.items.length >= 3 &&
        node.items[0].type === 'atom' && node.items[0].value === 'property' &&
        node.items[1].type === 'atom' && node.items[1].value === '"Footprint"' &&
        node.items[2].type === 'atom') {
      
      // Extract the current footprint path
      let footprintPath = node.items[2].value.replace(/^"|"$/g, ''); // Remove quotes
      
      // If path already has a prefix, remove it
      if (footprintPath.includes(':')) {
        footprintPath = footprintPath.split(':')[1];
      }
      
      // Update the footprint path with new prefix
      node.items[2].value = `"${projectName}:${footprintPath}"`;
    }
    
    // Recursively process all items in the list
    node.items.forEach(item => updateFootprintPathInNode(item, projectName));
  }
  
  return node;
}

module.exports = updateFootprintPathInNode;