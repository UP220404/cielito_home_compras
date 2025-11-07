const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Actualizando links de notificaciones de órdenes de compra...\n');

db.serialize(() => {
  // Primero verificar las notificaciones con links a detalle-orden
  db.all(`SELECT id, link FROM notifications WHERE link LIKE '%detalle-orden.html%'`, (err, rows) => {
    if (err) {
      console.error('❌ Error consultando notificaciones:', err);
      db.close();
      return;
    }

    if (rows.length === 0) {
      console.log('✅ No hay notificaciones con links a detalle-orden.html que actualizar');
      db.close();
      return;
    }

    console.log(`📋 Encontradas ${rows.length} notificaciones con links a detalle-orden.html:`);
    rows.forEach(row => {
      console.log(`  - ID ${row.id}: ${row.link}`);
    });

    console.log('\n🔧 Actualizando links...\n');

    // Actualizar cada notificación individualmente para extraer el order_id y buscar el request_id
    let processed = 0;
    let errors = 0;

    rows.forEach((notification, index) => {
      // Extraer el order ID del link: pages/detalle-orden.html?id=X
      const match = notification.link.match(/detalle-orden\.html\?id=(\d+)/);
      if (!match) {
        console.log(`⚠️  No se pudo extraer order_id de: ${notification.link}`);
        errors++;
        return;
      }

      const orderId = match[1];

      // Buscar el request_id asociado a esta orden
      db.get('SELECT request_id FROM purchase_orders WHERE id = ?', [orderId], (err, order) => {
        if (err) {
          console.error(`❌ Error buscando orden ${orderId}:`, err);
          errors++;
        } else if (order) {
          const newLink = `pages/detalle-solicitud.html?id=${order.request_id}`;

          db.run('UPDATE notifications SET link = ? WHERE id = ?', [newLink, notification.id], (err) => {
            if (err) {
              console.error(`❌ Error actualizando notificación ${notification.id}:`, err);
              errors++;
            } else {
              console.log(`✅ Notificación ${notification.id}: ${notification.link} → ${newLink}`);
              processed++;
            }

            // Si es la última notificación, mostrar resumen
            if (index === rows.length - 1) {
              setTimeout(() => {
                console.log(`\n📊 Resumen:`);
                console.log(`  - Procesadas: ${processed}`);
                console.log(`  - Errores: ${errors}`);
                console.log(`\n✅ Actualización completada`);
                db.close();
              }, 100);
            }
          });
        } else {
          console.log(`⚠️  No se encontró orden con ID ${orderId}`);
          errors++;
        }
      });
    });
  });
});
