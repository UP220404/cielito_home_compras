#!/usr/bin/env node

/**
 * Update all HTML files to load env.js before config.js
 */

const fs = require('fs');
const path = require('path');

// Find all HTML files that reference config.js
const files = [
  'index.html',
  'pages/login.html',
  'pages/test-usuario.html',
  'pages/no-requerimientos.html',
  'pages/analytics.html',
  'pages/reports.html',
  'pages/configuracion.html',
  'pages/notificaciones.html',
  'pages/detalle-proveedor.html',
  'pages/usuarios.html',
  'pages/proveedores.html',
  'pages/detalle-orden.html',
  'pages/ordenes-compra.html',
  'pages/detalle-cotizacion.html',
  'pages/comparacion-cotizaciones.html',
  'pages/aprobacion-cotizaciones.html',
  'pages/cotizaciones.html',
  'pages/compras-panel.html',
  'pages/detalle-solicitud.html',
  'pages/nueva-solicitud.html',
  'pages/mis-solicitudes.html',
  'pages/dashboard.html',
  'pages/suppliers.html',
  'pages/facturas.html',
  'pages/mi-presupuesto.html'
];

let updatedCount = 0;
let skippedCount = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    skippedCount++;
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Check if already has env.js
  if (content.includes('js/env.js') || content.includes('../js/env.js')) {
    console.log(`✓  Already updated: ${file}`);
    skippedCount++;
    return;
  }

  // Determine if this is in pages/ subdirectory
  const isInPages = file.startsWith('pages/');
  const jsPath = isInPages ? '../js/' : 'js/';

  // Pattern to find config.js line
  const configJsPattern = new RegExp(
    `<script src="${jsPath.replace(/\//g, '\\/')}config\\.js\\?v=[^"]*"><\\/script>`,
    'g'
  );

  // Check if config.js is present
  if (!configJsPattern.test(content)) {
    console.log(`⚠️  No config.js found in: ${file}`);
    skippedCount++;
    return;
  }

  // Replace config.js line with env.js + config.js
  const updated = content.replace(
    configJsPattern,
    `<!-- Load environment config FIRST -->\n    <script src="${jsPath}env.js?v=20251111"></script>\n    <script src="${jsPath}config.js?v=20251111v5"></script>`
  );

  // Write back
  fs.writeFileSync(filePath, updated, 'utf8');
  console.log(`✅ Updated: ${file}`);
  updatedCount++;
});

console.log(`\n📊 Summary:`);
console.log(`   ✅ Updated: ${updatedCount} files`);
console.log(`   ⏭️  Skipped: ${skippedCount} files`);
