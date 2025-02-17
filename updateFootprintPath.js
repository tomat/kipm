const updateFootprintPathInNode = require('./updateFootprintPathInNode');
const deserializeLisp = require('./deserializeLisp');
const serializeLisp = require('./serializeLisp');

function updateFootprintPath(content, projectName) {
  // Parse the content into a structured format
  const parsed = deserializeLisp(content);
  
  // Update the footprint paths in the parsed structure
  const updated = updateFootprintPathInNode(parsed, projectName);
  
  // Serialize back to string format
  return serializeLisp(updated);
}

module.exports = updateFootprintPath;