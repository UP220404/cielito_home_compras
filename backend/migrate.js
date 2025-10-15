const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_URL || './database.sqlite';

console.log('🔧 Ejecutando migraciones de base de datos...');

// Crear conexión a la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado a SQLite database');
});

// Función para ejecutar queries con promesas
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

// Función para verificar si una columna existe
function checkColumnExists(tableName, columnName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const columnExists = rows.some(row => row.name === columnName);
        resolve(columnExists);
      }
    });
  });
}

async function runMigrations() {
  try {
    console.log('📝 Verificando migraciones necesarias...');

    // Migración 1: Agregar columna notes a suppliers
    const notesExists = await checkColumnExists('suppliers', 'notes');
    if (!notesExists) {
      console.log('📝 Agregando columna notes a tabla suppliers...');
      await runQuery('ALTER TABLE suppliers ADD COLUMN notes TEXT');
      console.log('✅ Columna notes agregada exitosamente');
    } else {
      console.log('✅ Columna notes ya existe en suppliers');
    }

    // Aquí puedes agregar más migraciones en el futuro

    console.log('🎉 Migraciones completadas exitosamente');

  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error);
    process.exit(1);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('❌ Error cerrando la base de datos:', err.message);
      } else {
        console.log('🔒 Conexión a la base de datos cerrada');
      }
    });
  }
}

// Ejecutar migraciones
runMigrations();