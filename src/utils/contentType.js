import {ContentType} from '../constants.js';

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/i;
const URL_REGEX = /^(https?|ftp|file):\/\/[^\s/$.?#].[^\s]*$/i;

const CODE_KEYWORDS = [
    '{', '}', '=>', ';', '</', '/>', 'const ', 'let ', 'var ',
    'function', 'class ', 'def ', 'import ', 'export ', 'return ',
    'public ', 'private ', 'namespace', 'if (', 'for (', 'while (',
    'async ', 'await ', 'console.log', '#include', '<?php', 'fn ',
    'struct ', 'impl ', 'pub ', 'type '
];

/**
 * Detect the semantic type of clipboard text
 * @param {string} text
 * @returns {string} One of ContentType values
 */
export function detectContentType(text) {
    if (!text)
        return ContentType.TEXT;

    const trimmed = text.trim();

    // 1. Hex Color check
    if (HEX_COLOR_REGEX.test(trimmed))
        return ContentType.COLOR;

    // 2. URL check
    if (URL_REGEX.test(trimmed))
        return ContentType.URL;

    // 3. Code snippet check
    if (trimmed.includes('\n') || CODE_KEYWORDS.some(keyword => trimmed.includes(keyword)))
        return ContentType.CODE;

    return ContentType.TEXT;
}
