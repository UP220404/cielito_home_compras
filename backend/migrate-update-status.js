const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Actualizando estados de solicitudes...\n');

db.serialize(() => {
  // Verificar solicitudes con estados antiguos
  db.all(`SELECT id, folio, status FROM requests WHERE status IN ('comprada', 'entregada', 'pedido')`, (err, rows) => {
    if (err) {
      console.error('❌ Error consultando solicitudes:', err);
      return;
    }

    if (rows.length === 0) {
      console.log('✅ No hay solicitudes con estados antiguos que actualizar');
      db.close();
      return;
    }

    console.log(`📋 Encontradas ${rows.length} solicitudes con estados antiguos:`);
    rows.forEach(row => {
      console.log(`  - ${row.folio}: ${row.status}`);
    });

    console.log('\n🔧 Actualizando estados...\n');

    // Actualizar 'comprada' y 'pedido' a 'emitida'
    db.run(`UPDATE requests SET status = 'emitida' WHERE status IN ('comprada', 'pedido')`, function(err) {
      if (err) {
        console.error('❌ Error actualizando a emitida:', err);
      } else {
        console.log(`✅ ${this.changes} solicitudes actualizadas de 'comprada/pedido' a 'emitida'`);
      }
    });

    // Actualizar 'entregada' a 'recibida'
    db.run(`UPDATE requests SET status = 'recibida' WHERE status = 'entregada'`, function(err) {
      if (err) {
        console.error('❌ Error actualizando a recibida:', err);
      } else {
        console.log(`✅ ${this.changes} solicitudes actualizadas de 'entregada' a 'recibida'`);
      }

      console.log('\n✅ Migración completada');

      // Verificar resultados
      db.all(`SELECT status, COUNT(*) as count FROM requests GROUP BY status`, (err, rows) => {
        if (!err) {
          console.log('\n📊 Estados actuales de solicitudes:');
          rows.forEach(row => {
            console.log(`  - ${row.status}: ${row.count}`);
          });
        }
        db.close();
      });
    });
  });
});
