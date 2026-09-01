/**
 * Formats a UNIX timestamp (milliseconds) into a human-readable relative time string
 * @param {number} timestamp
 * @returns {string} Relative time label
 */
export function formatRelativeTime(timestamp) {
    if (!timestamp)
        return '';

    const diff = Math.floor((Date.now() - timestamp) / 1000);

    if (diff < 30)
        return 'Just now';
    if (diff < 60)
        return `${diff}s ago`;
    if (diff < 3600)
        return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)
        return `${Math.floor(diff / 3600)}h ago`;

    return `${Math.floor(diff / 86400)}d ago`;
}
