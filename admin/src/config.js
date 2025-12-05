// API Base URL configuration
// In production (built version), use relative path so it works with the deployed backend
// In development, use localhost:8080 for local dev server
const API_BASE_URL = import.meta.env.MODE === 'production'
    ? '/api'  // Relative path for production
    : 'http://localhost:8080/api';  // Absolute path for development

export default API_BASE_URL;
