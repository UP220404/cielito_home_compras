const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.db');

function runMigration() {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('❌ Error conectando a la base de datos:', err);
      process.exit(1);
    }
    console.log('✅ Conectado a la base de datos');
  });

  db.serialize(() => {
    console.log('🔄 Verificando estado de la base de datos...');

    // Verificar si la tabla requests existe
    db.get(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='requests'
    `, (err, row) => {
      if (err) {
        console.error('❌ Error verificando tabla:', err);
        db.close();
        process.exit(1);
      }

      if (!row) {
        console.log('⚠️  La tabla requests no existe. Ejecuta primero: node init-db.js');
        db.close();
        process.exit(1);
      }

      console.log('✅ Tabla requests encontrada');
      console.log('🔄 Iniciando migración...');

      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('❌ Error iniciando transacción:', err);
          db.close();
          process.exit(1);
        }

        // 1. Crear tabla temporal
        db.run(`
          CREATE TABLE IF NOT EXISTS requests_temp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folio TEXT UNIQUE NOT NULL,
            user_id INTEGER NOT NULL,
            area TEXT NOT NULL,
            delivery_date DATE NOT NULL,
            urgency TEXT CHECK (urgency IN ('baja', 'media', 'alta')),
            priority TEXT CHECK (priority IN ('normal', 'urgente', 'critica')),
            justification TEXT NOT NULL,
            status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'cotizando', 'autorizada', 'rechazada', 'comprada', 'entregada', 'cancelada', 'emitida', 'en_transito', 'recibida')),
            authorized_by INTEGER,
            authorized_at DATETIME,
            rejection_reason TEXT,
            request_date DATE DEFAULT (DATE('now')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (authorized_by) REFERENCES users (id)
          )
        `, (err) => {
          if (err) {
            console.error('❌ Error creando tabla temporal:', err);
            db.run('ROLLBACK');
            db.close();
            process.exit(1);
          }

          // 2. Copiar datos
          db.run(`
            INSERT INTO requests_temp
            SELECT * FROM requests
          `, (err) => {
            if (err) {
              console.error('❌ Error copiando datos:', err);
              db.run('ROLLBACK');
              db.close();
              process.exit(1);
            }

            console.log('✅ Datos copiados a tabla temporal');

            // 3. Eliminar tabla original
            db.run('DROP TABLE requests', (err) => {
              if (err) {
                console.error('❌ Error eliminando tabla original:', err);
                db.run('ROLLBACK');
                db.close();
                process.exit(1);
              }

              console.log('✅ Tabla original eliminada');

              // 4. Renombrar tabla temporal
              db.run('ALTER TABLE requests_temp RENAME TO requests', (err) => {
                if (err) {
                  console.error('❌ Error renombrando tabla:', err);
                  db.run('ROLLBACK');
                  db.close();
                  process.exit(1);
                }

                console.log('✅ Tabla renombrada');

                // 5. Commit
                db.run('COMMIT', (err) => {
                  if (err) {
                    console.error('❌ Error haciendo commit:', err);
                    db.close();
                    process.exit(1);
                  }

                  console.log('✅ Migración completada exitosamente');
                  console.log('📋 Estados de orden agregados a tabla requests: emitida, en_transito, recibida');

                  db.close((err) => {
                    if (err) {
                      console.error('❌ Error cerrando conexión:', err);
                    }
                    console.log('✅ Conexión cerrada');
                    process.exit(0);
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

// Ejecutar migración
runMigration();
