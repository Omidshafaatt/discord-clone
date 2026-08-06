export const getFullImageUrl = (path) => {
    if (!path) return null;
    // If it's already a full URL, return it
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    // Ensure there's a leading slash
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `http://localhost:8000${normalizedPath}`;
};