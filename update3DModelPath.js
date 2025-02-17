const deserializeLisp = require('./deserializeLisp');
const serializeLisp = require('./serializeLisp');
const update3DModelPathInNode = require('./update3DModelPathInNode');

function update3DModelPath(content, projectName) {
  // Parse the content into a structured format
  const parsed = deserializeLisp(content);
  
  // Update the 3D model paths in the parsed structure
  const updated = update3DModelPathInNode(parsed, projectName);
  
  // Serialize back to string format
  return serializeLisp(updated);
}

module.exports = update3DModelPath;