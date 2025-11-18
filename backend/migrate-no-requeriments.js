const sqlite3 = require('sqlite3').verbose();

const dbPath = './database.sqlite';
const db = new sqlite3.Database(dbPath);

console.log('🔧 Agregando columnas faltantes a no_requirements...');

db.serialize(() => {
  // Agregar columna approved_by
  db.run('ALTER TABLE no_requirements ADD COLUMN approved_by INTEGER', (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Error agregando approved_by:', err.message);
    } else {
      console.log('✅ Columna approved_by agregada');
    }
  });

  // Agregar columna approved_at
  db.run('ALTER TABLE no_requirements ADD COLUMN approved_at DATETIME', (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Error agregando approved_at:', err.message);
    } else {
      console.log('✅ Columna approved_at agregada');
    }
  });

  // Agregar columna status (por si acaso)
  db.run('ALTER TABLE no_requirements ADD COLUMN status TEXT DEFAULT "pendiente"', (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Error agregando status:', err.message);
    } else {
      console.log('✅ Columna status agregada');
    }
  });

  // Agregar columna comments (por si acaso)
  db.run('ALTER TABLE no_requirements ADD COLUMN comments TEXT', (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Error agregando comments:', err.message);
    } else {
      console.log('✅ Columna comments agregada');
    }
  });

  // Agregar columna notes (NUEVA)
  db.run('ALTER TABLE no_requirements ADD COLUMN notes TEXT', (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Error agregando notes:', err.message);
    } else {
      console.log('✅ Columna notes agregada');
    }
  });

  // Verificar estructura final
  setTimeout(() => {
    db.all("PRAGMA table_info(no_requirements)", (err, columns) => {
      if (err) {
        console.error('❌ Error obteniendo estructura:', err.message);
      } else {
        console.log('📋 Estructura final de la tabla no_requirements:');
        columns.forEach(col => {
          console.log(`   - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? '(PK)' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
        });
      }
      
      db.close((err) => {
        if (err) {
          console.error('❌ Error cerrando DB:', err.message);
        } else {
          console.log('🎉 Migración completada. Reinicia el servidor y recarga la página.');
        }
      });
    });
  }, 1000);
});