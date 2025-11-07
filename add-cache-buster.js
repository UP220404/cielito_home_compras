const fs = require('fs');
const path = require('path');

// Versión del archivo para romper cache
const VERSION = '20251107v3';

// Archivos HTML que necesitan actualización
const htmlFiles = [
  'frontend/index.html',
  'frontend/404.html',
  'frontend/pages/suppliers.html',
  'frontend/pages/dashboard.html',
  'frontend/pages/mis-solicitudes.html',
  'frontend/pages/nueva-solicitud.html',
  'frontend/pages/detalle-solicitud.html',
  'frontend/pages/compras-panel.html',
  'frontend/pages/cotizaciones.html',
  'frontend/pages/aprobacion-cotizaciones.html',
  'frontend/pages/comparacion-cotizaciones.html',
  'frontend/pages/detalle-cotizacion.html',
  'frontend/pages/ordenes-compra.html',
  'frontend/pages/detalle-orden.html',
  'frontend/pages/proveedores.html',
  'frontend/pages/detalle-proveedor.html',
  'frontend/pages/usuarios.html',
  'frontend/pages/configuracion.html',
  'frontend/pages/notificaciones.html',
  'frontend/pages/reports.html',
  'frontend/pages/analytics.html',
  'frontend/pages/no-requerimientos.html',
  'frontend/pages/login.html',
  'frontend/pages/test-usuario.html'
];

console.log('🔧 Agregando cache-buster a config.js...\n');

let updated = 0;
let skipped = 0;

htmlFiles.forEach(file => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Archivo no encontrado: ${file}`);
    skipped++;
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Buscar y reemplazar la referencia a config.js
  // Puede estar con o sin versión previa
  const oldPattern1 = /<script src="\.\.\/js\/config\.js"><\/script>/g;
  const oldPattern2 = /<script src="\.\.\/js\/config\.js\?v=[^"]+"><\/script>/g;
  const oldPattern3 = /<script src="js\/config\.js"><\/script>/g;
  const oldPattern4 = /<script src="js\/config\.js\?v=[^"]+"><\/script>/g;

  let modified = false;

  // Para páginas en /pages/
  if (file.includes('pages/')) {
    if (content.match(oldPattern1) || content.match(oldPattern2)) {
      content = content.replace(oldPattern1, `<script src="../js/config.js?v=${VERSION}"></script>`);
      content = content.replace(oldPattern2, `<script src="../js/config.js?v=${VERSION}"></script>`);
      modified = true;
    }
  } else {
    // Para index.html y 404.html
    if (content.match(oldPattern3) || content.match(oldPattern4)) {
      content = content.replace(oldPattern3, `<script src="js/config.js?v=${VERSION}"></script>`);
      content = content.replace(oldPattern4, `<script src="js/config.js?v=${VERSION}"></script>`);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file}`);
    updated++;
  } else {
    console.log(`⏭️  ${file} (sin cambios)`);
    skipped++;
  }
});

console.log(`\n✨ Proceso completado:`);
console.log(`   ${updated} archivos actualizados`);
console.log(`   ${skipped} archivos sin cambios`);
console.log(`\n📌 Versión: ${VERSION}`);
console.log('\n💡 Ahora recarga el navegador con Ctrl+Shift+R (hard reload)');
