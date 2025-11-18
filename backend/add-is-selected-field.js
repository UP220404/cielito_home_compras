const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

console.log('🔧 Agregando campo is_selected a quotation_items...\n');

db.serialize(() => {
  // Agregar columna is_selected a quotation_items
  db.run(`
    ALTER TABLE quotation_items
    ADD COLUMN is_selected INTEGER DEFAULT 0
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('   ℹ️  El campo is_selected ya existe');
      } else {
        console.error('   ❌ Error agregando campo is_selected:', err.message);
      }
    } else {
      console.log('   ✅ Campo is_selected agregado exitosamente');
    }
  });

  // Verificar la estructura final
  db.all('PRAGMA table_info(quotation_items)', (err, rows) => {
    if (err) {
      console.error('Error verificando estructura:', err.message);
    } else {
      console.log('\n📋 Estructura de quotation_items:');
      rows.forEach(col => {
        console.log(`   - ${col.name}: ${col.type}${col.dflt_value ? ` (default: ${col.dflt_value})` : ''}`);
      });
    }

    console.log('\n✅ Migración completada');
    db.close();
  });
});
