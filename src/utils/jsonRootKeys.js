/**
 * Capitalize the first character of a JSON object property name; remainder unchanged.
 * Used for persisted top-level (root) keys on note JSON.
 * @param {string} key
 * @returns {string}
 */
export function capitalizeJsonRootKey(key) {
    const s = String(key ?? '');
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Shallow: only top-level keys of a plain object. Arrays and non-objects returned as-is.
 * @param {unknown} value
 * @returns {unknown}
 */
export function withCapitalizedJsonRootKeys(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
        out[capitalizeJsonRootKey(k)] = v;
    }
    return out;
}
