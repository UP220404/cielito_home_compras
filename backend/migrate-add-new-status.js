const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Migrando esquema de base de datos para nuevos estados...\n');

db.serialize(() => {
  // SQLite no permite ALTER COLUMN, así que necesitamos recrear la tabla
  console.log('📋 Paso 1: Creando tabla temporal...');

  db.run(`
    CREATE TABLE IF NOT EXISTS requests_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      area TEXT NOT NULL,
      request_date DATE NOT NULL,
      delivery_date DATE NOT NULL,
      urgency TEXT CHECK(urgency IN ('baja', 'media', 'alta')) NOT NULL,
      priority TEXT CHECK(priority IN ('normal', 'urgente', 'critica')) NOT NULL,
      justification TEXT NOT NULL,
      status TEXT CHECK(status IN ('pendiente', 'cotizando', 'autorizada', 'rechazada', 'emitida', 'en_transito', 'recibida', 'cancelada')) DEFAULT 'pendiente',
      authorized_by INTEGER,
      authorized_at DATETIME,
      rejection_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (authorized_by) REFERENCES users (id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creando tabla temporal:', err);
      db.close();
      return;
    }

    console.log('✅ Tabla temporal creada');
    console.log('\n📋 Paso 2: Copiando datos y actualizando estados...');

    // Copiar datos y actualizar estados antiguos
    db.run(`
      INSERT INTO requests_new
      SELECT
        id, folio, user_id, area, request_date, delivery_date, urgency, priority, justification,
        CASE
          WHEN status = 'comprada' THEN 'emitida'
          WHEN status = 'entregada' THEN 'recibida'
          WHEN status = 'pedido' THEN 'emitida'
          ELSE status
        END as status,
        authorized_by, authorized_at, rejection_reason, created_at, updated_at
      FROM requests
    `, (err) => {
      if (err) {
        console.error('❌ Error copiando datos:', err);
        db.close();
        return;
      }

      console.log('✅ Datos copiados y estados actualizados');
      console.log('\n📋 Paso 3: Eliminando tabla antigua...');

      db.run('DROP TABLE requests', (err) => {
        if (err) {
          console.error('❌ Error eliminando tabla antigua:', err);
          db.close();
          return;
        }

        console.log('✅ Tabla antigua eliminada');
        console.log('\n📋 Paso 4: Renombrando tabla nueva...');

        db.run('ALTER TABLE requests_new RENAME TO requests', (err) => {
          if (err) {
            console.error('❌ Error renombrando tabla:', err);
            db.close();
            return;
          }

          console.log('✅ Tabla renombrada');
          console.log('\n✅ Migración completada exitosamente!');

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
  });
});
