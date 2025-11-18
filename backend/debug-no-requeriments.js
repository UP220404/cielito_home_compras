const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

console.log('🔍 Investigando el problema de no_requirements...');

db.serialize(() => {
  // Ver la estructura de la tabla
  console.log('\n📋 Estructura de la tabla:');
  db.all("PRAGMA table_info(no_requirements)", (err, columns) => {
    if (err) {
      console.error('❌ Error:', err.message);
    } else {
      columns.forEach(col => {
        console.log(`   - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? '(PK)' : ''}`);
      });
    }
  });

  // Ver índices y restricciones
  console.log('\n🔒 Índices y restricciones:');
  db.all("SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='no_requirements'", (err, indexes) => {
    if (err) {
      console.error('❌ Error:', err.message);
    } else {
      indexes.forEach(idx => {
        console.log(`   - ${idx.name}: ${idx.sql}`);
      });
    }
  });

  // Ver registros existentes
  console.log('\n📄 Registros existentes:');
  db.all("SELECT * FROM no_requirements", (err, rows) => {
    if (err) {
      console.error('❌ Error:', err.message);
    } else {
      console.log(`   Total registros: ${rows.length}`);
      rows.forEach(row => {
        console.log(`   - ID: ${row.id}, User: ${row.user_id}, Semana: ${row.week_start} a ${row.week_end}`);
      });
    }
  });

  // Ver tu user_id
  console.log('\n👤 Tu información de usuario:');
  db.get("SELECT id, name, email FROM users WHERE email = 'sistemas@cielitohome.com'", (err, user) => {
    if (err) {
      console.error('❌ Error:', err.message);
    } else if (user) {
      console.log(`   - ID: ${user.id}, Nombre: ${user.name}, Email: ${user.email}`);
    } else {
      console.log('   - Usuario no encontrado');
    }
    
    setTimeout(() => {
      db.close();
    }, 1000);
  });
});