const fs = require('fs');
const path = require('path');

// Lista de archivos HTML a actualizar
const htmlFiles = [
  // Frontend root
  'frontend/index.html',
  'frontend/404.html',
  // Pages
  'frontend/pages/suppliers.html',
  'frontend/pages/analytics.html',
  'frontend/pages/reports.html',
  'frontend/pages/notificaciones.html',
  'frontend/pages/detalle-proveedor.html',
  'frontend/pages/test-usuario.html',
  'frontend/pages/detalle-cotizacion.html',
  'frontend/pages/ordenes-compra.html',
  'frontend/pages/detalle-solicitud.html',
  'frontend/pages/aprobacion-cotizaciones.html',
  'frontend/pages/proveedores.html',
  'frontend/pages/compras-panel.html',
  'frontend/pages/comparacion-cotizaciones.html',
  'frontend/pages/cotizaciones.html',
  'frontend/pages/detalle-orden.html',
  'frontend/pages/no-requerimientos.html',
  'frontend/pages/usuarios.html',
  'frontend/pages/login.html',
  'frontend/pages/mi-presupuesto.html',
  'frontend/pages/facturas.html',
  'frontend/pages/nueva-solicitud.html',
  'frontend/pages/dashboard.html',
  'frontend/pages/mis-solicitudes.html',
  'frontend/pages/configuracion.html'
];

console.log('🎨 Agregando favicon a todos los archivos HTML...\n');

let successCount = 0;
let errorCount = 0;

htmlFiles.forEach(filePath => {
  try {
    const fullPath = path.join(__dirname, filePath);

    // Leer el archivo
    let content = fs.readFileSync(fullPath, 'utf8');

    // Verificar si ya tiene favicon
    if (content.includes('rel="icon"') || content.includes('favicon')) {
      console.log(`⏭️  ${filePath} - Ya tiene favicon, omitiendo`);
      return;
    }

    // Determinar la ruta correcta del favicon según la ubicación del archivo
    let faviconPath;
    if (filePath.startsWith('frontend/pages/')) {
      faviconPath = '../img/cielitohome.png';
    } else {
      faviconPath = 'img/cielitohome.png';
    }

    // Crear la etiqueta del favicon
    const faviconTag = `    <link rel="icon" type="image/png" href="${faviconPath}">`;

    // Buscar la etiqueta <head> y agregar el favicon después
    if (content.includes('<head>')) {
      content = content.replace(
        /<head>/,
        `<head>\n${faviconTag}`
      );

      // Guardar el archivo
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ ${filePath} - Favicon agregado`);
      successCount++;
    } else {
      console.log(`❌ ${filePath} - No se encontró etiqueta <head>`);
      errorCount++;
    }

  } catch (error) {
    console.log(`❌ ${filePath} - Error: ${error.message}`);
    errorCount++;
  }
});

console.log(`\n📊 Resumen:`);
console.log(`   ✅ Archivos actualizados: ${successCount}`);
console.log(`   ❌ Errores: ${errorCount}`);
console.log(`   📁 Total procesados: ${htmlFiles.length}`);
console.log('\n✨ ¡Proceso completado!');
