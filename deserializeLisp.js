/**
 * Deserializes a Lisp S-expression string into a structured format while preserving whitespace
 * @param {string} input The Lisp S-expression string
 * @returns {Object} A structured representation with both content and whitespace information
 */
function deserializeLisp(input) {
    let pos = 0;
    const len = input.length;

    function isWhitespace(char) {
        return /[\s\n\r\t]/.test(char);
    }

    function readWhitespace() {
        let ws = '';
        while (pos < len && isWhitespace(input[pos])) {
            ws += input[pos];
            pos++;
        }
        return ws;
    }

    function readToken() {
        let token = '';
        while (pos < len && !isWhitespace(input[pos]) && input[pos] !== '(' && input[pos] !== ')') {
            token += input[pos];
            pos++;
        }
        return token;
    }

    function parseExpression() {
        const beforeWs = readWhitespace();
        
        if (pos >= len) {
            return {
                type: 'empty',
                beforeWs,
                afterWs: ''
            };
        }

        // Handle opening parenthesis
        if (input[pos] === '(') {
            pos++; // Skip opening paren
            const items = [];
            let insideWs = readWhitespace();

            while (pos < len && input[pos] !== ')') {
                const item = parseExpression();
                if (item.type !== 'empty') {
                    items.push(item);
                }
                insideWs = readWhitespace();
            }

            if (pos < len && input[pos] === ')') {
                pos++; // Skip closing paren
            }

            const afterWs = readWhitespace();

            return {
                type: 'list',
                items,
                beforeWs,
                insideWs,
                afterWs
            };
        }

        // Handle atom
        const value = readToken();
        if (!value) {
            return {
                type: 'empty',
                beforeWs,
                afterWs: ''
            };
        }

        const afterWs = readWhitespace();

        return {
            type: 'atom',
            value,
            beforeWs,
            afterWs
        };
    }

    const result = parseExpression();
    return result;
}

module.exports = deserializeLisp;
