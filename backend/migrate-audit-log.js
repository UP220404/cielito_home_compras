/**
 * Script de migración para actualizar restricción CHECK en audit_log
 * Ejecutar con: node migrate-audit-log.js
 */

const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DATABASE_URL || './database.sqlite';

console.log('🔄 Ejecutando migración: Actualizar restricción CHECK en audit_log...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado a SQLite database');
});

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

async function migrate() {
  try {
    console.log('📝 Recreando tabla audit_log con acciones adicionales...');

    // Crear tabla temporal con la nueva estructura
    await runQuery(`
      CREATE TABLE audit_log_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'login', 'logout')),
        old_values TEXT,
        new_values TEXT,
        user_id INTEGER,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    console.log('📋 Copiando datos existentes...');

    // Copiar datos de la tabla anterior a la nueva
    await runQuery(`
      INSERT INTO audit_log_new
      SELECT * FROM audit_log
    `);

    console.log('🗑️  Eliminando tabla anterior...');

    await runQuery('DROP TABLE audit_log');

    console.log('✏️  Renombrando tabla nueva...');

    await runQuery('ALTER TABLE audit_log_new RENAME TO audit_log');

    console.log('');
    console.log('✅ ¡Migración completada exitosamente!');
    console.log('');
    console.log('📊 Resumen:');
    console.log('   - Tabla audit_log actualizada');
    console.log('   - Acciones permitidas: create, update, delete, login, logout');
    console.log('   - Datos existentes preservados');
    console.log('');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('❌ Error cerrando base de datos:', err.message);
      }
      process.exit(0);
    });
  }
}

// Ejecutar migración
console.log('');
console.log('Iniciando en 2 segundos... (Ctrl+C para cancelar)');
console.log('');

setTimeout(migrate, 2000);
