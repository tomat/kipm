// --- Helper: zip two arrays into an object ---
function zip(arr, values) {
    const result = {};
    const len = Math.min(arr.length, values.length);
    for (let i = 0; i < len; i++) {
        result[arr[i]] = values[i];
    }
    return result;
}

module.exports = zip;
