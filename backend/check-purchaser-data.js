const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

// Buscar el usuario de compras
db.get('SELECT * FROM users WHERE role = ?', ['purchaser'], (err, user) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }

  console.log('👤 Usuario Compras:', JSON.stringify(user, null, 2));

  if (!user) {
    console.log('❌ No hay usuario con rol purchaser');
    db.close();
    process.exit(0);
  }

  // Verificar solicitudes del usuario
  db.all('SELECT * FROM requests WHERE user_id = ?', [user.id], (err, requests) => {
    if (err) {
      console.error('Error:', err);
      db.close();
      process.exit(1);
    }

    console.log('\n📋 Solicitudes del usuario:', requests.length);
    if (requests.length > 0) {
      console.log(JSON.stringify(requests, null, 2));
    }

    // Verificar órdenes de compra
    const query = `
      SELECT po.*, r.user_id
      FROM purchase_orders po
      JOIN requests r ON po.request_id = r.id
      WHERE r.user_id = ?
    `;

    db.all(query, [user.id], (err, orders) => {
      if (err) {
        console.error('Error:', err);
        db.close();
        process.exit(1);
      }

      console.log('\n💰 Órdenes del usuario:', orders.length);
      if (orders.length > 0) {
        console.log(JSON.stringify(orders, null, 2));
      }

      const total = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      console.log('\n💵 Total gastado:', total);

      // Ahora verificar TODAS las órdenes para ver quién las tiene
      db.all(`
        SELECT po.id, po.folio, po.total_amount, r.user_id, u.name, u.role
        FROM purchase_orders po
        JOIN requests r ON po.request_id = r.id
        JOIN users u ON r.user_id = u.id
      `, [], (err, allOrders) => {
        if (err) {
          console.error('Error:', err);
          db.close();
          process.exit(1);
        }

        console.log('\n📊 TODAS las órdenes en el sistema:');
        allOrders.forEach(o => {
          console.log(`  - ${o.folio}: $${o.total_amount} (Usuario: ${o.name}, Rol: ${o.role}, ID: ${o.user_id})`);
        });

        db.close();
      });
    });
  });
});
