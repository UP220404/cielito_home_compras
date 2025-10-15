/**
 * Script de migración para agregar campos faltantes a la tabla quotations
 * Ejecutar con: node migrate-add-quoted-by.js
 */

const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DATABASE_URL || './database.sqlite';

console.log('🔄 Ejecutando migración: Agregar campos quoted_by y quoted_at a quotations...');

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

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

async function migrate() {
  try {
    console.log('📝 Verificando estructura actual de la tabla quotations...');

    // Verificar si los campos ya existen
    const tableInfo = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(quotations)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const hasQuotedBy = tableInfo.some(col => col.name === 'quoted_by');
    const hasQuotedAt = tableInfo.some(col => col.name === 'quoted_at');

    if (hasQuotedBy && hasQuotedAt) {
      console.log('✅ Los campos quoted_by y quoted_at ya existen. No se requiere migración.');
      process.exit(0);
    }

    console.log('⚠️  Campos faltantes detectados. Iniciando migración...');

    // SQLite no soporta ALTER TABLE ADD COLUMN con FOREIGN KEY directamente
    // Necesitamos recrear la tabla

    console.log('📦 Paso 1: Creando tabla temporal...');

    // Crear tabla temporal con la nueva estructura
    await runQuery(`
      CREATE TABLE quotations_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        supplier_id INTEGER NOT NULL,
        quotation_number TEXT,
        total_amount DECIMAL(10,2) NOT NULL,
        delivery_days INTEGER,
        payment_terms TEXT,
        validity_days INTEGER DEFAULT 30,
        notes TEXT,
        is_selected INTEGER DEFAULT 0,
        quoted_by INTEGER NOT NULL DEFAULT 1,
        quoted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (quoted_by) REFERENCES users(id)
      )
    `);

    console.log('📋 Paso 2: Copiando datos existentes...');

    // Copiar datos de la tabla anterior a la nueva
    // Asumimos que el usuario admin (id=1) fue quien cotizó anteriormente
    await runQuery(`
      INSERT INTO quotations_new (
        id, request_id, supplier_id, quotation_number, total_amount,
        delivery_days, payment_terms, validity_days, notes, is_selected,
        quoted_by, quoted_at, created_at, updated_at
      )
      SELECT
        id, request_id, supplier_id, quotation_number, total_amount,
        delivery_days, payment_terms, validity_days, notes, is_selected,
        1 as quoted_by,
        created_at as quoted_at,
        created_at, updated_at
      FROM quotations
    `);

    console.log('🗑️  Paso 3: Eliminando tabla anterior...');

    await runQuery('DROP TABLE quotations');

    console.log('✏️  Paso 4: Renombrando tabla nueva...');

    await runQuery('ALTER TABLE quotations_new RENAME TO quotations');

    console.log('');
    console.log('✅ ¡Migración completada exitosamente!');
    console.log('');
    console.log('📊 Resumen:');
    console.log('   - Campo "quoted_by" agregado (referencia a users)');
    console.log('   - Campo "quoted_at" agregado (timestamp de cotización)');
    console.log('   - Datos existentes migrados correctamente');
    console.log('   - Cotizaciones anteriores asignadas al usuario admin (ID=1)');
    console.log('');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    console.error('');
    console.error('⚠️  IMPORTANTE: Si algo salió mal, restaura el backup de tu base de datos.');
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
console.log('⚠️  ADVERTENCIA: Esta migración recreará la tabla "quotations"');
console.log('   Se recomienda hacer un backup de database.sqlite antes de continuar');
console.log('');
console.log('Iniciando en 3 segundos... (Ctrl+C para cancelar)');
console.log('');

setTimeout(migrate, 3000);
