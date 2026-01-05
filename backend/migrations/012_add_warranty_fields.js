const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_URL || './database.db';

console.log('🔧 Aplicando migración: Agregar campos de garantía...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado a la base de datos');
});

function runQuery(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ changes: this.changes });
      }
    });
  });
}

async function applyMigration() {
  try {
    console.log('📝 Agregando campos de garantía a quotation_items...');

    // Agregar has_warranty (Sí/No)
    await runQuery(`
      ALTER TABLE quotation_items
      ADD COLUMN has_warranty BOOLEAN DEFAULT 0
    `).catch(err => {
      if (err.message.includes('duplicate column name')) {
        console.log('   ⚠️  has_warranty ya existe');
      } else {
        throw err;
      }
    });

    // Agregar warranty_duration (duración en meses)
    await runQuery(`
      ALTER TABLE quotation_items
      ADD COLUMN warranty_duration INTEGER
    `).catch(err => {
      if (err.message.includes('duplicate column name')) {
        console.log('   ⚠️  warranty_duration ya existe');
      } else {
        throw err;
      }
    });

    // El campo 'garantia' ya existe y se usará como warranty_description
    console.log('   ✅ Campos de garantía agregados correctamente');
    console.log('   ℹ️  El campo "garantia" existente se usará como descripción de la garantía');

    console.log('✅ Migración completada exitosamente');

  } catch (error) {
    console.error('❌ Error aplicando migración:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

applyMigration();
