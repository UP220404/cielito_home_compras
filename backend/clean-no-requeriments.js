const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

console.log('🧹 Limpiando registros de no_requirements...');

db.run('DELETE FROM no_requirements', (err) => {
  if (err) {
    console.error('❌ Error limpiando tabla:', err.message);
  } else {
    console.log('✅ Tabla no_requirements limpiada');
    console.log('🎉 Ahora puedes crear nuevos registros sin conflictos');
  }
  
  db.close();
});