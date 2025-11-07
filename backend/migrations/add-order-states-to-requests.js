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
    console.log('🔄 Iniciando migración: Agregar estados de orden a tabla requests...');

    // SQLite no permite modificar CHECK constraints directamente
    // Necesitamos recrear la tabla

    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('❌ Error iniciando transacción:', err);
        process.exit(1);
      }

      // 1. Crear tabla temporal con la nueva estructura
      db.run(`
        CREATE TABLE requests_new (
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
          process.exit(1);
        }

        // 2. Copiar datos de la tabla original
        db.run(`
          INSERT INTO requests_new
          SELECT * FROM requests
        `, (err) => {
          if (err) {
            console.error('❌ Error copiando datos:', err);
            db.run('ROLLBACK');
            process.exit(1);
          }

          // 3. Eliminar tabla original
          db.run('DROP TABLE requests', (err) => {
            if (err) {
              console.error('❌ Error eliminando tabla original:', err);
              db.run('ROLLBACK');
              process.exit(1);
            }

            // 4. Renombrar tabla temporal
            db.run('ALTER TABLE requests_new RENAME TO requests', (err) => {
              if (err) {
                console.error('❌ Error renombrando tabla:', err);
                db.run('ROLLBACK');
                process.exit(1);
              }

              // 5. Commit
              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('❌ Error haciendo commit:', err);
                  process.exit(1);
                }

                console.log('✅ Migración completada exitosamente');
                console.log('📋 Estados agregados: emitida, en_transito, recibida');

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
}

// Ejecutar migración
runMigration();
