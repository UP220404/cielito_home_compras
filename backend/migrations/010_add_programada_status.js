const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.sqlite');

console.log('🔧 Agregando status "programada" a la tabla requests...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado a SQLite database');
});

// Promisify run
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

async function migrate() {
  let error;
  try {
    console.log('📝 Iniciando migración para agregar status "programada"...');

    console.log('1️⃣ Creando tabla temporal...');
    await runAsync(`
      CREATE TABLE requests_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folio TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        area TEXT NOT NULL,
        request_date DATE NOT NULL,
        delivery_date DATE NOT NULL,
        urgency TEXT NOT NULL,
        priority TEXT NOT NULL,
        justification TEXT NOT NULL,
        status TEXT DEFAULT 'pendiente' CHECK(status IN ('borrador', 'programada', 'pendiente', 'cotizando', 'autorizada', 'rechazada', 'emitida', 'en_transito', 'recibida', 'cancelada')),
        authorized_by INTEGER,
        authorized_at DATETIME,
        rejection_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        budget_approved INTEGER DEFAULT 0,
        is_draft BOOLEAN DEFAULT 0,
        scheduled_for DATETIME,
        draft_data TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (authorized_by) REFERENCES users(id)
      )
    `);

    console.log('2️⃣ Copiando datos de la tabla original...');
    await runAsync(`
      INSERT INTO requests_new
      SELECT * FROM requests
    `);

    console.log('3️⃣ Eliminando tabla original...');
    await runAsync('DROP TABLE requests');

    console.log('4️⃣ Renombrando tabla nueva...');
    await runAsync('ALTER TABLE requests_new RENAME TO requests');

    console.log('✅ Migración completada exitosamente');
    console.log('   - Status "programada" agregado al CHECK constraint');

  } catch (err) {
    error = err;
    console.error('❌ Error en la migración:', err);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('❌ Error cerrando la base de datos:', err.message);
      } else {
        console.log('🔒 Conexión a la base de datos cerrada');
      }
      process.exit(error ? 1 : 0);
    });
  }
}

migrate();
