const sqlite3 = require('sqlite3').verbose();

const dbPath = './database.sqlite';
const db = new sqlite3.Database(dbPath);

console.log('🔧 Agregando columnas faltantes a suppliers...');

db.serialize(() => {
  // Agregar columna category
  db.run('ALTER TABLE suppliers ADD COLUMN category TEXT', (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Error agregando category:', err.message);
    } else {
      console.log('✅ Columna category agregada');
    }
  });

  // Agregar columna rating
  db.run('ALTER TABLE suppliers ADD COLUMN rating REAL DEFAULT 0.0', (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Error agregando rating:', err.message);
    } else {
      console.log('✅ Columna rating agregada');
    }
  });
});

db.close((err) => {
  if (err) {
    console.error('❌ Error cerrando DB:', err.message);
  } else {
    console.log('🎉 Migración completada. Ahora ejecuta: node seed-data.js');
  }
});