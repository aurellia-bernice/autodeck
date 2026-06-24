// Reference shape for the browser globals expected by index.html.
// api-config.js is tracked and intentionally empty; real API keys live in
// Firebase Cloud Function secrets, not in browser-delivered files.

// Free — get one at: https://aistudio.google.com/app/apikey
// Used server-side for optional search keyword refinement and Imagen helpers.
window.GEMINI_API_KEY = '';

// Free — register at: https://unsplash.com/developers  (Demo: 50 req/hr)
// Used server-side by the searchImages callable.
window.UNSPLASH_ACCESS_KEY = '';
