const fs = require('fs');
const path = require('path');
const deserializeLisp = require('./deserializeLisp');
const serializeLisp = require('./serializeLisp');

function updateFpLibTable(projectPath, projectName) {
  const fpLibTablePath = path.join(projectPath, 'fp-lib-table');
  let parsed;
  
  // Create the project library entry with proper formatting
  const projectLibEntry = {
    type: 'list',
    beforeWs: '  ',
    afterWs: '\n',
    items: [
      { type: 'atom', value: 'lib', beforeWs: '', afterWs: ' ' },
      { type: 'list', beforeWs: '', afterWs: '',
        items: [
          { type: 'atom', value: 'name', beforeWs: '', afterWs: ' ' },
          { type: 'atom', value: `"${projectName}"`, beforeWs: '', afterWs: '' }
        ]
      },
      { type: 'list', beforeWs: '', afterWs: '',
        items: [
          { type: 'atom', value: 'type', beforeWs: '', afterWs: ' ' },
          { type: 'atom', value: '"KiCad"', beforeWs: '', afterWs: '' }
        ]
      },
      { type: 'list', beforeWs: '', afterWs: '',
        items: [
          { type: 'atom', value: 'uri', beforeWs: '', afterWs: ' ' },
          { type: 'atom', value: `"\${KIPRJMOD}/${projectName}.pretty"`, beforeWs: '', afterWs: '' }
        ]
      },
      { type: 'list', beforeWs: '', afterWs: '',
        items: [
          { type: 'atom', value: 'options', beforeWs: '', afterWs: ' ' },
          { type: 'atom', value: '""', beforeWs: '', afterWs: '' }
        ]
      },
      { type: 'list', beforeWs: '', afterWs: '',
        items: [
          { type: 'atom', value: 'descr', beforeWs: '', afterWs: ' ' },
          { type: 'atom', value: '""', beforeWs: '', afterWs: '' }
        ]
      }
    ]
  };
  
  // If file exists, read and parse it
  if (fs.existsSync(fpLibTablePath)) {
    const content = fs.readFileSync(fpLibTablePath, 'utf8');
    parsed = deserializeLisp(content);
  } else {
    // Create new fp-lib-table structure with exact formatting
    parsed = {
      type: 'list',
      beforeWs: '',
      afterWs: '\n',
      items: [
        { type: 'atom', value: 'fp_lib_table', beforeWs: '', afterWs: '\n  ' },
        { type: 'list', beforeWs: '', afterWs: '\n',
          items: [
            { type: 'atom', value: 'version', beforeWs: '', afterWs: ' ' },
            { type: 'atom', value: '7', beforeWs: '', afterWs: '' }
          ]
        }
      ]
    };
  }

  // Look for existing lib entry with same name
  let found = false;
  if (parsed.items.length > 0) {
    for (let i = 0; i < parsed.items.length; i++) {
      const item = parsed.items[i];
      if (item.type === 'list' && item.items[0].value === 'lib') {
        // Check the name field
        const nameField = item.items.find(subItem => 
          subItem.type === 'list' && 
          subItem.items[0].value === 'name'
        );
        if (nameField && nameField.items[1].value === `"${projectName}"`) {
          found = true;
          break;
        }
      }
    }
  }

  // Add project library if not found
  if (!found) {
    parsed.items.push(projectLibEntry);
  }

  // Write back to file
  try {
    const updatedContent = serializeLisp(parsed);
    fs.writeFileSync(fpLibTablePath, updatedContent);
    // console.log(`Updated ${fpLibTablePath}`);
  } catch (err) {
    console.error(`Error writing fp-lib-table: ${err}`);
  }
}

module.exports = updateFpLibTable;