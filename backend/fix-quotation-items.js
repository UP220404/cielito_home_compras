const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

console.log('🔧 Agregando columnas faltantes a quotation_items...');

db.serialize(() => {
  db.run('ALTER TABLE quotation_items ADD COLUMN has_invoice INTEGER DEFAULT 0', (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Error adding has_invoice:', err.message);
    } else {
      console.log('✅ Added has_invoice column');
    }
  });

  db.run('ALTER TABLE quotation_items ADD COLUMN delivery_date TEXT', (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Error adding delivery_date:', err.message);
    } else {
      console.log('✅ Added delivery_date column');
    }

    // Verificar cambios
    db.all('PRAGMA table_info(quotation_items)', (err, rows) => {
      if (err) {
        console.error(err);
      } else {
        console.log('\n📋 Columnas actuales:');
        rows.forEach(row => console.log(`  - ${row.name} (${row.type})`));
      }
      db.close();
    });
  });
});
