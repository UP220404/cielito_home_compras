// Environment configuration loader
// This file loads environment-specific configuration at runtime

/**
 * Environment variables for the frontend
 *
 * In production (Vercel), this file should be generated/replaced with actual values
 * In development, it uses default local values
 */

// Default configuration (development)
const ENV_CONFIG = {
  API_URL: 'http://localhost:3000/api',
  APP_NAME: 'Sistema de Compras Cielito Home',
  APP_VERSION: '1.0.0',
  ENVIRONMENT: 'development'
};

// Try to detect production environment
const isProduction = window.location.hostname !== 'localhost' &&
                     window.location.hostname !== '127.0.0.1';

// Override with production values if detected
if (isProduction) {
  // These values should be replaced by Vercel environment variables
  // via vercel.json rewrites or a build script
  ENV_CONFIG.API_URL = window.__ENV?.API_URL || 'https://gestion-compras-ch.onrender.com/api';
  ENV_CONFIG.ENVIRONMENT = 'production';
}

// Log current environment (only in development)
if (!isProduction) {
  console.log('🔧 Environment Config:', ENV_CONFIG);
}

// Make available globally
window.ENV = ENV_CONFIG;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ENV_CONFIG;
}
