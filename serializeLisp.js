/**
 * Serializes a structured Lisp expression back into a string,
 * preserving all whitespace from the original format
 * @param {Object} node The structured Lisp expression node
 * @returns {string} The formatted Lisp S-expression string
 */
function serializeLisp(node) {
    if (!node || node.type === 'empty') {
        return '';
    }

    switch (node.type) {
        case 'atom':
            return (node.beforeWs || '') + node.value + (node.afterWs || '');

        case 'list': {
            const items = node.items.map(item => serializeLisp(item)).join('');
            return (node.beforeWs || '') + '(' + (node.insideWs || '') + items + ')' + (node.afterWs || '');
        }

        default:
            throw new Error(`Unknown node type: ${node.type}`);
    }
}

module.exports = serializeLisp;